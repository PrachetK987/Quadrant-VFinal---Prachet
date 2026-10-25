/**
 * src/features/videonav/PathModelVisualizer.tsx
 *
 * Interactive 3D Visual Navigation Model.
 * Renders the reconstructed camera trajectory in 3D isometric perspective:
 * - 3D path ribbon with waypoint beacons
 * - Landmark indicators (Doorway, Turns, Elevation shifts)
 * - Synchronized live camera/walker beacon tied to video playback time
 * - Orbit, tilt, and zoom controls
 * - Distance and elevation profile HUD
 */

import React, { useEffect, useRef, useState } from 'react';
import type { PathWaypoint3D } from './videoAnalyzer';
import { Compass, RotateCw, ZoomIn, ZoomOut, Layers, Eye } from 'lucide-react';

interface PathModelVisualizerProps {
  trajectory: PathWaypoint3D[];
  currentTimeSec: number;
  durationSec: number;
  onSeek?: (timeSec: number) => void;
  className?: string;
}

export const PathModelVisualizer: React.FC<PathModelVisualizerProps> = ({
  trajectory,
  currentTimeSec,
  durationSec,
  onSeek,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotationAngle, setRotationAngle] = useState(35); // degrees yaw
  const [pitchAngle, setPitchAngle] = useState(55); // degrees pitch
  const [zoom, setZoom] = useState(1.0);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Find active waypoint closest to currentTimeSec
  const currentWaypoint = trajectory.reduce((prev, curr) => {
    return Math.abs(curr.timeSec - currentTimeSec) < Math.abs(prev.timeSec - currentTimeSec)
      ? curr
      : prev;
  }, trajectory[0] || { x: 0, y: 0, z: 0, headingDeg: 0, timeSec: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || trajectory.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Bounding box calculation for centering
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    trajectory.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    const spanX = Math.max(10, maxX - minX);
    const spanY = Math.max(10, maxY - minY);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const scale = (Math.min(width, height) / Math.max(spanX, spanY)) * 0.45 * zoom;

    const radYaw = (rotationAngle * Math.PI) / 180;
    const radPitch = (pitchAngle * Math.PI) / 180;

    // 3D Isometric projection function
    const project = (x: number, y: number, z: number) => {
      const relX = x - centerX;
      const relY = y - centerY;

      // Rotate around Z axis (Yaw)
      const rotX = relX * Math.cos(radYaw) - relY * Math.sin(radYaw);
      const rotY = relX * Math.sin(radYaw) + relY * Math.cos(radYaw);

      // Tilt around X axis (Pitch)
      const isoX = rotX;
      const isoY = rotY * Math.sin(radPitch) - z * 4 * Math.cos(radPitch);

      return {
        screenX: width / 2 + isoX * scale,
        screenY: height / 2 + isoY * scale
      };
    };

    // 1. Draw 3D Ground Grid Plane
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
    ctx.lineWidth = 1;
    const gridSize = 8;
    const gridSpan = Math.max(spanX, spanY) * 0.9;

    for (let i = -gridSize; i <= gridSize; i++) {
      const p1 = project(centerX + (i * gridSpan) / gridSize, centerY - gridSpan, 0);
      const p2 = project(centerX + (i * gridSpan) / gridSize, centerY + gridSpan, 0);
      ctx.beginPath();
      ctx.moveTo(p1.screenX, p1.screenY);
      ctx.lineTo(p2.screenX, p2.screenY);
      ctx.stroke();

      const p3 = project(centerX - gridSpan, centerY + (i * gridSpan) / gridSize, 0);
      const p4 = project(centerX + gridSpan, centerY + (i * gridSpan) / gridSize, 0);
      ctx.beginPath();
      ctx.moveTo(p3.screenX, p3.screenY);
      ctx.lineTo(p4.screenX, p4.screenY);
      ctx.stroke();
    }

    // 2. Draw Projected Ground Shadow of Path
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    trajectory.forEach((wp, idx) => {
      const proj = project(wp.x, wp.y, 0);
      if (idx === 0) ctx.moveTo(proj.screenX, proj.screenY);
      else ctx.lineTo(proj.screenX, proj.screenY);
    });
    ctx.stroke();

    // 3. Draw 3D Elevated Navigation Path Ribbon
    const pathGrad = ctx.createLinearGradient(0, height, width, 0);
    pathGrad.addColorStop(0, '#38bdf8'); // Sky blue
    pathGrad.addColorStop(0.5, '#818cf8'); // Indigo
    pathGrad.addColorStop(1, '#34d399'); // Emerald green

    ctx.strokeStyle = pathGrad;
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    trajectory.forEach((wp, idx) => {
      const proj = project(wp.x, wp.y, wp.z);
      if (idx === 0) ctx.moveTo(proj.screenX, proj.screenY);
      else ctx.lineTo(proj.screenX, proj.screenY);
    });
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // 4. Draw Waypoint Nodes and Landmark Tags
    trajectory.forEach((wp, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === trajectory.length - 1;
      const proj = project(wp.x, wp.y, wp.z);

      if (isStart || isEnd || wp.landmark || wp.isTurn) {
        // Vertical ground pin line
        const groundProj = project(wp.x, wp.y, 0);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(groundProj.screenX, groundProj.screenY);
        ctx.lineTo(proj.screenX, proj.screenY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Beacon dot
        ctx.fillStyle = isStart ? '#38bdf8' : isEnd ? '#34d399' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(proj.screenX, proj.screenY, isStart || isEnd ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();

        // Label pill
        const labelText = isStart
          ? 'START'
          : isEnd
          ? 'FINISH'
          : wp.landmark || 'Turn';

        ctx.font = '600 10px system-ui, sans-serif';
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(proj.screenX - textWidth / 2 - 5, proj.screenY - 22, textWidth + 10, 16, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isStart ? '#7dd3fc' : isEnd ? '#6ee7b7' : '#fcd34d';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, proj.screenX, proj.screenY - 10);
      }
    });

    // 5. Draw Animated Active Walker / Camera Pin synchronized with Video
    if (currentWaypoint) {
      const liveProj = project(currentWaypoint.x, currentWaypoint.y, currentWaypoint.z);

      // Glowing pulse ring
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(liveProj.screenX, liveProj.screenY, 11, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(liveProj.screenX, liveProj.screenY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Heading direction arrow
      const headingRad = ((currentWaypoint.headingDeg - rotationAngle) * Math.PI) / 180;
      const arrowX = liveProj.screenX + Math.sin(headingRad) * 18;
      const arrowY = liveProj.screenY - Math.cos(headingRad) * 18 * Math.sin(radPitch);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(liveProj.screenX, liveProj.screenY);
      ctx.lineTo(arrowX, arrowY);
      ctx.stroke();
    }
  }, [trajectory, currentTimeSec, rotationAngle, pitchAngle, zoom]);

  // Drag to orbit handler
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setRotationAngle(prev => (prev + dx * 0.6) % 360);
    setPitchAngle(prev => Math.min(85, Math.max(20, prev - dy * 0.4)));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className={`relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden ${className}`}>
      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        width={720}
        height={420}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-[320px] sm:h-[380px] cursor-grab active:cursor-grabbing block"
      />

      {/* Orbit Controls Overlay */}
      <div className="absolute top-3 right-3 flex flex-col space-y-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-1.5 shadow-lg">
        <button
          onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.6, z - 0.2))}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setRotationAngle(35);
            setPitchAngle(55);
            setZoom(1.0);
          }}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="Reset Orbit"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Real-time Status Telemetry HUD */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg px-3 py-1.5 text-xs flex items-center space-x-3 pointer-events-auto">
          <div className="flex items-center space-x-1 text-sky-400">
            <Compass className="w-3.5 h-3.5" />
            <span className="font-mono font-bold">{currentWaypoint?.headingDeg || 0}°</span>
          </div>
          <div className="text-slate-400 text-[11px]">
            Pos: <span className="text-slate-200 font-mono">X:{currentWaypoint?.x}m Y:{currentWaypoint?.y}m</span>
          </div>
          {currentWaypoint?.landmark && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
              {currentWaypoint.landmark}
            </span>
          )}
        </div>

        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg px-2.5 py-1 text-[10px] text-slate-400">
          Drag to Orbit 3D Model
        </div>
      </div>
    </div>
  );
};
