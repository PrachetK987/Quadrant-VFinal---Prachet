/**
 * src/db/repo.ts
 *
 * Repository abstraction layer.
 * Golden Rule: Screens talk ONLY to repo.ts and the local Dexie database.
 * Every write:
 * 1. Writes locally to the appropriate Dexie table
 * 2. Writes an outbox entry in the same transaction
 * 3. Notifies UI immediately through Dexie reactivity
 * 4. Triggers an asynchronous sync cycle attempt in the background
 */

import { db } from './schema';
import { queueOutboxWrite } from '../sync/outbox';
import { syncWorker } from '../sync/syncWorker';
import { filterActiveCrowdReports } from '../sync/conflict';
import type {
  Campus,
  Building,
  Floor,
  Room,
  Review,
  Tip,
  CheckIn,
  CrowdReport,
  CrowdLevel,
  Suggestion,
  Route,
  Profile,
  SearchFilter
} from '../types';

export const repo = {
  // --------------------------------------------------------------------------
  // CAMPUSES & REFERENCE DATA
  // --------------------------------------------------------------------------
  async getCampuses(): Promise<Campus[]> {
    return await db.campuses.filter(c => !c.deleted_at).toArray();
  },

  async getCampusById(id: string): Promise<Campus | undefined> {
    return await db.campuses.get(id);
  },

  // --------------------------------------------------------------------------
  // BUILDINGS & SPATIAL SEARCH
  // --------------------------------------------------------------------------
  async getBuildings(campusId?: string): Promise<Building[]> {
    let collection = db.buildings.filter(b => !b.deleted_at);
    if (campusId) {
      collection = collection.filter(b => b.campus_id === campusId);
    }
    return await collection.toArray();
  },

  async getBuildingById(id: string): Promise<Building | undefined> {
    return await db.buildings.get(id);
  },

  async searchBuildings(filter: SearchFilter): Promise<Building[]> {
    let buildings = await db.buildings.filter(b => !b.deleted_at).toArray();

    if (filter.query) {
      const q = filter.query.toLowerCase().trim();
      buildings = buildings.filter(b =>
        b.name.toLowerCase().includes(q) ||
        b.tags.some(t => t.toLowerCase().includes(q)) ||
        b.amenities.some(a => a.toLowerCase().includes(q))
      );
    }

    if (filter.amenities && filter.amenities.length > 0) {
      buildings = buildings.filter(b =>
        filter.amenities!.every(req => b.amenities.includes(req))
      );
    }

    if (filter.minNavigability) {
      buildings = buildings.filter(b => b.navigability >= filter.minNavigability!);
    }

    return buildings;
  },

  // --------------------------------------------------------------------------
  // FLOORS & ROOMS (SVG FLOORPLANS)
  // --------------------------------------------------------------------------
  async getFloorsForBuilding(buildingId: string): Promise<Floor[]> {
    return await db.floors
      .where('building_id')
      .equals(buildingId)
      .filter(f => !f.deleted_at)
      .sortBy('level');
  },

  async getFloorById(id: string): Promise<Floor | undefined> {
    return await db.floors.get(id);
  },

  async getRoomsForFloor(floorId: string): Promise<Room[]> {
    return await db.rooms
      .where('floor_id')
      .equals(floorId)
      .filter(r => !r.deleted_at)
      .toArray();
  },

  async searchRooms(query: string, buildingId?: string): Promise<Room[]> {
    const q = query.toLowerCase().trim();
    let rooms = await db.rooms.filter(r => !r.deleted_at).toArray();

    if (buildingId) {
      const buildingFloors = await this.getFloorsForBuilding(buildingId);
      const floorIds = new Set(buildingFloors.map(f => f.id));
      rooms = rooms.filter(r => floorIds.has(r.floor_id));
    }

    return rooms.filter(r =>
      r.room_number.toLowerCase().includes(q) ||
      (r.name && r.name.toLowerCase().includes(q)) ||
      r.type.toLowerCase().includes(q)
    );
  },

  // --------------------------------------------------------------------------
  // REVIEWS (APPEND-ONLY + EDIT OWN)
  // --------------------------------------------------------------------------
  async getReviewsForBuilding(buildingId: string): Promise<Review[]> {
    return await db.reviews
      .where('building_id')
      .equals(buildingId)
      .filter(r => !r.deleted_at)
      .reverse()
      .sortBy('updated_at');
  },

  async addReview(data: {
    building_id: string;
    user_id: string;
    user_name: string;
    stars: number;
    navigability: number;
    text: string;
    tags: string[];
  }): Promise<Review> {
    const newReview: Review = {
      id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      building_id: data.building_id,
      user_id: data.user_id,
      user_name: data.user_name,
      stars: Math.max(1, Math.min(5, data.stars)),
      navigability: Math.max(1, Math.min(5, data.navigability)),
      text: data.text.trim().substring(0, 2000),
      tags: data.tags,
      updated_at: new Date().toISOString()
    };

    // Atomic transaction: write row + write outbox
    await db.transaction('rw', db.reviews, db.outbox, async () => {
      await db.reviews.put(newReview);
      await queueOutboxWrite('reviews', 'INSERT', newReview);
    });

    // Notify sync worker to attempt sync if online
    syncWorker.refreshPendingCount();
    if (navigator.onLine) {
      syncWorker.triggerSync();
    }

    return newReview;
  },

  async updateReview(id: string, updates: Partial<Pick<Review, 'stars' | 'navigability' | 'text' | 'tags'>>): Promise<Review> {
    const existing = await db.reviews.get(id);
    if (!existing) throw new Error(`Review with id ${id} not found`);

    const updated: Review = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString()
    };

    await db.transaction('rw', db.reviews, db.outbox, async () => {
      await db.reviews.put(updated);
      await queueOutboxWrite('reviews', 'UPDATE', updated);
    });

    syncWorker.refreshPendingCount();
    if (navigator.onLine) syncWorker.triggerSync();
    return updated;
  },

  async deleteReview(id: string): Promise<void> {
    const existing = await db.reviews.get(id);
    if (!existing) return;

    const softDeleted: Review = {
      ...existing,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.transaction('rw', db.reviews, db.outbox, async () => {
      await db.reviews.put(softDeleted);
      await queueOutboxWrite('reviews', 'DELETE', softDeleted);
    });

    syncWorker.refreshPendingCount();
    if (navigator.onLine) syncWorker.triggerSync();
  },

  // --------------------------------------------------------------------------
  // CROWD REPORTS (APPEND-ONLY, 45 MIN TTL)
  // --------------------------------------------------------------------------
  async getActiveCrowdReports(buildingId: string): Promise<CrowdReport[]> {
    const reports = await db.crowd_reports
      .where('building_id')
      .equals(buildingId)
      .toArray();

    return filterActiveCrowdReports(reports);
  },

  async getLatestCrowdLevel(buildingId: string): Promise<{ level: CrowdLevel; count: number; lastReportAt: string } | null> {
    const active = await this.getActiveCrowdReports(buildingId);
    if (active.length === 0) return null;

    active.sort((a, b) => new Date(b.created_at || b.updated_at).getTime() - new Date(a.created_at || a.updated_at).getTime());
    const latest = active[0];

    return {
      level: latest.level,
      count: active.length,
      lastReportAt: latest.updated_at
    };
  },

  async addCrowdReport(data: {
    building_id: string;
    user_id: string;
    level: CrowdLevel;
  }): Promise<CrowdReport> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 45 * 60 * 1000).toISOString();

    const report: CrowdReport = {
      id: `crowd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      building_id: data.building_id,
      user_id: data.user_id,
      level: data.level,
      expires_at: expiresAt,
      updated_at: now.toISOString()
    };

    await db.transaction('rw', db.crowd_reports, db.outbox, async () => {
      await db.crowd_reports.put(report);
      await queueOutboxWrite('crowd_reports', 'INSERT', report);
    });

    syncWorker.refreshPendingCount();
    if (navigator.onLine) syncWorker.triggerSync();

    return report;
  },

  // --------------------------------------------------------------------------
  // TIPS
  // --------------------------------------------------------------------------
  async getTipsForBuilding(buildingId: string): Promise<Tip[]> {
    return await db.tips
      .where('building_id')
      .equals(buildingId)
      .filter(t => !t.deleted_at)
      .toArray();
  },

  async addTip(data: {
    building_id: string;
    user_id: string;
    user_name: string;
    text: string;
  }): Promise<Tip> {
    const tip: Tip = {
      id: `tip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      building_id: data.building_id,
      user_id: data.user_id,
      user_name: data.user_name,
      text: data.text.trim().substring(0, 500),
      updated_at: new Date().toISOString()
    };

    await db.transaction('rw', db.tips, db.outbox, async () => {
      await db.tips.put(tip);
      await queueOutboxWrite('tips', 'INSERT', tip);
    });

    syncWorker.refreshPendingCount();
    if (navigator.onLine) syncWorker.triggerSync();

    return tip;
  },

  // --------------------------------------------------------------------------
  // CHECK-INS
  // --------------------------------------------------------------------------
  async addCheckIn(buildingId: string, userId: string): Promise<CheckIn> {
    const checkIn: CheckIn = {
      id: `checkin-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      building_id: buildingId,
      user_id: userId,
      time: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.transaction('rw', db.check_ins, db.outbox, async () => {
      await db.check_ins.put(checkIn);
      await queueOutboxWrite('check_ins', 'INSERT', checkIn);
    });

    syncWorker.refreshPendingCount();
    if (navigator.onLine) syncWorker.triggerSync();
    return checkIn;
  },

  async getRecentCheckIns(buildingId: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    return await db.check_ins
      .where('building_id')
      .equals(buildingId)
      .filter(c => c.time > oneHourAgo)
      .count();
  },

  // --------------------------------------------------------------------------
  // ROUTES
  // --------------------------------------------------------------------------
  async getRoutes(campusId?: string): Promise<Route[]> {
    let collection = db.routes.filter(r => !r.deleted_at);
    if (campusId) {
      collection = collection.filter(r => r.campus_id === campusId);
    }
    return await collection.toArray();
  },

  async addRoute(routeData: Omit<Route, 'id' | 'updated_at'>): Promise<Route> {
    const route: Route = {
      ...routeData,
      id: `route-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      updated_at: new Date().toISOString()
    };

    await db.transaction('rw', db.routes, db.outbox, async () => {
      await db.routes.put(route);
      await queueOutboxWrite('routes', 'INSERT', route);
    });

    syncWorker.refreshPendingCount();
    return route;
  },

  async clearRoutes(): Promise<void> {
    await db.routes.clear();
  },

  async deleteRoute(id: string): Promise<void> {
    await db.routes.delete(id);
  },

  // --------------------------------------------------------------------------
  // USER PROFILES
  // --------------------------------------------------------------------------
  async getProfile(userId: string): Promise<Profile | undefined> {
    return await db.profiles.where('user_id').equals(userId).first();
  },

  async upsertProfile(profile: Profile): Promise<Profile> {
    const updated = { ...profile, updated_at: new Date().toISOString() };
    await db.transaction('rw', db.profiles, db.outbox, async () => {
      await db.profiles.put(updated);
      await queueOutboxWrite('profiles', 'UPDATE', updated);
    });
    return updated;
  },

  // --------------------------------------------------------------------------
  // METADATA STORE
  // --------------------------------------------------------------------------
  async getMeta<T = any>(key: string): Promise<T | null> {
    const entry = await db.meta.get(key);
    return entry ? (entry.value as T) : null;
  },

  async setMeta(key: string, value: any): Promise<void> {
    await db.meta.put({ key, value });
  }
};
