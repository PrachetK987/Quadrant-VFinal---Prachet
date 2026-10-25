/**
 * src/features/videonav/VideoPathStudio.tsx
 *
 * Full-featured Video Walkthrough to 3D Navigation Path Studio.
 * Upgraded with Gemma 3D Neural Scene Synthesis & Open-Source OpenStreetMap Integration:
 * 1. Upload .mov (or other video)
 * 2. Transcode / Convert to standard .mp4 with download option
 * 3. Computer Vision optical flow & motion trajectory analysis
 * 4. Gemma 3D Building Synthesis fusing OSM 3D footprints + video walkthrough
 * 5. WebGL2 hardware-accelerated 3D architectural viewer (Aerial Orbit & 1st-Person POV)
 * 6. One-click commit to offline Dexie routes & delta sync outbox
 */

import React, { useState, useRef } from 'react';
import { VideoConverter, ConversionProgress } from './videoConverter';
import { VideoPathAnalyzer, VideoAnalysisResult, AnalysisProgress } from './videoAnalyzer';
import { Gemma3DModeler, Campus3DScene } from '../../ai/gemma3DModeler';
import { WebGL3DViewer } from './WebGL3DViewer';
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
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Building,
  Check
} from 'lucide-react';

interface VideoPathStudioProps {
  onRouteSaved?: () => void;
}

export const VideoPathStudio: React.FC<VideoPathStudioProps> = ({ onRouteSaved }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [mp4Url, setMp4Url] = useState<string | null>(null);

  // Conversion, Analysis & 3D Synthesis state
  const [conversionProgress, setConversionProgress] = useState<ConversionProgress | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [gemmaScene, setGemmaScene] = useState<Campus3DScene | null>(null);
  const [isSynthesizing3D, setIsSynthesizing3D] = useState(false);

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
    setGemmaScene(null);

    const isMov = file.name.toLowerCase().endsWith('.mov') || file.type.includes('quicktime');
    const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    setRouteName(defaultName || 'Library Walkway 3D Model');

    if (isMov) {
      // 1. Transcode .mov to .mp4
      try {
        const { url } = await VideoConverter.convertMovToMp4(file, progress => {
          setConversionProgress(progress);
        });

        setMp4Url(url);
        setVideoSrc(url);
        runVideoAnalysis(url);
      } catch (err) {
        console.warn('Transcoding fallback to direct video stream:', err);
        const directUrl = URL.createObjectURL(file);
        setVideoSrc(directUrl);
        runVideoAnalysis(directUrl);
      }
    } else {
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

      // 2. Synthesize 3D Building Scene via Gemma + OpenStreetMap Data
      setIsSynthesizing3D(true);
      const scene3D = await Gemma3DModeler.synthesize3DScene(result.trajectory, 'b-library');
      setGemmaScene(scene3D);
      setIsSynthesizing3D(false);
    } catch (err: any) {
      console.error('Video analysis failed:', err);
      alert('Video analysis failed: ' + err.message);
      setIsSynthesizing3D(false);
    }
  };

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

  const handleDownloadMp4 = () => {
    if (!mp4Url) return;
    const a = document.createElement('a');
    a.href = mp4Url;
    a.download = `${routeName.replace(/\s+/g, '_')}_converted.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
            <p className="text-xs text-slate-400 max-w-md mb-4">
              Gemma converts the video, reads open-source OpenStreetMap building footprints, and synthesizes 3D architectural models with synchronized walkthrough navigation.
            </p>
            <span className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition">
              Browse .mov / Video File
            </span>
          </label>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <FileVideo className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">{selectedFile?.name || 'Walkthrough Video'}</span>
              <span className="text-[11px] text-slate-400">
                {selectedFile && `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`} · Converted to .mp4
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

      {/* Transcoding Progress */}
      {conversionProgress && conversionProgress.status === 'converting' && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center space-x-2">
              <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
              <span>Transcoding .mov to standard .mp4 container...</span>
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

      {/* Frame Analysis Progress */}
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

      {/* Gemma 3D Building Synthesis Banner */}
      {isSynthesizing3D && (
        <div className="p-4 bg-sky-950/40 border border-sky-800/60 rounded-xl flex items-center space-x-3 text-xs text-sky-200">
          <Sparkles className="w-5 h-5 text-sky-400 animate-spin" />
          <div>
            <span className="font-bold block">Gemma Neural 3D Building Reconstruction</span>
            <span className="text-sky-300/80">Extruding OSM building footprints, floor plates, and aligning video coordinates...</span>
          </div>
        </div>
      )}

      {/* Main Dual Synchronized Workspace: Video + High-Fidelity 3D WebGL Viewer */}
      {videoSrc && analysisResult && gemmaScene && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. Synchronized Video Player */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xl">
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
                  className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm border border-white/20 transition-transform active:scale-95 shadow-2xl"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
              </div>

              {/* Scrubber Bar */}
              <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={e => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>{currentTime.toFixed(1)}s / {duration.toFixed(1)}s</span>
                  <span>Video Synchronized View</span>
                </div>
              </div>
            </div>

            {/* 2. High-Fidelity WebGL 3D Architectural Scene */}
            <WebGL3DViewer
              scene={gemmaScene}
              currentTimeSec={currentTime}
              durationSec={duration}
              onSeek={handleSeek}
            />
          </div>

          {/* Gemma Scene Synthesis Analysis Card */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Gemma 3D Scene Synthesis (OpenStreetMap Fused)
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">
                {gemmaScene.summary.totalVertices.toLocaleString()} Vertices · {gemmaScene.summary.buildingsSynthesized} 3D Buildings
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded-lg border border-slate-800/80">
              {gemmaScene.summary.gemmaReasoning}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Distance</span>
                <span className="text-base font-mono font-bold text-white">{analysisResult.totalDistanceMeters}m</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Grade / Incline</span>
                <span className="text-base font-mono font-bold text-white">{analysisResult.inclinePct}%</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Accessibility</span>
                <span className="text-xs font-bold text-emerald-400 mt-1 block">
                  {analysisResult.accessible ? 'ADA Step-Free' : 'Requires Stairs'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Indoor Ratio</span>
                <span className="text-base font-mono font-bold text-sky-400">
                  {Math.round(gemmaScene.summary.indoorRatio * 100)}%
                </span>
              </div>
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
