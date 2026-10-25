# Quadrant Architecture Implementation

Quadrant is an offline-first campus guide and navigation platform where every client device reads and writes a local Dexie database, synchronized with a central Supabase Postgres database.

## Architecture Highlights

1. **Never wait on the network**: Screens interface strictly with `src/db/repo.ts` and the local Dexie store. UI mutations update immediately in local IndexedDB.
2. **One shared truth**: Central Postgres schema (`supabase/migrations/`) enforces RLS, rate limits (max 1 crowd report per 10m per user), and triggers for delta watermarks.
3. **Delta Sync & Outbox**:
   - Write path: UI calls `repo.*()` -> atomic transaction writes local entity + queues into `outbox`.
   - Sync cycle: Triggered on app launch, `window.online` event, and every 60s while online.
   - Pushes outbox entries via idempotent upsert by UUID.
   - Pulls delta changes where `updated_at > meta.lastSyncedAt`.
   - Conflict resolution: Append-only for student reviews, photos, tips, routes, check-ins; 45-minute TTL expiry for crowd reports; Last-Write-Wins (LWW) for review edits; moderated suggestions for building metadata.
4. **Offline Campus Packs**:
   - Bundles: `manifest.json`, `buildings.json`, `routes.geojson`, vector SVG floorplans per floor.
   - Vector SVGs have clickable room elements tagged with IDs (e.g. `id="room-214"`), enabling search, highlight, and routing.
   - Built via `tools/build-pack.ts`.
5. **On-Device Gemma AI Assistant**:
   - WebGPU capability detection (`src/ai/gemmaLoader.ts`).
   - Local Dexie retrieval grounding (`src/ai/retrieve.ts`) scoring buildings and rooms by tags, amenities (outlets, quiet, food), crowd status, and distance.
   - Web Worker (`src/ai/assistant.worker.ts`) executing off the main thread to ensure 60fps UI/map performance.
   - Graceful offline fallback ranking when WebGPU/model is not downloaded.

## Project Structure

```text
quadrant/
├── public/
│   ├── favicon.svg
│   ├── manifest.json
│   └── packs/
│       └── campus-pack-v1/
│           ├── manifest.json
│           ├── buildings.json
│           ├── routes.geojson
│           └── floorplans/
│               ├── library-fl1.svg
│               ├── library-fl2.svg
│               ├── science-fl1.svg
│               └── student-union-fl1.svg
├── supabase/
│   ├── migrations/
│   │   ├── 20261025000000_quadrant_schema.sql
│   │   └── 20261025000001_security_and_rls.sql
│   └── functions/
│       └── publish-pack/index.ts
├── tools/
│   └── build-pack.ts
└── src/
    ├── types/
    │   └── index.ts
    ├── db/
    │   ├── schema.ts
    │   └── repo.ts
    ├── sync/
    │   ├── outbox.ts
    │   ├── syncWorker.ts
    │   └── conflict.ts
    ├── offline/
    │   ├── packManager.ts
    │   └── storage.ts
    ├── ai/
    │   ├── gemmaLoader.ts
    │   ├── retrieve.ts
    │   ├── assistant.worker.ts
    │   └── assistant.ts
    ├── api/
    │   └── supabase.ts
    ├── components/
    │   ├── Layout.tsx
    │   ├── SyncStatusBar.tsx
    │   ├── Modal.tsx
    │   └── StarRating.tsx
    └── features/
        ├── explore/
        ├── building/
        ├── routes/
        ├── assistant/
        ├── packs/
        └── profile/
```

## Running the Project

```bash
cd /Users/naagaaprachetkadabapradeep/.gemini/antigravity/scratch/quadrant
npm install
npm run dev
```
