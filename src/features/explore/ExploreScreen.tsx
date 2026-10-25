/**
 * src/features/explore/ExploreScreen.tsx
 *
 * Main campus discovery view combining:
 * - Search bar with filter chips (Quiet, Outlets, Open Now, Food)
 * - Split View: Interactive map on top, building carousel/cards on bottom
 * - Instant offline querying via repo.searchBuildings
 */

import React, { useEffect, useState } from 'react';
import { repo } from '../../db/repo';
import type { Building, Route } from '../../types';
import { CampusMap } from './CampusMap';
import { BuildingCard } from './BuildingCard';
import { Search, Filter, Compass, SlidersHorizontal } from 'lucide-react';

interface ExploreScreenProps {
  onOpenBuilding: (buildingId: string) => void;
}

export const ExploreScreen: React.FC<ExploreScreenProps> = ({ onOpenBuilding }) => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const [selectedAmenity, setSelectedAmenity] = useState<string | null>(null);
  const [crowdLevels, setCrowdLevels] = useState<Record<string, 'quiet' | 'busy' | 'packed'>>({});

  const filterChips = [
    { id: 'quiet', label: 'Quiet Study' },
    { id: 'outlets', label: 'Outlets' },
    { id: 'food', label: 'Food / Microwaves' },
    { id: 'printer', label: 'Printers' },
    { id: 'accessible_entrance', label: 'Accessible Entry' }
  ];

  const loadData = async () => {
    const amenities = selectedAmenity ? [selectedAmenity] : undefined;
    const list = await repo.searchBuildings({ query, amenities });
    setBuildings(list);

    if (list.length > 0 && !selectedBuildingId) {
      setSelectedBuildingId(list[0].id);
    }

    const rts = await repo.getRoutes();
    setRoutes(rts);

    // Load crowd levels
    const crowds: Record<string, 'quiet' | 'busy' | 'packed'> = {};
    for (const b of list) {
      const c = await repo.getLatestCrowdLevel(b.id);
      if (c) crowds[b.id] = c.level;
    }
    setCrowdLevels(crowds);
  };

  useEffect(() => {
    loadData();
  }, [query, selectedAmenity]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Search Header */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 space-y-2 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search buildings, tags, or amenities (e.g. outlets)..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            onClick={() => setSelectedAmenity(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              selectedAmenity === null
                ? 'bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            All Buildings
          </button>
          {filterChips.map(chip => (
            <button
              key={chip.id}
              onClick={() => setSelectedAmenity(selectedAmenity === chip.id ? null : chip.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedAmenity === chip.id
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout: Map + Scrollable Building Cards */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Map View */}
        <div className="h-64 md:h-full md:flex-1 relative">
          <CampusMap
            buildings={buildings}
            routes={routes}
            selectedBuildingId={selectedBuildingId}
            onSelectBuilding={setSelectedBuildingId}
          />
        </div>

        {/* Building List Sidebar */}
        <div className="flex-1 md:w-96 md:flex-none border-t md:border-t-0 md:border-l border-slate-800 bg-slate-950/80 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>{buildings.length} locations available offline</span>
            <span>Central Campus</span>
          </div>

          {buildings.map(building => (
            <BuildingCard
              key={building.id}
              building={building}
              isSelected={building.id === selectedBuildingId}
              onSelect={() => setSelectedBuildingId(building.id)}
              onOpenDetails={() => onOpenBuilding(building.id)}
              crowdLevel={crowdLevels[building.id]}
            />
          ))}

          {buildings.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs">
              No buildings matched your search criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
