/**
 * src/features/building/BuildingDetailScreen.tsx
 *
 * Full building overview including:
 * - Interactive vector floorplan viewer with room search & highlight
 * - Real-time crowd level reporting (45m TTL)
 * - Offline-first reviews & tips
 * - Quick check-in action
 * - Accessibility notes & hours
 */

import React, { useEffect, useState } from 'react';
import { repo } from '../../db/repo';
import type { Building, Floor, Room, Review, Tip } from '../../types';
import { FloorPlanViewer } from './FloorPlanViewer';
import { CrowdReportWidget } from './CrowdReportWidget';
import { ReviewList } from './ReviewList';
import { AddReviewModal } from './AddReviewModal';
import {
  ArrowLeft,
  Clock,
  Compass,
  MapPin,
  ShieldCheck,
  Star,
  Plus,
  CheckCircle,
  Lightbulb,
  Wifi,
  Zap,
  Coffee,
  Printer
} from 'lucide-react';

interface BuildingDetailScreenProps {
  buildingId: string;
  onBack: () => void;
  userId: string;
  userName: string;
  initialTargetRoom?: string;
}

export const BuildingDetailScreen: React.FC<BuildingDetailScreenProps> = ({
  buildingId,
  onBack,
  userId,
  userName,
  initialTargetRoom
}) => {
  const [building, setBuilding] = useState<Building | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [newTipText, setNewTipText] = useState('');
  const [isAddingTip, setIsAddingTip] = useState(false);

  const loadData = async () => {
    const b = await repo.getBuildingById(buildingId);
    if (!b) return;
    setBuilding(b);

    const fls = await repo.getFloorsForBuilding(buildingId);
    setFloors(fls);
    if (fls.length > 0 && !selectedFloorId) {
      setSelectedFloorId(fls[0].id);
    }

    const rms = await repo.searchRooms('', buildingId);
    setRooms(rms);

    const revs = await repo.getReviewsForBuilding(buildingId);
    setReviews(revs);

    const tps = await repo.getTipsForBuilding(buildingId);
    setTips(tps);
  };

  useEffect(() => {
    loadData();
  }, [buildingId]);

  const handleCheckIn = async () => {
    await repo.addCheckIn(buildingId, userId);
    setCheckedIn(true);
    setTimeout(() => setCheckedIn(false), 3000);
  };

  const handleAddTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTipText.trim()) return;

    await repo.addTip({
      building_id: buildingId,
      user_id: userId,
      user_name: userName,
      text: newTipText.trim()
    });
    setNewTipText('');
    setIsAddingTip(false);
    const updated = await repo.getTipsForBuilding(buildingId);
    setTips(updated);
  };

  const handleDeleteReview = async (id: string) => {
    await repo.deleteReview(id);
    const updated = await repo.getReviewsForBuilding(buildingId);
    setReviews(updated);
  };

  if (!building) {
    return (
      <div className="p-6 text-center text-slate-400">
        <p>Loading building details...</p>
      </div>
    );
  }

  const averageStars = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.stars, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* Header bar */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Campus Map</span>
        </button>

        <button
          onClick={handleCheckIn}
          disabled={checkedIn}
          className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-400 border border-emerald-500/30 transition disabled:opacity-70"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>{checkedIn ? 'Checked In!' : 'Check In'}</span>
        </button>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Title & Metadata */}
        <div>
          <div className="flex items-start justify-between">
            <h1 className="text-xl font-bold text-white tracking-tight">{building.name}</h1>
            {averageStars && (
              <div className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{averageStars}</span>
                <span className="text-slate-500 text-[10px]">({reviews.length})</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
            <div className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{building.hours}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Compass className="w-3.5 h-3.5 text-slate-500" />
              <span>Navigability: {building.navigability}/5</span>
            </div>
          </div>

          {/* Amenities & Tags */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {building.amenities.map(a => (
              <span key={a} className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs capitalize flex items-center space-x-1">
                <span>{a.replace('_', ' ')}</span>
              </span>
            ))}
          </div>

          {building.accessibility_notes && (
            <div className="mt-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{building.accessibility_notes}</span>
            </div>
          )}
        </div>

        {/* Realtime Crowd Status */}
        <CrowdReportWidget buildingId={building.id} userId={userId} />

        {/* Floor Plan Explorer */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Floor Plans & Rooms</h2>
            <span className="text-xs text-slate-500">Tap any room to route</span>
          </div>

          {floors.length > 0 ? (
            <FloorPlanViewer
              floors={floors}
              rooms={rooms}
              selectedFloorId={selectedFloorId}
              onSelectFloor={setSelectedFloorId}
              targetRoomNumber={initialTargetRoom}
            />
          ) : (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
              No vector floor plans available for this facility yet.
            </div>
          )}
        </div>

        {/* Student Quick Tips */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Student Pro-Tips</h2>
            </div>
            <button
              onClick={() => setIsAddingTip(!isAddingTip)}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
            >
              {isAddingTip ? 'Cancel' : '+ Add Tip'}
            </button>
          </div>

          {isAddingTip && (
            <form onSubmit={handleAddTip} className="mb-3 space-y-2">
              <input
                type="text"
                value={newTipText}
                onChange={e => setNewTipText(e.target.value)}
                placeholder="e.g. Best quiet carrel is on the 2nd floor north corner..."
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newTipText.trim()}
                  className="px-3 py-1 rounded bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  Post Tip
                </button>
              </div>
            </form>
          )}

          {tips.length > 0 ? (
            <div className="space-y-2">
              {tips.map(t => (
                <div key={t.id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs flex items-start space-x-2">
                  <span className="text-amber-400 font-bold">“</span>
                  <div>
                    <p className="text-slate-300">{t.text}</p>
                    <span className="text-[10px] text-slate-500 mt-1 block">— {t.user_name}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No student tips posted yet.</p>
          )}
        </div>

        {/* Reviews Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Reviews & Feedback ({reviews.length})
            </h2>
            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Write Review</span>
            </button>
          </div>

          <ReviewList
            reviews={reviews}
            currentUserId={userId}
            onDeleteReview={handleDeleteReview}
          />
        </div>
      </div>

      <AddReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        buildingId={building.id}
        userId={userId}
        userName={userName}
        onReviewAdded={loadData}
      />
    </div>
  );
};
