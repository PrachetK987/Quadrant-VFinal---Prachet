/**
 * src/offline/storage.ts
 *
 * Persistent storage manager and quota monitor:
 * - Requests durable storage via navigator.storage.persist()
 * - Inspects quota estimates (usage vs quota)
 * - Manages Cache Storage caches for offline assets (PMTiles, SVGs, models)
 */

export interface StorageQuotaInfo {
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
  isPersisted: boolean;
  supported: boolean;
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[Storage] Persistent storage granted: ${isPersisted}`);
      return isPersisted;
    } catch (err) {
      console.warn('[Storage] Error requesting persistence:', err);
      return false;
    }
  }
  return false;
}

export async function checkStorageQuota(): Promise<StorageQuotaInfo> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const isPersisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;

      const usage = estimate.usage || 0;
      const quota = estimate.quota || 1;
      const percent = Math.min(100, Math.round((usage / quota) * 100));

      return {
        usageBytes: usage,
        quotaBytes: quota,
        percentUsed: percent,
        isPersisted,
        supported: true
      };
    } catch (err) {
      console.warn('[Storage] Error estimating quota:', err);
    }
  }

  return {
    usageBytes: 0,
    quotaBytes: 0,
    percentUsed: 0,
    isPersisted: false,
    supported: false
  };
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
