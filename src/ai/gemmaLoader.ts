/**
 * src/ai/gemmaLoader.ts
 *
 * Checks device hardware capabilities for on-device inference:
 * 1. WebGPU availability check (navigator.gpu)
 * 2. Storage quota validation (>1.5 GB free)
 * 3. Cache & model status tracking in local meta table
 */

import { db } from '../db/schema';
import { checkStorageQuota } from '../offline/storage';

export interface HardwareCapability {
  hasWebGPU: boolean;
  adapterName?: string;
  hasSufficientStorage: boolean;
  freeBytes: number;
  canRunModel: boolean;
  reasons: string[];
}

export async function checkAIEngineCapability(): Promise<HardwareCapability> {
  const reasons: string[] = [];
  let hasWebGPU = false;
  let adapterName: string | undefined;

  // 1. Check WebGPU
  if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        hasWebGPU = true;
        adapterName = adapter.name || 'WebGPU Compatible GPU';
      } else {
        reasons.push('No compatible WebGPU hardware adapter found on device');
      }
    } catch (e: any) {
      reasons.push(`WebGPU initialization failed: ${e.message}`);
    }
  } else {
    reasons.push('Browser does not support WebGPU API');
  }

  // 2. Check Storage
  const quota = await checkStorageQuota();
  const freeBytes = quota.quotaBytes - quota.usageBytes;
  // Require at least 500 MB free for quantized Gemma model
  const MIN_REQUIRED_BYTES = 500 * 1024 * 1024;
  const hasSufficientStorage = freeBytes > MIN_REQUIRED_BYTES;

  if (!hasSufficientStorage) {
    reasons.push(`Insufficient storage quota (Free: ${(freeBytes / (1024 * 1024)).toFixed(0)} MB, needed: 500 MB)`);
  }

  const canRunModel = hasWebGPU && hasSufficientStorage;

  return {
    hasWebGPU,
    adapterName,
    hasSufficientStorage,
    freeBytes,
    canRunModel,
    reasons
  };
}

export async function getModelStatus(): Promise<'not_installed' | 'downloading' | 'ready' | 'fallback_mode'> {
  const meta = await db.meta.get('modelStatus');
  return meta ? meta.value : 'fallback_mode';
}

export async function setModelStatus(status: 'not_installed' | 'downloading' | 'ready' | 'fallback_mode'): Promise<void> {
  await db.meta.put({ key: 'modelStatus', value: status });
}
