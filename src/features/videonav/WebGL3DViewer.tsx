/**
 * src/features/videonav/WebGL3DViewer.tsx
 *
 * High-Fidelity 3D Indoor Architectural WebGL Renderer for UCSD DIB:
 * - Direct WebGL2 accelerated interior rendering of turning corridors, walls, doors, and ceilings
 * - First-Person Walkthrough POV smoothly turning around corners and bends
 * - Architectural Dollhouse Cutaway Mode (isometric bird's-eye view with ceiling removed)
 * - Multi-Level Building Floor Selection (Level 1, 2, 3, 4)
 * - Detailed glass studio windows, structural concrete columns, and room placards
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
  MapPin,
  Building
} from 'lucide-react';

interface WebGL3DViewerProps {
  scene: Campus3DScene;
  currentTimeSec: number;
  durationSec: number;
  onSeek?: (timeSec: number) => void;
  onSelectLevel?: (level: number) => void;
  className?: string;
}

export const WebGL3DViewer: React.FC<WebGL3DViewerProps> = ({
  scene,
  currentTimeSec,
  durationSec,
  onSeek,
  onSelectLevel,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraMode, setCameraMode] = useState<'first_person' | 'dollhouse'>('first_person');
  const [showCeiling, setShowCeiling] = useState(false);

  // Dollhouse orbit camera state
  const [yaw, setYaw] = useState(30);
  const [pitch, setPitch] = useState(48);
  const [distance, setDistance] = useState(26);

  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Find active waypoint for current video time
  const currentWaypointIndex = scene.fusedTrajectory.findIndex(
    wp => wp.timeSec >= currentTimeSec
  );
  const activeIdx = Math.max(0, currentWaypointIndex === -1 ? scene.fusedTrajectory.length - 1 : currentWaypointIndex);
  const currentWaypoint: PathWaypoint3D = scene.fusedTrajectory[activeIdx] || {
    x: 0,
    y: 0,
    z: scene.floorElevationZ + 1.65,
    headingDeg: 0,
    timeSec: 0
  };

  // Next waypoint for forward camera look vector
  const nextWaypoint: PathWaypoint3D = scene.fusedTrajectory[Math.min(scene.fusedTrajectory.length - 1, activeIdx + 2)] || currentWaypoint;

  // Detect closest room based on distance
  const nearbyRoom = scene.rooms.find(r => {
    const dx = r.doorPosition[0] - currentWaypoint.x;
    const dy = r.doorPosition[1] - currentWaypoint.y;
    return Math.hypot(dx, dy) < 4.0;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) {
      console.warn('WebGL not supported on this browser');
      return;
    }

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

        vec3 norm = normalize(aNormal);
        float diffuse = max(dot(norm, uLightDirection), 0.0);
        float ambient = 0.60; // Bright, clean interior lighting
        vLight = ambient + diffuse * 0.40;
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

    // Ceiling light vector
    gl.uniform3f(uLightLoc, 0.1, 0.2, 0.96);

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
    const glassBuffers = createMeshBuffers(scene.indoorGlassWindowsMesh);
    const columnsBuffers = createMeshBuffers(scene.indoorColumnsMesh);
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
      gl.clearColor(0.07, 0.09, 0.14, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const aspect = canvas.width / canvas.height;
      const projMat = Mat4.create();
      Mat4.perspective(projMat, (62 * Math.PI) / 180, aspect, 0.2, 250.0);
      gl.uniformMatrix4fv(uProjLoc, false, projMat);

      const viewMat = Mat4.create();

      if (cameraMode === 'first_person' && currentWaypoint) {
        // Camera positioned at eye level
        const eyeX = currentWaypoint.x;
        const eyeY = currentWaypoint.y;
        const eyeZ = currentWaypoint.z || (scene.floorElevationZ + 1.65);

        // Forward look vector follows the path curve
        const dx = nextWaypoint.x - eyeX;
        const dy = nextWaypoint.y - eyeY;
        const len = Math.hypot(dx, dy) || 1;
        const forwardDist = 5.5;

        let targetX = eyeX + (dx / len) * forwardDist;
        let targetY = eyeY + (dy / len) * forwardDist;
        let targetZ = eyeZ;

        // If at the very end of the path, look forward along current heading
        if (Math.hypot(dx, dy) < 0.2) {
          const rad = (currentWaypoint.headingDeg * Math.PI) / 180;
          targetX = eyeX + Math.sin(rad) * forwardDist;
          targetY = eyeY + Math.cos(rad) * forwardDist;
        }

        Mat4.lookAt(viewMat, [eyeX, eyeY, eyeZ], [targetX, targetY, targetZ], [0, 0, 1]);
      } else {
        // Dollhouse Isometric Cutaway from above
        const radYaw = (yaw * Math.PI) / 180;
        const radPitch = (pitch * Math.PI) / 180;

        const targetX = currentWaypoint ? currentWaypoint.x : 0;
        const targetY = currentWaypoint ? currentWaypoint.y : 15;
        const targetZ = scene.floorElevationZ + 1.6;

        const eyeX = targetX + distance * Math.cos(radPitch) * Math.sin(radYaw);
        const eyeY = targetY - distance * Math.cos(radPitch) * Math.cos(radYaw);
        const eyeZ = targetZ + distance * Math.sin(radPitch);

        Mat4.lookAt(viewMat, [eyeX, eyeY, eyeZ], [targetX, targetY, targetZ], [0, 0, 1]);
      }

      gl.uniformMatrix4fv(uViewLoc, false, viewMat);

      // 1. Draw Path-Extruded Floor
      drawMesh(floorBuffers);

      // 2. Draw Turning Corridor Walls & Baseboards
      drawMesh(wallsBuffers);

      // 3. Draw Glass Studio Window Panels
      drawMesh(glassBuffers);

      // 4. Draw Structural Concrete Columns
      drawMesh(columnsBuffers);

      // 5. Draw Doors & Room Placards
      drawMesh(doorsBuffers);

      // 6. Draw Floor Guidance Ribbon
      drawMesh(pathBuffers);

      // 7. Draw Ceiling if enabled or in 1st-person POV
      if (showCeiling || cameraMode === 'first_person') {
        drawMesh(ceilingBuffers);
      }
    };

    render();
  }, [scene, currentTimeSec, cameraMode, showCeiling, yaw, pitch, distance, currentWaypoint, nextWaypoint]);

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
    setDistance(d => Math.min(70, Math.max(8, d + e.deltaY * 0.05)));
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

      {/* Top Left: Floor Level Selector */}
      <div className="absolute top-3 left-3 flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-1 shadow-xl">
        <span className="text-[11px] font-bold text-slate-400 px-2 flex items-center space-x-1">
          <Building className="w-3.5 h-3.5 text-sky-400" />
          <span>Floor:</span>
        </span>
        {[1, 2, 3, 4].map(lvl => (
          <button
            key={lvl}
            onClick={() => onSelectLevel && onSelectLevel(lvl)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              scene.floorLevel === lvl
                ? 'bg-sky-500 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            L{lvl}
          </button>
        ))}
      </div>

      {/* Top Right: View Modes */}
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
          <span>{cameraMode === 'first_person' ? '1st-Person POV' : 'Dollhouse Cutaway'}</span>
        </button>

        {cameraMode === 'dollhouse' && (
          <button
            onClick={() => setShowCeiling(!showCeiling)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition ${
              showCeiling ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showCeiling ? 'Ceiling On' : 'Cutaway'}</span>
          </button>
        )}

        <button
          onClick={() => {
            setYaw(30);
            setPitch(48);
            setDistance(26);
          }}
          className="p-1 rounded text-slate-400 hover:text-white"
          title="Reset Camera"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Active Door / Room Proximity Alert HUD */}
      {nearbyRoom && (
        <div className="absolute top-14 left-3 bg-sky-950/95 backdrop-blur border border-sky-500/50 rounded-xl px-3.5 py-2 text-xs text-white shadow-xl flex items-center space-x-2 animate-fade-in pointer-events-none">
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
            <Compass className="w-4 h-4" />
            <span className="font-mono font-bold text-white">
              Heading: {currentWaypoint ? `${currentWaypoint.headingDeg}°` : '0°'}
            </span>
          </div>

          <div className="h-3 w-px bg-slate-800" />

          <div className="text-slate-400 text-xs">
            Path Position:{' '}
            <span className="font-mono text-slate-200">
              X:{currentWaypoint.x.toFixed(1)}m Y:{currentWaypoint.y.toFixed(1)}m
            </span>
          </div>

          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
            Level {scene.floorLevel}
          </span>
        </div>

        <div className="bg-slate-900/85 backdrop-blur border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-400 shadow">
          {cameraMode === 'first_person' ? 'Following Turns & Bends' : 'Drag to Orbit · Scroll to Zoom'}
        </div>
      </div>
    </div>
  );
};
