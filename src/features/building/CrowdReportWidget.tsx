/**
 * src/features/building/CrowdReportWidget.tsx
 *
 * Real-time crowd level reporting and age monitoring.
 * Features:
 * - 45-minute TTL countdown
 * - 3 levels: Quiet, Busy, Packed
 * - Optimistic local submission with outbox queuing
 */

import React, { useEffect, useState } from 'react';
import { repo } from '../../db/repo';
import type { CrowdLevel } from '../../types';
import { Users, Clock, Check, Sparkles } from 'lucide-react';

interface CrowdReportWidgetProps {
  buildingId: string;
  userId: string;
}

export const CrowdReportWidget: React.FC<CrowdReportWidgetProps> = ({ buildingId, userId }) => {
  const [latest, setLatest] = useState<{ level: CrowdLevel; count: number; lastReportAt: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const loadCrowdStatus = async () => {
    const data = await repo.getLatestCrowdLevel(buildingId);
    setLatest(data);
  };

  useEffect(() => {
    loadCrowdStatus();
    const interval = setInterval(loadCrowdStatus, 30000);
    return () => clearInterval(interval);
  }, [buildingId]);

  const handleReport = async (level: CrowdLevel) => {
    setSubmitting(true);
    try {
      await repo.addCrowdReport({
        building_id: buildingId,
        user_id: userId,
        level
      });
      setJustSubmitted(true);
      await loadCrowdStatus();
      setTimeout(() => setJustSubmitted(false), 3000);
    } catch (err) {
      console.error('Failed to submit crowd report:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getAgeMinutes = (dateString?: string) => {
    if (!dateString) return null;
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
    return diff <= 0 ? 'just now' : `${diff}m ago`;
  };

  const badgeColor = {
    quiet: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    busy: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    packed: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-white">Live Crowd Level</h3>
        </div>

        {latest ? (
          <div className="flex items-center space-x-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${badgeColor[latest.level]}`}>
              {latest.level}
            </span>
            <div className="flex items-center text-[11px] text-slate-400">
              <Clock className="w-3 h-3 mr-1" />
              <span>{getAgeMinutes(latest.lastReportAt)}</span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-500">No recent reports (45m TTL)</span>
        )}
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Reports expire after 45 minutes to prevent stale data. How busy is it right now?
      </p>

      {/* Buttons */}
      <div className="grid grid-cols-3 gap-2">
        {(['quiet', 'busy', 'packed'] as CrowdLevel[]).map(level => {
          const isSelected = latest?.level === level;
          const label = level === 'quiet' ? 'Quiet 🟢' : level === 'busy' ? 'Moderate 🟡' : 'Packed 🔴';

          return (
            <button
              key={level}
              disabled={submitting}
              onClick={() => handleReport(level)}
              className={`py-2 px-2 rounded-lg text-xs font-semibold border transition flex flex-col items-center justify-center ${
                isSelected
                  ? 'bg-slate-800 border-sky-500 text-white shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
              } disabled:opacity-50`}
            >
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {justSubmitted && (
        <div className="mt-2.5 flex items-center justify-center space-x-1.5 text-xs text-emerald-400 animate-fade-in">
          <Check className="w-3.5 h-3.5" />
          <span>Report recorded offline and queued for sync!</span>
        </div>
      )}
    </div>
  );
};
