/**
 * src/features/videonav/WebGL3DViewer.tsx
 *
 * High-Fidelity 3D Indoor Architectural WebGL Renderer for UCSD Buildings:
 * - Direct WebGL2 accelerated interior rendering of hallways, walls, doors, and ceilings
 * - First-Person Walkthrough POV (camera walks down hallway matching video playback)
 * - Dollhouse Cutaway Mode (isometric bird's-eye view with ceiling removed)
 * - Room placard detection and active door highlights
 */

import React, { useEffect, useRef, useState } from 'react';
import { Mat4 } from './webglMath';
import type { Campus3DScene, Mesh3DGeometry } from '../../ai/gemma3DModeler';
import type { PathWaypoint3D } from './videoAnalyzer';
import {
  Compass,
  RotateCw,
  Eye,
  Layers,
  Sparkles,
  Maximize2,
  DoorOpen,
  MapPin
} from 'lucide-react';

interface WebGL3DViewerProps {
  scene: Campus3DScene;
  currentTimeSec: number;
  durationSec: number;
  onSeek?: (timeSec: number) => void;
  className?: string;
}

export const WebGL3DViewer: React.FC<WebGL3DViewerProps> = ({
  scene,
  currentTimeSec,
  durationSec,
  onSeek,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Default to First-Person POV for authentic indoor walkthrough!
  const [cameraMode, setCameraMode] = useState<'first_person' | 'dollhouse'>('first_person');
  const [showCeiling, setShowCeiling] = useState(false);

  // Dollhouse orbit camera state
  const [yaw, setYaw] = useState(0); // degrees
  const [pitch, setPitch] = useState(48); // degrees
  const [distance, setDistance] = useState(24); // meters
  const [panY, setPanY] = useState(15);

  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Find active waypoint for current video time
  const currentWaypoint: PathWaypoint3D = scene.fusedTrajectory.reduce((prev, curr) => {
    return Math.abs(curr.timeSec - currentTimeSec) < Math.abs(prev.timeSec - currentTimeSec)
      ? curr
      : prev;
  }, scene.fusedTrajectory[0] || { x: 0, y: 0, z: 1.65, headingDeg: 0, timeSec: 0 });

  // Detect closest room based on current Y distance along corridor
  const nearbyRoom = scene.rooms.find(r => Math.abs(r.doorPosition[1] - (currentWaypoint?.y || 0)) < 3.5);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) {
      console.warn('WebGL not supported on this browser');
      return;
    }

    // Shaders with interior soft ambient + overhead ceiling lighting
    const vsSource = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec3 aColor;

      uniform mat4 uProjection;
      uniform mat4 uView;
      uniform vec3 uLightDirection;

      varying vec3 vColor;
      varying float vLight;

      void main() {
        gl_Position = uProjection * uView * vec4(aPosition, 1.0);

        // Soft interior directional light from ceiling + warm bounce
        vec3 norm = normalize(aNormal);
        float diffuse = max(dot(norm, uLightDirection), 0.0);
        float ambient = 0.58; // High ambient illumination typical of lit indoor corridors
        vLight = ambient + diffuse * 0.42;
        vColor = aColor;
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec3 vColor;
      varying float vLight;

      void main() {
        gl_FragColor = vec4(vColor * vLight, 1.0);
      }
    `;

    const compileShader = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return shader;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    gl.useProgram(program);

    const aPositionLoc = gl.getAttribLocation(program, 'aPosition');
    const aNormalLoc = gl.getAttribLocation(program, 'aNormal');
    const aColorLoc = gl.getAttribLocation(program, 'aColor');

    const uProjLoc = gl.getUniformLocation(program, 'uProjection');
    const uViewLoc = gl.getUniformLocation(program, 'uView');
    const uLightLoc = gl.getUniformLocation(program, 'uLightDirection');

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // Overhead ceiling light vector (downward from Z+)
    gl.uniform3f(uLightLoc, 0.15, 0.25, 0.95);

    const createMeshBuffers = (mesh: Mesh3DGeometry) => {
      const posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

      const normBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);

      const colBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.colors, gl.STATIC_DRAW);

      const idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

      return {
        posBuf,
        normBuf,
        colBuf,
        idxBuf,
        count: mesh.indices.length
      };
    };

    const floorBuffers = createMeshBuffers(scene.indoorFloorMesh);
    const wallsBuffers = createMeshBuffers(scene.indoorWallsMesh);
    const ceilingBuffers = createMeshBuffers(scene.indoorCeilingMesh);
    const doorsBuffers = createMeshBuffers(scene.indoorDoorsMesh);
    const pathBuffers = createMeshBuffers(scene.pathMesh);

    const drawMesh = (buffers: any) => {
      if (buffers.count === 0) return;

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.posBuf);
      gl.enableVertexAttribArray(aPositionLoc);
      gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normBuf);
      gl.enableVertexAttribArray(aNormalLoc);
      gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.colBuf);
      gl.enableVertexAttribArray(aColorLoc);
      gl.vertexAttribPointer(aColorLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.idxBuf);
      gl.drawElements(gl.TRIANGLES, buffers.count, gl.UNSIGNED_SHORT, 0);
    };

    const render = () => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.08, 0.11, 0.16, 1.0); // Modern neutral interior background
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const aspect = canvas.width / canvas.height;
      const projMat = Mat4.create();
      Mat4.perspective(projMat, (60 * Math.PI) / 180, aspect, 0.2, 200.0);
      gl.uniformMatrix4fv(uProjLoc, false, projMat);

      const viewMat = Mat4.create();

      if (cameraMode === 'first_person' && currentWaypoint) {
        // First Person: Camera placed inside corridor at eye height (1.65m), looking down the hallway
        const eyeX = currentWaypoint.x;
        const eyeY = currentWaypoint.y;
        const eyeZ = 1.65;

        // Look 6 meters ahead along the corridor
        const targetX = eyeX;
        const targetY = eyeY + 6.0;
        const targetZ = 1.65;

        Mat4.lookAt(viewMat, [eyeX, eyeY, eyeZ], [targetX, targetY, targetZ], [0, 0, 1]);
      } else {
        // Dollhouse / Cutaway Isometric View from above
        const radYaw = (yaw * Math.PI) / 180;
        const radPitch = (pitch * Math.PI) / 180;

        const eyeX = distance * Math.cos(radPitch) * Math.sin(radYaw);
        const eyeY = (currentWaypoint ? currentWaypoint.y : panY) - distance * Math.cos(radPitch) * Math.cos(radYaw);
        const eyeZ = distance * Math.sin(radPitch);

        const targetY = currentWaypoint ? currentWaypoint.y : panY;
        Mat4.lookAt(viewMat, [eyeX, eyeY, eyeZ], [0, targetY, 1.6], [0, 0, 1]);
      }

      gl.uniformMatrix4fv(uViewLoc, false, viewMat);

      // 1. Draw Indoor Polished Floor
      drawMesh(floorBuffers);

      // 2. Draw Corridor Drywall Interior Walls & Baseboards
      drawMesh(wallsBuffers);

      // 3. Draw Wooden Doors, Aluminum Frames, and Room Placards
      drawMesh(doorsBuffers);

      // 4. Draw Indoor Guidance Path Ribbon on Floor
      drawMesh(pathBuffers);

      // 5. Draw Ceiling Grid if enabled or in 1st-person POV
      if (showCeiling || cameraMode === 'first_person') {
        drawMesh(ceilingBuffers);
      }
    };

    render();
  }, [scene, currentTimeSec, cameraMode, showCeiling, yaw, pitch, distance, panY]);

  // Dollhouse mouse controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (cameraMode === 'first_person') return;
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || cameraMode === 'first_person') return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setYaw(prev => (prev + dx * 0.5) % 360);
    setPitch(prev => Math.min(80, Math.max(15, prev - dy * 0.4)));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (cameraMode === 'first_person') return;
    e.preventDefault();
    setDistance(d => Math.min(60, Math.max(8, d + e.deltaY * 0.05)));
  };

  return (
    <div className={`relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl ${className}`}>
      {/* WebGL Canvas */}
      <canvas
        ref={canvasRef}
        width={960}
        height={520}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-[360px] sm:h-[440px] block cursor-grab active:cursor-grabbing"
      />

      {/* Top Left: UCSD Indoor Status Pill */}
      <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl px-3 py-1.5 shadow-xl flex items-center space-x-2">
        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-xs font-bold text-white">{scene.buildingName}</span>
        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
          Indoor {scene.corridorName}
        </span>
      </div>

      {/* Top Right: View Controls */}
      <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-1 shadow-xl">
        <button
          onClick={() => setCameraMode(m => m === 'first_person' ? 'dollhouse' : 'first_person')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
            cameraMode === 'first_person'
              ? 'bg-sky-500 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Toggle First-Person Eye-Level Walkthrough"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{cameraMode === 'first_person' ? '1st-Person Walkthrough' : 'Dollhouse Cutaway'}</span>
        </button>

        {cameraMode === 'dollhouse' && (
          <button
            onClick={() => setShowCeiling(!showCeiling)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition ${
              showCeiling ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showCeiling ? 'Ceiling On' : 'Cutaway (No Ceiling)'}</span>
          </button>
        )}

        <button
          onClick={() => {
            setYaw(0);
            setPitch(48);
            setDistance(24);
          }}
          className="p-1 rounded text-slate-400 hover:text-white"
          title="Reset Camera"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Active Door / Room Proximity Alert HUD */}
      {nearbyRoom && (
        <div className="absolute top-14 left-3 bg-sky-950/90 backdrop-blur border border-sky-500/50 rounded-xl px-3.5 py-2 text-xs text-white shadow-xl flex items-center space-x-2 animate-fade-in pointer-events-none">
          <DoorOpen className="w-4 h-4 text-sky-400 shrink-0" />
          <div>
            <span className="font-bold text-sky-300 block">Passing Room {nearbyRoom.roomNumber}</span>
            <span className="text-[11px] text-slate-300">{nearbyRoom.name}</span>
          </div>
        </div>
      )}

      {/* Bottom Telemetry HUD */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl px-3.5 py-2 text-xs flex items-center space-x-3 pointer-events-auto shadow-lg">
          <div className="flex items-center space-x-1.5 text-sky-400">
            <MapPin className="w-4 h-4" />
            <span className="font-mono font-bold text-white">
              Hallway Progress: {currentWaypoint ? `${currentWaypoint.y.toFixed(1)}m` : '0m'}
            </span>
          </div>

          <div className="h-3 w-px bg-slate-800" />

          <div className="text-slate-400 text-xs">
            Eye Level: <span className="text-slate-200 font-mono">1.65m</span>
          </div>

          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
            Level {scene.floorLevel}
          </span>
        </div>

        <div className="bg-slate-900/85 backdrop-blur border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-400 shadow">
          {cameraMode === 'first_person' ? 'Inside Corridor (Walking with Video)' : 'Drag to Orbit · Scroll to Zoom'}
        </div>
      </div>
    </div>
  );
};
