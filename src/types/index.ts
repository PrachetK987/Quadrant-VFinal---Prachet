/**
 * src/types/index.ts
 * Core domain types and synchronization data contracts for Quadrant
 */

export interface BaseEntity {
  id: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Campus extends BaseEntity {
  name: string;
  center_lat: number;
  center_lng: number;
  current_pack_version: string;
}

export interface Building extends BaseEntity {
  campus_id: string;
  name: string;
  lat: number;
  lng: number;
  hours: string;
  floors_count: number;
  tags: string[];
  amenities: string[];
  accessibility_notes: string;
  navigability: number; // 1 to 5
}

export interface Floor extends BaseEntity {
  building_id: string;
  level: number;
  floorplan_svg_path: string;
  highlights: string[];
}

export interface Room extends BaseEntity {
  floor_id: string;
  room_number: string;
  name?: string;
  type: string;
  svg_element_id: string;
}

export interface Review extends BaseEntity {
  building_id: string;
  user_id: string;
  user_name: string;
  stars: number; // 1 to 5
  navigability: number; // 1 to 5
  text: string;
  tags: string[];
}

export interface Photo extends BaseEntity {
  building_id: string;
  user_id: string;
  storage_path: string;
  caption?: string;
  thumbnail_url?: string;
}

export interface Tip extends BaseEntity {
  building_id: string;
  user_id: string;
  user_name: string;
  text: string;
}

export interface Route extends BaseEntity {
  campus_id: string;
  user_id: string;
  name: string;
  geojson: any;
  distance_meters: number;
  accessible: boolean;
}

export interface CheckIn extends BaseEntity {
  building_id: string;
  user_id: string;
  time: string;
}

export type CrowdLevel = 'quiet' | 'busy' | 'packed';

export interface CrowdReport extends BaseEntity {
  building_id: string;
  user_id: string;
  level: CrowdLevel;
  expires_at: string;
}

export interface Suggestion extends BaseEntity {
  building_id: string;
  user_id: string;
  field: string;
  proposed_value: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface CampusPack extends BaseEntity {
  campus_id: string;
  version: string;
  manifest_url: string;
  size_bytes: number;
  checksum: string;
}

export interface Profile extends BaseEntity {
  user_id: string;
  display_name: string;
  email?: string;
  year?: string;
  badges: string[];
}

// Local-only sync and metadata types
export type OutboxOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface OutboxEntry {
  id: string;
  table_name: string;
  operation: OutboxOperation;
  payload: any;
  created_at: string;
  retry_count: number;
  last_error?: string;
}

export interface AppMeta {
  key: string;
  value: any;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  pendingCount: number;
  lastSyncedAt: string | null;
  errorMessage?: string;
}

export interface SearchFilter {
  query?: string;
  amenities?: string[];
  maxCrowd?: CrowdLevel;
  isOpenNow?: boolean;
  minNavigability?: number;
  nearLat?: number;
  nearLng?: number;
}
