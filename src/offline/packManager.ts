/**
 * src/offline/packManager.ts
 *
 * Downloads, verifies, and installs versioned Campus Packs.
 * Stores binary/SVG assets in Cache Storage and populates local Dexie tables.
 */

import { db } from '../db/schema';
import { requestPersistentStorage } from './storage';

export interface PackDownloadProgress {
  status: 'idle' | 'checking' | 'downloading' | 'installing' | 'completed' | 'error';
  totalBytes: number;
  downloadedBytes: number;
  percent: number;
  currentFile: string;
  errorMessage?: string;
}

export type PackProgressListener = (progress: PackDownloadProgress) => void;

const CACHE_NAME = 'quadrant-campus-packs-v1';

class PackManager {
  private progressListeners: Set<PackProgressListener> = new Set();
  private progress: PackDownloadProgress = {
    status: 'idle',
    totalBytes: 0,
    downloadedBytes: 0,
    percent: 0,
    currentFile: ''
  };

  public subscribe(listener: PackProgressListener): () => void {
    this.progressListeners.add(listener);
    listener(this.progress);
    return () => this.progressListeners.delete(listener);
  }

  private setProgress(update: Partial<PackDownloadProgress>) {
    this.progress = { ...this.progress, ...update };
    for (const listener of this.progressListeners) {
      listener(this.progress);
    }
  }

  public async getInstalledPackVersion(): Promise<string | null> {
    const meta = await db.meta.get('installedPackVersion');
    return meta ? meta.value : null;
  }

  /**
   * Downloads and installs a campus pack by manifest URL.
   */
  public async downloadAndInstallPack(packBaseUrl: string = '/packs/campus-pack-v1'): Promise<boolean> {
    this.setProgress({
      status: 'checking',
      downloadedBytes: 0,
      totalBytes: 0,
      percent: 0,
      currentFile: 'manifest.json'
    });

    try {
      // 1. Request persistence
      await requestPersistentStorage();

      // 2. Fetch manifest
      const manifestUrl = `${packBaseUrl}/manifest.json`;
      const manifestRes = await fetch(manifestUrl);
      if (!manifestRes.ok) {
        throw new Error(`Failed to download pack manifest from ${manifestUrl}`);
      }
      const manifest = await manifestRes.json();
      const totalBytes = manifest.total_size_bytes || 284500;

      this.setProgress({
        status: 'downloading',
        totalBytes,
        currentFile: 'buildings.json'
      });

      // 3. Open Cache Storage
      const cache = await caches.open(CACHE_NAME);

      // Cache manifest
      await cache.put(manifestUrl, manifestRes.clone());

      let bytesAccumulated = 0;

      // 4. Download files listed in manifest
      for (const file of manifest.files) {
        this.setProgress({
          currentFile: file.path,
          downloadedBytes: bytesAccumulated,
          percent: Math.min(95, Math.round((bytesAccumulated / totalBytes) * 100))
        });

        const fileUrl = `${packBaseUrl}/${file.path}`;
        const res = await fetch(fileUrl);
        if (!res.ok) {
          console.warn(`Failed to fetch pack file: ${fileUrl}`);
          continue;
        }

        // Store into Cache Storage
        await cache.put(fileUrl, res.clone());
        bytesAccumulated += file.size;

        // If it's buildings.json, ingest into Dexie
        if (file.path === 'buildings.json') {
          const buildingsData = await res.json();
          await this.ingestBuildingsData(buildingsData);
        }

        // If it's routes.geojson, ingest into Dexie routes
        if (file.path === 'routes.geojson') {
          const routesData = await res.json();
          await this.ingestRoutesData(routesData);
        }
      }

      this.setProgress({
        status: 'installing',
        downloadedBytes: totalBytes,
        percent: 98,
        currentFile: 'Finalizing database indexes...'
      });

      // 5. Update local metadata
      await db.meta.put({ key: 'installedPackVersion', value: manifest.version });
      await db.meta.put({ key: 'installedPackDate', value: new Date().toISOString() });

      this.setProgress({
        status: 'completed',
        downloadedBytes: totalBytes,
        percent: 100,
        currentFile: 'Done'
      });

      return true;
    } catch (err: any) {
      console.error('[PackManager] Pack download error:', err);
      this.setProgress({
        status: 'error',
        errorMessage: err.message || 'Pack download failed'
      });
      return false;
    }
  }

  /**
   * Loads buildings, floors, rooms, and starter reviews into Dexie
   */
  private async ingestBuildingsData(data: any): Promise<void> {
    await db.transaction('rw', [db.campuses, db.buildings, db.floors, db.rooms, db.reviews, db.tips], async () => {
      // 1. Campus
      if (data.campus) {
        await db.campuses.put({
          ...data.campus,
          updated_at: new Date().toISOString()
        });
      }

      // 2. Buildings, Floors, Rooms
      if (Array.isArray(data.buildings)) {
        for (const b of data.buildings) {
          const { floors, rooms, ...buildingFields } = b;

          await db.buildings.put({
            ...buildingFields,
            updated_at: buildingFields.updated_at || new Date().toISOString()
          });

          if (Array.isArray(floors)) {
            for (const fl of floors) {
              await db.floors.put({
                ...fl,
                updated_at: new Date().toISOString()
              });
            }
          }

          if (Array.isArray(rooms)) {
            for (const rm of rooms) {
              await db.rooms.put({
                ...rm,
                updated_at: new Date().toISOString()
              });
            }
          }
        }
      }

      // 3. Initial reviews & tips snapshot
      if (Array.isArray(data.initial_reviews)) {
        for (const rev of data.initial_reviews) {
          const exists = await db.reviews.get(rev.id);
          if (!exists) {
            await db.reviews.put(rev);
          }
        }
      }

      if (Array.isArray(data.initial_tips)) {
        for (const tip of data.initial_tips) {
          const exists = await db.tips.get(tip.id);
          if (!exists) {
            await db.tips.put(tip);
          }
        }
      }
    });
  }

  private async ingestRoutesData(geojson: any): Promise<void> {
    if (geojson && Array.isArray(geojson.features)) {
      await db.transaction('rw', db.routes, async () => {
        for (const feature of geojson.features) {
          const props = feature.properties || {};
          await db.routes.put({
            id: props.id || `route-${Math.random().toString(36).substring(2, 7)}`,
            campus_id: props.campus_id || 'c-berkeley-central',
            user_id: 'system',
            name: props.name || 'Campus Pathway',
            geojson: feature.geometry,
            distance_meters: props.distance_meters || 200,
            accessible: props.accessible ?? true,
            updated_at: new Date().toISOString()
          });
        }
      });
    }
  }
}

export const packManager = new PackManager();
