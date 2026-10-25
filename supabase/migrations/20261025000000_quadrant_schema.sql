-- ==============================================================================
-- Quadrant Architecture: Central Supabase Schema & Delta Sync Triggers
-- ==============================================================================

-- 1. Helper trigger function: automatically bump updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Campuses
CREATE TABLE IF NOT EXISTS campuses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  current_pack_version TEXT NOT NULL DEFAULT 'v1.0.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_campuses_updated_at
BEFORE UPDATE ON campuses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Buildings
CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  campus_id TEXT NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  hours TEXT NOT NULL,
  floors_count INT NOT NULL DEFAULT 1,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  accessibility_notes TEXT DEFAULT '',
  navigability INT NOT NULL DEFAULT 5 CHECK (navigability BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_buildings_campus ON buildings(campus_id);
CREATE INDEX IF NOT EXISTS idx_buildings_updated ON buildings(updated_at);

CREATE TRIGGER trg_buildings_updated_at
BEFORE UPDATE ON buildings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Floors
CREATE TABLE IF NOT EXISTS floors (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  level INT NOT NULL,
  floorplan_svg_path TEXT NOT NULL,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_floors_building ON floors(building_id);
CREATE TRIGGER trg_floors_updated_at
BEFORE UPDATE ON floors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  name TEXT,
  type TEXT NOT NULL,
  svg_element_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor_id);
CREATE TRIGGER trg_rooms_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY, -- matches auth.uid()
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT,
  year TEXT,
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. Reviews (Append-only; author can edit own)
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  stars INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  navigability INT NOT NULL CHECK (navigability BETWEEN 1 AND 5),
  text TEXT NOT NULL CHECK (char_length(text) <= 2000),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reviews_building ON reviews(building_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_updated ON reviews(updated_at);
CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. Photos
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_photos_building ON photos(building_id);
CREATE TRIGGER trg_photos_updated_at
BEFORE UPDATE ON photos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. Tips
CREATE TABLE IF NOT EXISTS tips (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL CHECK (char_length(text) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tips_building ON tips(building_id);
CREATE TRIGGER trg_tips_updated_at
BEFORE UPDATE ON tips
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10. Routes (Campus outdoor/indoor paths)
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  campus_id TEXT NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  geojson JSONB NOT NULL,
  distance_meters INT NOT NULL,
  accessible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_routes_campus ON routes(campus_id);
CREATE TRIGGER trg_routes_updated_at
BEFORE UPDATE ON routes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 11. Check-ins (Append-only)
CREATE TABLE IF NOT EXISTS check_ins (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_checkins_building ON check_ins(building_id);
CREATE TRIGGER trg_checkins_updated_at
BEFORE UPDATE ON check_ins
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 12. Crowd Reports (Append-only; expires after 45 minutes; rate-limited)
CREATE TABLE IF NOT EXISTS crowd_reports (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('quiet', 'busy', 'packed')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '45 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crowd_building_time ON crowd_reports(building_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crowd_expires ON crowd_reports(expires_at);

-- Database function for server-side rate limits: max 1 crowd report per building per user per 10 mins
CREATE OR REPLACE FUNCTION check_crowd_report_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM crowd_reports
    WHERE building_id = NEW.building_id
      AND user_id = NEW.user_id
      AND created_at > (NOW() - INTERVAL '10 minutes')
  ) THEN
    RAISE EXCEPTION 'Rate limit exceeded: You may only submit one crowd report per building every 10 minutes.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crowd_rate_limit
BEFORE INSERT ON crowd_reports
FOR EACH ROW EXECUTE FUNCTION check_crowd_report_rate_limit();

-- 13. Suggestions (Moderated building info updates)
CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  field TEXT NOT NULL,
  proposed_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE TRIGGER trg_suggestions_updated_at
BEFORE UPDATE ON suggestions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 14. Campus Packs (Published bundles)
CREATE TABLE IF NOT EXISTS campus_packs (
  id TEXT PRIMARY KEY,
  campus_id TEXT NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  manifest_url TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_packs_campus ON campus_packs(campus_id);
CREATE TRIGGER trg_campus_packs_updated_at
BEFORE UPDATE ON campus_packs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
