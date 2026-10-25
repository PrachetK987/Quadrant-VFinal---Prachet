/**
 * src/features/videonav/VideoPathStudio.tsx
 *
 * Full-featured Video Walkthrough to 3D Navigation Path Studio.
 * Workflow:
 * 1. Upload .mov (or other video)
 * 2. Transcode / Convert to standard .mp4 with download option
 * 3. Computer Vision optical flow & motion trajectory analysis
 * 4. Dual synchronized 3D Model + Video Player
 * 5. One-click commit to offline Dexie routes & delta sync outbox
 */

import React, { useState, useRef, useEffect } from 'react';
import { VideoConverter, ConversionProgress } from './videoConverter';
import { VideoPathAnalyzer, VideoAnalysisResult, AnalysisProgress } from './videoAnalyzer';
import { PathModelVisualizer } from './PathModelVisualizer';
import { repo } from '../../db/repo';
import {
  UploadCloud,
  FileVideo,
  Play,
  Pause,
  Download,
  CheckCircle,
  Footprints,
  Compass,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Check
} from 'lucide-react';

interface VideoPathStudioProps {
  onRouteSaved?: () => void;
}

export const VideoPathStudio: React.FC<VideoPathStudioProps> = ({ onRouteSaved }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [mp4Blob, setMp4Blob] = useState<Blob | null>(null);
  const [mp4Url, setMp4Url] = useState<string | null>(null);

  // Conversion & Analysis state
  const [conversionProgress, setConversionProgress] = useState<ConversionProgress | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);

  // Playback state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Save to routes state
  const [routeName, setRouteName] = useState('New Video Campus Path');
  const [isSaved, setIsSaved] = useState(false);

  // Handle video upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsSaved(false);
    setAnalysisResult(null);

    const isMov = file.name.toLowerCase().endsWith('.mov') || file.type.includes('quicktime');
    const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    setRouteName(defaultName || 'Scanned Campus Walkway');

    if (isMov) {
      // 1. Transcode .mov to .mp4
      try {
        const { blob, url } = await VideoConverter.convertMovToMp4(file, progress => {
          setConversionProgress(progress);
        });

        setMp4Blob(blob);
        setMp4Url(url);
        setVideoSrc(url);

        // 2. Analyze video motion & build 3D trajectory
        runVideoAnalysis(url);
      } catch (err) {
        console.warn('Direct transcoding error, falling back to direct video decoding:', err);
        const directUrl = URL.createObjectURL(file);
        setVideoSrc(directUrl);
        runVideoAnalysis(directUrl);
      }
    } else {
      // Already an MP4 or standard video
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setMp4Url(url);
      runVideoAnalysis(url);
    }
  };

  const runVideoAnalysis = async (url: string) => {
    try {
      const result = await VideoPathAnalyzer.analyzeVideoPath(url, 37.8724, -122.2595, progress => {
        setAnalysisProgress(progress);
      });
      setAnalysisResult(result);
    } catch (err: any) {
      console.error('Video analysis failed:', err);
      alert('Video analysis failed: ' + err.message);
    }
  };

  // Video playback controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (newTime: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Download converted MP4
  const handleDownloadMp4 = () => {
    if (!mp4Url) return;
    const a = document.createElement('a');
    a.href = mp4Url;
    a.download = `${routeName.replace(/\s+/g, '_')}_converted.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Save generated path to Quadrant local Dexie DB + Outbox
  const handleSaveRoute = async () => {
    if (!analysisResult) return;

    await repo.addRoute({
      campus_id: 'c-berkeley-central',
      user_id: 'user-pilot-maya',
      name: routeName,
      geojson: analysisResult.geoJson.geometry,
      distance_meters: Math.round(analysisResult.totalDistanceMeters),
      accessible: analysisResult.accessible
    });

    setIsSaved(true);
    onRouteSaved?.();
  };

  return (
    <div className="space-y-6">
      {/* File Upload Header */}
      {!videoSrc ? (
        <div className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-2xl p-8 text-center bg-slate-900/60 transition group">
          <input
            type="file"
            accept=".mov,video/quicktime,video/mp4,video/*"
            id="video-upload"
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              Select or Drop Campus Walkthrough Video (.mov / .mp4)
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              Apple QuickTime (.mov) files are automatically transcoded to .mp4, analyzed frame-by-frame, and converted into an interactive 3D navigation path.
            </p>
            <span className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition">
              Browse .mov / Video File
            </span>
          </label>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <FileVideo className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">{selectedFile?.name || 'Walkthrough Video'}</span>
              <span className="text-[10px] text-slate-400">
                {selectedFile && `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`} · Converted to H.264/MP4
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {mp4Url && (
              <button
                onClick={handleDownloadMp4}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export .mp4</span>
              </button>
            )}

            <label
              htmlFor="video-upload-replace"
              className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Replace Video
            </label>
            <input
              type="file"
              accept=".mov,video/quicktime,video/mp4,video/*"
              id="video-upload-replace"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Progress Bars for Transcoding & Analysis */}
      {conversionProgress && conversionProgress.status === 'converting' && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center space-x-2">
              <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
              <span>Transcoding .mov to .mp4 container...</span>
            </span>
            <span className="text-sky-400 font-mono font-bold">{conversionProgress.progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all duration-150"
              style={{ width: `${conversionProgress.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {analysisProgress && analysisProgress.status !== 'done' && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              <span>{analysisProgress.stageMessage}</span>
            </span>
            <span className="text-emerald-400 font-mono font-bold">{analysisProgress.percent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-150"
              style={{ width: `${analysisProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Dual Synchronized Workspace */}
      {videoSrc && analysisResult && (
        <div className="space-y-6">
          {/* Dual Split: Video Player + 3D Visual Navigation Model */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. Video Player */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between">
              <div className="relative bg-black aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={videoSrc}
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                />

                <button
                  onClick={togglePlay}
                  className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm border border-white/20 transition-transform active:scale-95"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
              </div>

              {/* Scrubber Bar */}
              <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={0.1}
                    value={currentTime}
                    onChange={e => handleSeek(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>{currentTime.toFixed(1)}s / {duration.toFixed(1)}s</span>
                  <span>Video Synchronized View</span>
                </div>
              </div>
            </div>

            {/* 2. Interactive 3D Visual Navigation Model */}
            <div className="flex flex-col">
              <PathModelVisualizer
                trajectory={analysisResult.trajectory}
                currentTimeSec={currentTime}
                durationSec={duration}
                onSeek={handleSeek}
              />
            </div>
          </div>

          {/* Path Intelligence Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Distance</span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-xl font-mono font-bold text-white">{analysisResult.totalDistanceMeters}</span>
                <span className="text-xs text-slate-400">meters</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Elevation Change</span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-xl font-mono font-bold text-white">+{analysisResult.elevationGainMeters}</span>
                <span className="text-xs text-slate-400">m ({analysisResult.inclinePct}% grade)</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Accessibility</span>
              <div className="flex items-center space-x-1.5 mt-1.5">
                {analysisResult.accessible ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400">ADA Accessible</span>
                  </>
                ) : (
                  <span className="text-xs font-bold text-amber-400">Stairs / Steep Incline</span>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Landmarks</span>
              <span className="text-xs font-bold text-sky-400 mt-1 block">
                {analysisResult.landmarksDetected.length > 0
                  ? `${analysisResult.landmarksDetected.length} Detected`
                  : 'Clear Corridor'}
              </span>
            </div>
          </div>

          {/* Commit & Save to Campus Navigation */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-auto flex-1">
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Route Name</label>
              <input
                type="text"
                value={routeName}
                onChange={e => setRouteName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              onClick={handleSaveRoute}
              disabled={isSaved}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition ${
                isSaved
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Added to Offline Database!</span>
                </>
              ) : (
                <>
                  <Footprints className="w-4 h-4" />
                  <span>Save Path to Campus Map</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
