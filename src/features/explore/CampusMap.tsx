/**
 * src/features/explore/CampusMap.tsx
 *
 * 100% Offline Vector Campus Map for UC San Diego (UCSD)
 * Featuring the Design and Innovation Building (DIB), Pepper Canyon, Price Center, and Geisel.
 * ZERO external tile API requests or network calls: renders directly via local vector geometry.
 */

import React, { useRef, useEffect, useState } from 'react';
import type { Building, Route } from '../../types';
import { Compass, ZoomIn, ZoomOut, RotateCw, MapPin, Layers } from 'lucide-react';

interface CampusMapProps {
  buildings: Building[];
  routes: Route[];
  selectedBuildingId?: string;
  onSelectBuilding: (id: string) => void;
  center?: [number, number];
  zoom?: number;
}

export const CampusMap: React.FC<CampusMapProps> = ({
  buildings,
  routes,
  selectedBuildingId,
  onSelectBuilding
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Map viewport state in meters relative to DIB ([32.8784, -117.2359])
  const [zoom, setZoom] = useState(1.1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Known UCSD vector landmarks in local meter offsets from DIB (0, 0)
  const ucsdVectorFeatures = [
    // 1. Pepper Canyon Amphitheater (Concentric terraced rings right next to DIB)
    { type: 'amphitheater', x: 25, y: -20, radius: 26 },
    // 2. Central Campus Trolley Station & Bridge
    { type: 'trolley', x: -35, y: -45, width: 22, height: 60 },
    // 3. Main Campus Pedestrian Walkway (connecting DIB north to Price Center and Geisel)
    {
      type: 'walkway',
      path: [
        [-5, -60],
        [5, 10],
        [20, 60],
        [-10, 120],
        [-40, 160]
      ]
    },
    // 4. Courtyard Plaza around DIB
    {
      type: 'plaza',
      polygon: [
        [-25, -25],
        [25, -25],
        [30, 30],
        [-20, 30]
      ]
    }
  ];

  // Render vector map onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Deep modern navy slate background
    ctx.fillStyle = '#080d1a';
    ctx.fillRect(0, 0, width, height);

    const scale = 2.4 * zoom;

    // Coordinate projection (local meters to screen pixels)
    const toScreen = (x: number, y: number) => ({
      x: width / 2 + (x - panX) * scale,
      y: height / 2 - (y - panY) * scale // Y goes up
    });

    // 1. Draw Subtle Grid Pattern
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 1;
    const gridStep = 20; // 20 meters
    for (let x = -200; x <= 200; x += gridStep) {
      const p1 = toScreen(x, -200);
      const p2 = toScreen(x, 200);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let y = -200; y <= 200; y += gridStep) {
      const p1 = toScreen(-200, y);
      const p2 = toScreen(200, y);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // 2. Draw DIB Plaza
    const plaza = ucsdVectorFeatures.find(f => f.type === 'plaza');
    if (plaza && plaza.polygon) {
      ctx.fillStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      plaza.polygon.forEach((pt, i) => {
        const sc = toScreen(pt[0], pt[1]);
        if (i === 0) ctx.moveTo(sc.x, sc.y);
        else ctx.lineTo(sc.x, sc.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 3. Draw Pepper Canyon Amphitheater Rings
    const amphi = ucsdVectorFeatures.find(f => f.type === 'amphitheater');
    if (amphi && amphi.radius) {
      const center = toScreen(amphi.x, amphi.y);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 2;
      [0.4, 0.7, 1.0].forEach(rRatio => {
        ctx.beginPath();
        ctx.arc(center.x, center.y, amphi.radius * scale * rRatio, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // 4. Draw Main Campus Walkway Path
    const walkway = ucsdVectorFeatures.find(f => f.type === 'walkway');
    if (walkway && walkway.path) {
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
      ctx.lineWidth = 8 * zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      walkway.path.forEach((pt, i) => {
        const sc = toScreen(pt[0], pt[1]);
        if (i === 0) ctx.moveTo(sc.x, sc.y);
        else ctx.lineTo(sc.x, sc.y);
      });
      ctx.stroke();
    }

    // 5. Draw Saved User Navigation Routes (if any)
    routes.forEach(route => {
      if (!route.geojson || !Array.isArray(route.geojson.coordinates)) return;
      const coords = route.geojson.coordinates;
      if (coords.length < 2) return;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();

      coords.forEach((coord: [number, number], idx: number) => {
        // Approximate projection relative to DIB
        const relX = (coord[0] - (-117.2359)) * 111000 * Math.cos((32.8784 * Math.PI) / 180);
        const relY = (coord[1] - 32.8784) * 111000;
        const pt = toScreen(relX, relY);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });

      ctx.stroke();
      ctx.setLineDash([]);
    });

    // 6. Draw UCSD Buildings with interactive pins & footprints
    const buildingPositions: Record<string, [number, number]> = {
      'b-dib': [0, 5],
      'b-geisel': [-35, 140],
      'b-price-center': [25, 65]
    };

    buildings.forEach(b => {
      const isSelected = b.id === selectedBuildingId;
      const pos = buildingPositions[b.id] || [0, 0];
      const sc = toScreen(pos[0], pos[1]);

      // Building footprint box
      const bw = b.id === 'b-dib' ? 42 : b.id === 'b-geisel' ? 48 : 36;
      const bh = b.id === 'b-dib' ? 32 : b.id === 'b-geisel' ? 38 : 30;

      ctx.fillStyle = isSelected
        ? 'rgba(14, 165, 233, 0.25)'
        : 'rgba(30, 41, 59, 0.8)';
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#64748b';
      ctx.lineWidth = isSelected ? 3 : 1.5;

      ctx.beginPath();
      ctx.roundRect(
        sc.x - (bw * scale) / 2,
        sc.y - (bh * scale) / 2,
        bw * scale,
        bh * scale,
        6
      );
      ctx.fill();
      ctx.stroke();

      // Pin marker & text label
      ctx.font = 'bold 12px system-ui, sans-serif';
      const label = b.id === 'b-dib' ? 'DIB (Design & Innovation)' : b.name.replace(' (UCSD)', '');
      const textWidth = ctx.measureText(label).width;

      // Label background pill
      ctx.fillStyle = isSelected ? '#0284c7' : '#0f172a';
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(sc.x - textWidth / 2 - 8, sc.y - 12, textWidth + 16, 24, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, sc.x, sc.y);

      // Primary tag indicator below
      if (b.id === 'b-dib') {
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('Makerspace · Design Lab · Level 1-4', sc.x, sc.y + 20);
      }
    });
  }, [buildings, routes, selectedBuildingId, zoom, panX, panY]);

  // Click handler to select buildings
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const buildingPositions: Record<string, [number, number]> = {
      'b-dib': [0, 5],
      'b-geisel': [-35, 140],
      'b-price-center': [25, 65]
    };

    const scale = 2.4 * zoom;
    for (const b of buildings) {
      const pos = buildingPositions[b.id] || [0, 0];
      const screenX = canvas.width / 2 + (pos[0] - panX) * scale;
      const screenY = canvas.height / 2 - (pos[1] - panY) * scale;

      const dist = Math.hypot(clickX - screenX, clickY - screenY);
      if (dist < 40) {
        onSelectBuilding(b.id);
        break;
      }
    }
  };

  // Drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    const scale = 2.4 * zoom;
    setPanX(x => x - dx / scale);
    setPanY(y => y + dy / scale);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(2.5, Math.max(0.6, z - e.deltaY * 0.002)));
  };

  return (
    <div className="relative w-full h-full min-h-[340px] bg-slate-950 overflow-hidden">
      {/* 100% Offline Vector Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Offline Status Badge */}
      <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl px-3 py-1.5 shadow-lg flex items-center space-x-2 pointer-events-none">
        <Compass className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-xs font-bold text-white">UCSD Vector Campus Map</span>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
          0 API Calls
        </span>
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-3 right-3 flex flex-col space-y-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-1.5 shadow-lg">
        <button
          onClick={() => setZoom(z => Math.min(2.5, z + 0.25))}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.6, z - 0.25))}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1.1);
            setPanX(0);
            setPanY(0);
          }}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="Center on DIB"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Campus Location Indicator */}
      <div className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 pointer-events-none">
        Centered on Design & Innovation Building (Pepper Canyon)
      </div>
    </div>
  );
};
