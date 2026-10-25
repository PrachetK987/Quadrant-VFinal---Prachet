/**
 * src/db/schema.ts
 *
 * IndexedDB Schema definition using Dexie.js.
 * Encapsulates the entire local store matching the Postgres tables
 * plus two local-only tables:
 * - outbox (offline mutations waiting to be pushed)
 * - meta (sync timestamps, pack versions, engine state)
 */

import Dexie, { Table } from 'dexie';
import type {
  Campus,
  Building,
  Floor,
  Room,
  Review,
  Photo,
  Tip,
  Route,
  CheckIn,
  CrowdReport,
  Suggestion,
  CampusPack,
  Profile,
  OutboxEntry,
  AppMeta
} from '../types';

export class QuadrantDatabase extends Dexie {
  // Remote-mirrored tables
  campuses!: Table<Campus, string>;
  buildings!: Table<Building, string>;
  floors!: Table<Floor, string>;
  rooms!: Table<Room, string>;
  reviews!: Table<Review, string>;
  photos!: Table<Photo, string>;
  tips!: Table<Tip, string>;
  routes!: Table<Route, string>;
  check_ins!: Table<CheckIn, string>;
  crowd_reports!: Table<CrowdReport, string>;
  suggestions!: Table<Suggestion, string>;
  campus_packs!: Table<CampusPack, string>;
  profiles!: Table<Profile, string>;

  // Device-only tables
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<AppMeta, string>;

  constructor() {
    super('QuadrantDB');

    // Define table schemas with primary keys and indexed search properties
    this.version(1).stores({
      campuses: 'id, name, updated_at',
      buildings: 'id, campus_id, name, navigability, updated_at, *tags, *amenities',
      floors: 'id, building_id, level, updated_at',
      rooms: 'id, floor_id, room_number, type, svg_element_id, updated_at',
      reviews: 'id, building_id, user_id, stars, updated_at, *tags',
      photos: 'id, building_id, user_id, updated_at',
      tips: 'id, building_id, user_id, updated_at',
      routes: 'id, campus_id, user_id, accessible, updated_at',
      check_ins: 'id, building_id, user_id, time, updated_at',
      crowd_reports: 'id, building_id, user_id, level, expires_at, updated_at',
      suggestions: 'id, building_id, user_id, status, updated_at',
      campus_packs: 'id, campus_id, version, updated_at',
      profiles: 'id, user_id, updated_at',
      // Device-only
      outbox: 'id, table_name, created_at, retry_count',
      meta: 'key'
    });
  }
}

export const db = new QuadrantDatabase();
