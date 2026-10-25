/**
 * src/ai/retrieve.ts
 *
 * Local retrieval engine.
 * Given a user natural language prompt (e.g. "quiet place with outlets near Science Hall"):
 * 1. Extracts semantic tags, required amenities, spatial proximity cues
 * 2. Queries Dexie local database for buildings, rooms, reviews, and current crowd levels
 * 3. Scores candidates and returns the top 5 highest-ranking matches for context grounding
 */

import { db } from '../db/schema';
import { repo } from '../db/repo';
import type { Building, Room } from '../types';

export interface RetrievedCandidate {
  building: Building;
  room?: Room;
  floorLevel?: number;
  score: number;
  matchedReasons: string[];
  crowdLevel?: 'quiet' | 'busy' | 'packed';
  distanceMeters?: number;
}

export async function retrieveContextForQuery(prompt: string): Promise<RetrievedCandidate[]> {
  const normalized = prompt.toLowerCase();
  const buildings = await db.buildings.filter(b => !b.deleted_at).toArray();
  const rooms = await db.rooms.filter(r => !r.deleted_at).toArray();
  const floors = await db.floors.filter(f => !f.deleted_at).toArray();

  const floorMap = new Map(floors.map(f => [f.id, f]));

  // Recognized keyword signals
  const wantsQuiet = normalized.includes('quiet') || normalized.includes('silent') || normalized.includes('study');
  const wantsOutlets = normalized.includes('outlet') || normalized.includes('plug') || normalized.includes('power') || normalized.includes('charge');
  const wantsFood = normalized.includes('food') || normalized.includes('eat') || normalized.includes('microwave') || normalized.includes('coffee') || normalized.includes('cafe');
  const wantsComputers = normalized.includes('computer') || normalized.includes('pc') || normalized.includes('linux') || normalized.includes('lab') || normalized.includes('print');
  const wantsAccessible = normalized.includes('ramp') || normalized.includes('accessible') || normalized.includes('elevator') || normalized.includes('wheelchair');

  // Check spatial anchor (e.g. "near Science Hall", "near Library")
  let anchorBuilding: Building | undefined;
  for (const b of buildings) {
    if (normalized.includes(b.name.toLowerCase()) || normalized.includes(b.id.toLowerCase())) {
      anchorBuilding = b;
      break;
    }
  }

  const scoredList: RetrievedCandidate[] = [];

  for (const building of buildings) {
    let baseScore = 0;
    const reasons: string[] = [];

    // Tag and amenity matching
    if (wantsQuiet && (building.tags.includes('Silent') || building.amenities.includes('quiet'))) {
      baseScore += 30;
      reasons.push('Designated silent/quiet zone');
    }

    if (wantsOutlets && building.amenities.includes('outlets')) {
      baseScore += 25;
      reasons.push('Equipped with power outlets');
    }

    if (wantsFood && (building.tags.includes('Food') || building.amenities.includes('microwave'))) {
      baseScore += 25;
      reasons.push('Food services and microwaves');
    }

    if (wantsComputers && (building.tags.includes('STEM') || building.amenities.includes('printer'))) {
      baseScore += 20;
      reasons.push('Computer labs & printer stations');
    }

    if (wantsAccessible && building.amenities.includes('accessible_entrance')) {
      baseScore += 20;
      reasons.push('Full ADA ramp & elevator access');
    }

    // Direct name match
    if (normalized.includes(building.name.toLowerCase())) {
      baseScore += 40;
      reasons.push('Direct name mention');
    }

    // Crowd level penalty/bonus
    const crowdInfo = await repo.getLatestCrowdLevel(building.id);
    if (crowdInfo) {
      if (wantsQuiet) {
        if (crowdInfo.level === 'quiet') {
          baseScore += 20;
          reasons.push('Real-time crowd report: Quiet');
        } else if (crowdInfo.level === 'packed') {
          baseScore -= 25;
          reasons.push('Crowd alert: Currently packed');
        }
      }
    }

    // Spatial distance score if anchor mentioned
    let distance: number | undefined;
    if (anchorBuilding) {
      const latDiff = Math.abs(building.lat - anchorBuilding.lat);
      const lngDiff = Math.abs(building.lng - anchorBuilding.lng);
      distance = Math.round(Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000); // approximate meters

      if (building.id !== anchorBuilding.id) {
        if (distance < 300) {
          baseScore += 25;
          reasons.push(`Within ${distance}m of ${anchorBuilding.name}`);
        } else if (distance < 600) {
          baseScore += 10;
        }
      }
    }

    // Add building level candidate
    scoredList.push({
      building,
      score: baseScore,
      matchedReasons: reasons,
      crowdLevel: crowdInfo?.level,
      distanceMeters: distance
    });

    // Score specific rooms inside building (e.g. Room 214)
    const buildingRooms = rooms.filter(r => {
      const fl = floorMap.get(r.floor_id);
      return fl && fl.building_id === building.id;
    });

    for (const room of buildingRooms) {
      const fl = floorMap.get(room.floor_id);
      let roomScore = baseScore;
      const roomReasons = [...reasons];

      const rName = (room.name || '').toLowerCase();
      const rNum = room.room_number.toLowerCase();

      if (normalized.includes(rNum) || (room.name && normalized.includes(rName))) {
        roomScore += 50;
        roomReasons.push(`Target room ${room.room_number} (${room.name})`);
      }

      if (wantsQuiet && (rName.includes('quiet') || rName.includes('focus') || room.type === 'study')) {
        roomScore += 20;
        roomReasons.push(`Room ${room.room_number}: quiet study space`);
      }

      if (wantsOutlets && (rName.includes('high-power') || rName.includes('commons'))) {
        roomScore += 20;
        roomReasons.push(`Room ${room.room_number}: high power density`);
      }

      scoredList.push({
        building,
        room,
        floorLevel: fl?.level,
        score: roomScore,
        matchedReasons: roomReasons,
        crowdLevel: crowdInfo?.level,
        distanceMeters: distance
      });
    }
  }

  // Sort descending by score
  scoredList.sort((a, b) => b.score - a.score);

  // Return top 5 matches
  return scoredList.slice(0, 5);
}
