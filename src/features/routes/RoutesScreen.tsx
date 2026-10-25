/**
 * src/features/routes/RoutesScreen.tsx
 *
 * Campus paths and accessible navigation routes.
 */

import React, { useEffect, useState } from 'react';
import { repo } from '../../db/repo';
import type { Route } from '../../types';
import { Compass, Footprints, ShieldCheck, MapPin, Plus } from 'lucide-react';

export const RoutesScreen: React.FC = () => {
  const [routes, setRoutes] = useState<Route[]>([]);

  useEffect(() => {
    repo.getRoutes().then(setRoutes);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto space-y-4 pb-20">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Campus Navigation Pathways</h1>
        <p className="text-xs text-slate-400 mt-1">
          Pre-cached accessible outdoor and indoor pedestrian routes across campus.
        </p>
      </div>

      <div className="space-y-3">
        {routes.map(r => (
          <div key={r.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">{r.name}</h3>
              {r.accessible && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>ADA Step-Free</span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3 text-xs text-slate-400">
              <div className="flex items-center space-x-1">
                <Footprints className="w-3.5 h-3.5 text-sky-400" />
                <span>{r.distance_meters} meters</span>
              </div>
              <span>·</span>
              <span>Smooth surface paved</span>
            </div>
          </div>
        ))}

        {routes.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs">
            No route lines recorded yet. Download the campus pack to view default campus routes.
          </div>
        )}
      </div>
    </div>
  );
};
