/**
 * src/features/profile/ProfileScreen.tsx
 *
 * Student Profile, device status, outbox inspection, and settings.
 */

import React, { useEffect, useState } from 'react';
import { db } from '../../db/schema';
import { clearOutbox } from '../../sync/outbox';
import { syncWorker } from '../../sync/syncWorker';
import type { OutboxEntry, Profile } from '../../types';
import { User, Award, Database, Wifi, Trash2, RefreshCw } from 'lucide-react';

interface ProfileScreenProps {
  userId: string;
  userName: string;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ userId, userName }) => {
  const [outboxEntries, setOutboxEntries] = useState<OutboxEntry[]>([]);
  const [dbCounts, setDbCounts] = useState<Record<string, number>>({});

  const refreshStats = async () => {
    const entries = await db.outbox.toArray();
    setOutboxEntries(entries);

    const counts: Record<string, number> = {
      buildings: await db.buildings.count(),
      floors: await db.floors.count(),
      rooms: await db.rooms.count(),
      reviews: await db.reviews.count(),
      crowd_reports: await db.crowd_reports.count()
    };
    setDbCounts(counts);
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const handleClearOutbox = async () => {
    if (confirm('Clear all pending outbox writes?')) {
      await clearOutbox();
      await syncWorker.refreshPendingCount();
      await refreshStats();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto space-y-6 pb-20">
      {/* Profile Card */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-4">
        <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xl">
          {userName.charAt(0)}
        </div>
        <div>
          <h2 className="text-base font-bold text-white">{userName}</h2>
          <span className="text-xs text-slate-400">Student Member · Verified Domain</span>
          <div className="flex items-center space-x-1 mt-1 text-xs text-amber-400">
            <Award className="w-3.5 h-3.5" />
            <span className="font-semibold">Campus Explorer Badge</span>
          </div>
        </div>
      </div>

      {/* Local IndexedDB Statistics */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center space-x-2 text-sm font-bold text-white">
          <Database className="w-4 h-4 text-sky-400" />
          <h3>Local Dexie Database Records</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          {Object.entries(dbCounts).map(([table, count]) => (
            <div key={table} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 capitalize block">{table.replace('_', ' ')}</span>
              <span className="text-white font-mono font-bold text-sm">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Local Outbox Inspection */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-bold text-white">
            <Wifi className="w-4 h-4 text-sky-400" />
            <h3>Local Outbox Queue ({outboxEntries.length})</h3>
          </div>
          {outboxEntries.length > 0 && (
            <button
              onClick={handleClearOutbox}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {outboxEntries.length > 0 ? (
          <div className="space-y-2">
            {outboxEntries.map(e => (
              <div key={e.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                <div>
                  <span className="font-mono text-sky-400 font-semibold">{e.operation}</span>
                  <span className="text-slate-300 ml-2">{e.table_name}</span>
                  <span className="text-[10px] text-slate-500 block">ID: {e.id}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  Retries: {e.retry_count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Outbox is clear. All local changes are synchronized.</p>
        )}
      </div>
    </div>
  );
};
