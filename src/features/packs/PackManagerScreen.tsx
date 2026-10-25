/**
 * src/features/packs/PackManagerScreen.tsx
 *
 * Offline Campus Pack management interface:
 * - Shows installed pack version and release timestamp
 * - Storage quota breakdown (used vs free)
 * - Wi-Fi only download toggle
 * - Download progress bar with live file counter
 */

import React, { useEffect, useState } from 'react';
import { packManager, PackDownloadProgress } from '../../offline/packManager';
import { checkStorageQuota, StorageQuotaInfo, formatBytes, requestPersistentStorage } from '../../offline/storage';
import {
  DownloadCloud,
  CheckCircle2,
  HardDrive,
  Wifi,
  Shield,
  Layers,
  MapPin,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export const PackManagerScreen: React.FC = () => {
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageQuotaInfo | null>(null);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [progress, setProgress] = useState<PackDownloadProgress>({
    status: 'idle',
    totalBytes: 0,
    downloadedBytes: 0,
    percent: 0,
    currentFile: ''
  });

  const loadInfo = async () => {
    const ver = await packManager.getInstalledPackVersion();
    setInstalledVersion(ver);
    const quota = await checkStorageQuota();
    setStorageInfo(quota);
  };

  useEffect(() => {
    loadInfo();
    const unsub = packManager.subscribe(setProgress);
    return () => unsub();
  }, []);

  const handleDownload = async () => {
    await packManager.downloadAndInstallPack('/packs/campus-pack-v1');
    await loadInfo();
  };

  const handleRequestPersist = async () => {
    await requestPersistentStorage();
    await loadInfo();
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto space-y-6 pb-20">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Offline Campus Packs</h1>
        <p className="text-xs text-slate-400 mt-1">
          Download vector floorplans, room databases, and pathways so the app functions in basements and spotty Wi-Fi dead zones.
        </p>
      </div>

      {/* Current Installed Pack Card */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <DownloadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Central Campus Bundle</h2>
              <span className="text-xs text-slate-400">
                {installedVersion ? `Installed version ${installedVersion}` : 'No offline pack installed'}
              </span>
            </div>
          </div>

          {installedVersion ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Offline Ready</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
              Action Required
            </span>
          )}
        </div>

        {/* Contents Checklist */}
        <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Interactive SVG Floor Plans</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Searchable Room Numbers</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Accessible Pathway Routes</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Community Reviews Snapshot</span>
          </div>
        </div>

        {/* Wi-Fi Only Toggle */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-300">
            <Wifi className="w-4 h-4 text-slate-400" />
            <span>Download over Wi-Fi only</span>
          </div>
          <button
            onClick={() => setWifiOnly(!wifiOnly)}
            className={`w-10 h-5 flex items-center rounded-full p-1 transition duration-300 ${
              wifiOnly ? 'bg-sky-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <div className="w-3.5 h-3.5 bg-white rounded-full shadow-md transform" />
          </button>
        </div>

        {/* Progress Bar */}
        {(progress.status === 'downloading' || progress.status === 'installing') && (
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 capitalize">{progress.status}...</span>
              <span className="text-sky-400 font-bold">{progress.percent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block truncate">
              {progress.currentFile}
            </span>
          </div>
        )}

        {/* Download / Update Trigger */}
        <div className="pt-2">
          <button
            onClick={handleDownload}
            disabled={progress.status === 'downloading' || progress.status === 'installing'}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-sky-600/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${progress.status === 'downloading' ? 'animate-spin' : ''}`} />
            <span>
              {installedVersion ? 'Check For Pack Updates' : 'Download Campus Pack (284 KB)'}
            </span>
          </button>
        </div>
      </div>

      {/* Storage & Persistence Status */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center space-x-2 text-sm font-bold text-white">
          <HardDrive className="w-4 h-4 text-sky-400" />
          <h2>Device Storage Quota</h2>
        </div>

        {storageInfo && (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Browser Quota Used</span>
              <span className="text-white font-medium">
                {formatBytes(storageInfo.usageBytes)} / {formatBytes(storageInfo.quotaBytes)} ({storageInfo.percentUsed}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.max(2, storageInfo.percentUsed)}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="flex items-center space-x-1.5 text-slate-300">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Persistent Storage Protection</span>
              </div>
              <span className={storageInfo.isPersisted ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {storageInfo.isPersisted ? 'Granted' : 'Standard'}
              </span>
            </div>

            {!storageInfo.isPersisted && (
              <button
                onClick={handleRequestPersist}
                className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition mt-2"
              >
                Request Eviction Protection
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
