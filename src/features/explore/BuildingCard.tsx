import React from 'react';
import type { Building } from '../../types';
import { Compass, Clock, ChevronRight, Layers, ShieldCheck } from 'lucide-react';

interface BuildingCardProps {
  building: Building;
  isSelected?: boolean;
  onSelect: () => void;
  onOpenDetails: () => void;
  crowdLevel?: 'quiet' | 'busy' | 'packed';
}

export const BuildingCard: React.FC<BuildingCardProps> = ({
  building,
  isSelected,
  onSelect,
  onOpenDetails,
  crowdLevel
}) => {
  const badgeColor = {
    quiet: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    busy: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    packed: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  };

  return (
    <div
      onClick={onSelect}
      className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
        isSelected
          ? 'bg-slate-800 border-sky-500 shadow-lg shadow-sky-500/10'
          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div>
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-bold text-white tracking-tight">{building.name}</h3>
          {crowdLevel && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${badgeColor[crowdLevel]}`}>
              {crowdLevel}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 mt-1.5 text-xs text-slate-400">
          <div className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{building.hours}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>{building.floors_count} floors</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-2.5">
          {building.amenities.slice(0, 3).map(a => (
            <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 capitalize">
              {a.replace('_', ' ')}
            </span>
          ))}
          {building.amenities.length > 3 && (
            <span className="text-[10px] px-1 py-0.5 text-slate-500">
              +{building.amenities.length - 3} more
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">Wayfinding: {building.navigability}/5</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails();
          }}
          className="flex items-center space-x-1 text-xs font-semibold text-sky-400 hover:text-sky-300"
        >
          <span>Floor Plans & Reviews</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
