/**
 * src/features/routes/RoutesScreen.tsx
 *
 * Standalone offline navigation routes and video-scanned pathways.
 * Zero external API requirement: reads and writes directly to local Dexie IndexedDB.
 */

import React, { useEffect, useState } from 'react';
import { repo } from '../../db/repo';
import type { Route } from '../../types';
import { VideoPathStudio } from '../videonav/VideoPathStudio';
import {
  Compass,
  Footprints,
  ShieldCheck,
  Video,
  Trash2,
  Sparkles,
  Plus
} from 'lucide-react';

export const RoutesScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'routes' | 'video-studio'>('video-studio');
  const [routes, setRoutes] = useState<Route[]>([]);

  const loadRoutes = async () => {
    const list = await repo.getRoutes();
    setRoutes(list);
    // If routes exist, user can view them; if 0, default to video studio
    if (list.length > 0 && activeTab === 'routes') {
      setActiveTab('routes');
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  const handleClearAllRoutes = async () => {
    if (confirm('Clear all routes from your local database so you can start fresh?')) {
      await repo.clearRoutes();
      await loadRoutes();
    }
  };

  const handleDeleteSingleRoute = async (id: string) => {
    await repo.deleteRoute(id);
    await loadRoutes();
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto space-y-5 pb-20">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Navigation & Video 3D Modeler</h1>
          <p className="text-xs text-slate-400 mt-1">
            100% offline local database · Zero external API calls required.
          </p>
        </div>

        {/* Tab Switcher & Clear Button */}
        <div className="flex items-center space-x-2">
          {routes.length > 0 && (
            <button
              onClick={handleClearAllRoutes}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-300 text-xs font-semibold flex items-center space-x-1.5 transition"
              title="Clear all stored routes to start fresh"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Routes</span>
            </button>
          )}

          <div className="flex items-center space-x-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
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
          </div>
        </div>
      </div>

      {/* View Content */}
      {activeTab === 'video-studio' ? (
        <VideoPathStudio
          onRouteSaved={() => {
            loadRoutes();
            setActiveTab('routes');
          }}
        />
      ) : (
        <div className="space-y-3">
          {routes.map(r => (
            <div key={r.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-white">{r.name}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-semibold flex items-center space-x-1">
                    <Sparkles className="w-3 h-3" />
                    <span>3D Indoor Model</span>
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {r.accessible && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>ADA Step-Free</span>
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteSingleRoute(r.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                    title="Delete route"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-xs text-slate-400">
                <div className="flex items-center space-x-1">
                  <Footprints className="w-3.5 h-3.5 text-sky-400" />
                  <span>{r.distance_meters} meters</span>
                </div>
                <span>·</span>
                <span>Indoor Corridor Pathway</span>
              </div>
            </div>
          ))}

          {routes.length === 0 && (
            <div className="p-12 text-center bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl space-y-3">
              <Footprints className="w-8 h-8 text-slate-600 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-white">Precached Routes Cleared</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Your pathways list is completely empty and ready for your video uploads.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('video-studio')}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition"
              >
                Upload Video in 3D Modeler
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
