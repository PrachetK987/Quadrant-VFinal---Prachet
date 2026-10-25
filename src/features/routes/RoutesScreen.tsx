/**
 * src/features/routes/RoutesScreen.tsx
 *
 * Campus paths and accessible navigation routes with built-in
 * Video Walkthrough 3D Scanner (.mov -> .mp4 converter + motion modeler).
 */

import React, { useEffect, useState } from 'react';
import { repo } from '../../db/repo';
import type { Route } from '../../types';
import { VideoPathStudio } from '../videonav/VideoPathStudio';
import { Compass, Footprints, ShieldCheck, Video, MapPin, Plus, Sparkles } from 'lucide-react';

export const RoutesScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'routes' | 'video-studio'>('routes');
  const [routes, setRoutes] = useState<Route[]>([]);

  const loadRoutes = () => {
    repo.getRoutes().then(setRoutes);
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto space-y-5 pb-20">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Campus Navigation Pathways</h1>
          <p className="text-xs text-slate-400 mt-1">
            Pre-cached accessible outdoor and indoor pedestrian routes across campus.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('routes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === 'routes'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Footprints className="w-3.5 h-3.5" />
            <span>Pathways ({routes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('video-studio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTab === 'video-studio'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-amber-300" />
            <span>Video 3D Modeler</span>
          </button>
        </div>
      </div>

      {/* View Content */}
      {activeTab === 'video-studio' ? (
        <VideoPathStudio
          onRouteSaved={() => {
            loadRoutes();
          }}
        />
      ) : (
        <div className="space-y-3">
          {routes.map(r => (
            <div key={r.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-white">{r.name}</h3>
                  {r.name.includes('Video') && (
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-semibold flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span>3D Scanned</span>
                    </span>
                  )}
                </div>

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
                <span>Smooth surface paved / indoor concourse</span>
              </div>
            </div>
          ))}

          {routes.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs">
              No route lines recorded yet. Switch to the <b>Video 3D Modeler</b> tab to upload a walkthrough video!
            </div>
          )}
        </div>
      )}
    </div>
  );
};
