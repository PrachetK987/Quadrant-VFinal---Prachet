/**
 * src/components/SyncStatusBar.tsx
 *
 * Real-time synchronization status pill.
 * Implements the architecture guideline:
 * 'The UI shows sync state in one line: "Offline: 3 changes waiting" or "Synced just now"'
 */

import React, { useEffect, useState } from 'react';
import { syncWorker } from '../sync/syncWorker';
import type { SyncStatus } from '../types';
import { RefreshCw, WifiOff, CheckCircle2, AlertTriangle } from 'lucide-react';

export const SyncStatusBar: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus>({
    state: navigator.onLine ? 'idle' : 'offline',
    pendingCount: 0,
    lastSyncedAt: null
  });

  useEffect(() => {
    const unsubscribe = syncWorker.subscribe(newStatus => {
      setStatus(newStatus);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = () => {
    syncWorker.triggerSync();
  };

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diff < 10) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs">
      <div className="flex items-center space-x-2">
        {status.state === 'offline' ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300 font-medium">
              Offline: {status.pendingCount > 0 ? `${status.pendingCount} changes waiting` : 'Zero queued changes'}
            </span>
          </>
        ) : status.state === 'syncing' ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
            <span className="text-sky-300 font-medium">Syncing changes...</span>
          </>
        ) : status.state === 'error' ? (
          <>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-rose-300 font-medium">Sync paused ({status.pendingCount} waiting)</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">
              Synced {formatLastSync(status.lastSyncedAt)}
              {status.pendingCount > 0 && ` (${status.pendingCount} pending)`}
            </span>
          </>
        )}
      </div>

      <button
        onClick={handleManualSync}
        disabled={status.state === 'syncing'}
        className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-[11px] disabled:opacity-50"
        title="Trigger immediate sync cycle"
      >
        <RefreshCw className={`w-3 h-3 ${status.state === 'syncing' ? 'animate-spin' : ''}`} />
        <span>Sync</span>
      </button>
    </div>
  );
};
