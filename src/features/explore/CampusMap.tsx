/**
 * src/features/explore/CampusMap.tsx
 *
 * Leaflet map with offline capabilities and vector markers.
 * Displays:
 * - Campus center & boundary
 * - Building interactive markers with crowd badges
 * - Accessible route overlays (GeoJSON)
 */

import React, { useEffect, useRef } from 'react';
import type { Building, Route } from '../../types';
import L from 'leaflet';

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
  onSelectBuilding,
  center = [37.8719, -122.2585],
  zoom = 16
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLayersRef = useRef<L.GeoJSON[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: false
    });

    // Dark-themed offline-friendly map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update building markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    buildings.forEach(b => {
      const isSelected = b.id === selectedBuildingId;

      // Custom SVG marker pin
      const iconHtml = `
        <div class="relative flex items-center justify-center transform -translate-x-1/2 -translate-y-full cursor-pointer transition-transform duration-200 ${
          isSelected ? 'scale-125 z-30' : 'hover:scale-110'
        }">
          <div class="px-2 py-1 rounded-md text-[10px] font-bold shadow-lg border whitespace-nowrap ${
            isSelected
              ? 'bg-sky-500 text-white border-white ring-2 ring-sky-300'
              : 'bg-slate-900 text-slate-100 border-slate-700'
          }">
            ${b.name.split(' ')[0]}
          </div>
          <div class="w-2.5 h-2.5 rotate-45 -mt-1 ${
            isSelected ? 'bg-sky-500' : 'bg-slate-900'
          }"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: iconHtml,
        iconSize: [0, 0]
      });

      const marker = L.marker([b.lat, b.lng], { icon: customIcon }).addTo(map);

      marker.on('click', () => {
        onSelectBuilding(b.id);
      });

      markersRef.current.set(b.id, marker);
    });
  }, [buildings, selectedBuildingId, onSelectBuilding]);

  // Update route lines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old routes
    routeLayersRef.current.forEach(layer => layer.remove());
    routeLayersRef.current = [];

    routes.forEach(route => {
      if (!route.geojson) return;

      const layer = L.geoJSON(route.geojson, {
        style: {
          color: route.accessible ? '#38bdf8' : '#94a3b8',
          weight: 4,
          opacity: 0.8,
          dashArray: '6, 8'
        }
      }).addTo(map);

      routeLayersRef.current.push(layer);
    });
  }, [routes]);

  // Center on selected building if changed
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedBuildingId) return;

    const b = buildings.find(x => x.id === selectedBuildingId);
    if (b) {
      map.flyTo([b.lat, b.lng], 17, { duration: 0.8 });
    }
  }, [selectedBuildingId, buildings]);

  return (
    <div className="relative w-full h-full min-h-[300px]">
      <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-slate-950" />
    </div>
  );
};
