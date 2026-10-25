/**
 * src/features/building/FloorPlanViewer.tsx
 *
 * Interactive vector floorplan viewer.
 * Architecture Plan requirement:
 * "Floor plans: SVG, not images. Each room is an element with its room number as an id,
 * so 'Room 214' can be searched, highlighted and routed to."
 */

import React, { useEffect, useState, useRef } from 'react';
import type { Floor, Room } from '../../types';
import { Search, Layers, Compass, ZoomIn, ZoomOut, CheckCircle } from 'lucide-react';

interface FloorPlanViewerProps {
  floors: Floor[];
  rooms: Room[];
  selectedFloorId?: string;
  onSelectFloor: (floorId: string) => void;
  targetRoomNumber?: string;
}

export const FloorPlanViewer: React.FC<FloorPlanViewerProps> = ({
  floors,
  rooms,
  selectedFloorId,
  onSelectFloor,
  targetRoomNumber
}) => {
  const currentFloor = floors.find(f => f.id === selectedFloorId) || floors[0];
  const [svgContent, setSvgContent] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>(targetRoomNumber || '');
  const [zoom, setZoom] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch or load SVG from Cache Storage / Static Assets
  useEffect(() => {
    if (!currentFloor?.floorplan_svg_path) return;

    let isMounted = true;
    fetch(currentFloor.floorplan_svg_path)
      .then(res => {
        if (!res.ok) throw new Error('SVG not found');
        return res.text();
      })
      .then(text => {
        if (isMounted) setSvgContent(text);
      })
      .catch(err => {
        console.warn('[FloorPlanViewer] Could not fetch SVG:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [currentFloor]);

  // Handle room clicks and highlights inside the SVG DOM
  useEffect(() => {
    if (!containerRef.current || !svgContent) return;

    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    const roomElements = svgElement.querySelectorAll('.room, [id^="room-"], [id^="restroom-"], [id^="elevator-"]');

    roomElements.forEach(el => {
      // Clean previous active state
      el.classList.remove('active');

      const elId = el.getAttribute('id') || '';
      const matchedRoom = rooms.find(r => r.svg_element_id === elId || elId.includes(r.room_number.toLowerCase()));

      // Highlight target search
      if (
        searchQuery &&
        matchedRoom &&
        (matchedRoom.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (matchedRoom.name && matchedRoom.name.toLowerCase().includes(searchQuery.toLowerCase())))
      ) {
        el.classList.add('active');
      }

      // Highlight selected room
      if (selectedRoom && matchedRoom && matchedRoom.id === selectedRoom.id) {
        el.classList.add('active');
      }

      // Add click listener
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (matchedRoom) {
          setSelectedRoom(matchedRoom);
        } else {
          setSelectedRoom({
            id: elId,
            floor_id: currentFloor.id,
            room_number: elId.replace('room-', '').toUpperCase(),
            name: elId.replace('-', ' '),
            type: 'facility',
            svg_element_id: elId,
            updated_at: new Date().toISOString()
          });
        }
      });
    });
  }, [svgContent, rooms, searchQuery, selectedRoom, currentFloor]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Floor Controls & Search Bar */}
      <div className="flex flex-wrap items-center justify-between p-3 bg-slate-950 border-b border-slate-800 gap-2">
        {/* Floor Level Selector */}
        <div className="flex items-center space-x-1">
          <Layers className="w-4 h-4 text-sky-400 mr-1" />
          {floors.map(floor => (
            <button
              key={floor.id}
              onClick={() => {
                onSelectFloor(floor.id);
                setSelectedRoom(null);
              }}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                currentFloor?.id === floor.id
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Floor {floor.level}
            </button>
          ))}
        </div>

        {/* Room Search Input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Find room (e.g. 214)..."
            className="pl-8 pr-3 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-44"
          />
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setZoom(z => Math.max(0.7, z - 0.15))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-slate-400 w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(2.0, z + 0.15))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative bg-slate-950/60 p-4 min-h-[320px] flex items-center justify-center overflow-auto">
        <div
          ref={containerRef}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease-out' }}
          className="w-full max-w-2xl"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />

        {/* Floor Highlights Badge */}
        {currentFloor?.highlights && currentFloor.highlights.length > 0 && (
          <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs max-w-xs shadow-lg">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Key Amenities</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {currentFloor.highlights.map(h => (
                <span key={h} className="px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800/60 text-sky-300 text-[10px]">
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected Room Details Drawer */}
      {selectedRoom && (
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between animate-fade-in">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-mono text-xs font-bold">
                Room {selectedRoom.room_number}
              </span>
              <span className="text-sm font-medium text-white">{selectedRoom.name || 'Campus Room'}</span>
            </div>
            <span className="text-xs text-slate-400 capitalize">
              Floor {currentFloor?.level} · {selectedRoom.type} space
            </span>
          </div>

          <button
            onClick={() => {
              setSearchQuery(selectedRoom.room_number);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Route Here</span>
          </button>
        </div>
      )}
    </div>
  );
};
