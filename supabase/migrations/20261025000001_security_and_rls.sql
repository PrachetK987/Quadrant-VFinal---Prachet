-- ==============================================================================
-- Quadrant Architecture: Row Level Security (RLS) & Moderation Policies
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE crowd_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_packs ENABLE ROW LEVEL SECURITY;

-- Helper function: Is caller an Admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    coalesce(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Read access: Campus metadata, buildings, floors, rooms, routes, and packs are publicly readable
CREATE POLICY "Public can view campuses" ON campuses FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Public can view buildings" ON buildings FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Public can view floors" ON floors FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Public can view rooms" ON rooms FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Public can view routes" ON routes FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Public can view campus_packs" ON campus_packs FOR SELECT USING (deleted_at IS NULL);

-- Admin write access for core reference tables
CREATE POLICY "Admin manage campuses" ON campuses FOR ALL USING (is_admin());
CREATE POLICY "Admin manage buildings" ON buildings FOR ALL USING (is_admin());
CREATE POLICY "Admin manage floors" ON floors FOR ALL USING (is_admin());
CREATE POLICY "Admin manage rooms" ON rooms FOR ALL USING (is_admin());
CREATE POLICY "Admin manage campus_packs" ON campus_packs FOR ALL USING (is_admin());

-- 2. Profiles: Public read; user can insert/update only their own profile
CREATE POLICY "Public view profiles" ON profiles FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "User insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "User update own profile" ON profiles FOR UPDATE USING (auth.uid()::text = user_id);

-- 3. Reviews: Public read; authenticated users insert own; users edit/soft-delete only own
CREATE POLICY "Public view reviews" ON reviews FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Auth users insert review" ON reviews FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users update own review" ON reviews FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users soft delete own review" ON reviews FOR DELETE USING (auth.uid()::text = user_id);

-- 4. Photos: Public read; authenticated users insert own
CREATE POLICY "Public view photos" ON photos FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Auth users insert photo" ON photos FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users delete own photo" ON photos FOR DELETE USING (auth.uid()::text = user_id);

-- 5. Tips: Public read; authenticated users insert own
CREATE POLICY "Public view tips" ON tips FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Auth users insert tip" ON tips FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- 6. Routes: Public read; authenticated users insert own
CREATE POLICY "Auth users insert route" ON routes FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- 7. Check-ins: Authenticated insert own; public select
CREATE POLICY "Public view check_ins" ON check_ins FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Auth users insert check_ins" ON check_ins FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- 8. Crowd Reports: Public read (active non-expired reports); authenticated insert
CREATE POLICY "Public view crowd_reports" ON crowd_reports FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Auth users insert crowd_report" ON crowd_reports FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- 9. Suggestions: Authenticated insert; admin update/moderate
CREATE POLICY "Public view suggestions" ON suggestions FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Auth users insert suggestions" ON suggestions FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Admin moderate suggestions" ON suggestions FOR UPDATE USING (is_admin());
