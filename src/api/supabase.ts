/**
 * src/api/supabase.ts
 *
 * Isolated Supabase client.
 * Strictly invoked ONLY by sync/ and offline/ subsystems.
 * Screens and UI components never import this file directly; they interface solely with repo.ts.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables or fallback defaults for demonstration and local development
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://mock-quadrant.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'mock-anon-key-quadrant-2026';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'quadrant-auth-token'
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
  }
  return supabaseInstance;
}

/**
 * Checks if the remote server is reachable.
 */
export async function checkConnectivity(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/health`, { method: 'HEAD', cache: 'no-store' }).catch(() => null);
    // If running in development with mock URL, rely on navigator.onLine
    if (SUPABASE_URL.includes('mock-quadrant')) {
      return navigator.onLine;
    }
    return res ? res.ok : navigator.onLine;
  } catch {
    return false;
  }
}
