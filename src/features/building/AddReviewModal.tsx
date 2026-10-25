import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { StarRating } from '../../components/StarRating';
import { repo } from '../../db/repo';

interface AddReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingId: string;
  userId: string;
  userName: string;
  onReviewAdded: () => void;
}

export const AddReviewModal: React.FC<AddReviewModalProps> = ({
  isOpen,
  onClose,
  buildingId,
  userId,
  userName,
  onReviewAdded
}) => {
  const [stars, setStars] = useState(5);
  const [navigability, setNavigability] = useState(5);
  const [text, setText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Quiet']);
  const [submitting, setSubmitting] = useState(false);

  const availableTags = ['Quiet', 'Outlets', 'AC / Heating', 'Good Lighting', 'Whiteboards', 'Fast Wi-Fi', 'Restrooms Nearby'];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setSubmitting(true);
    try {
      await repo.addReview({
        building_id: buildingId,
        user_id: userId,
        user_name: userName,
        stars,
        navigability,
        text,
        tags: selectedTags
      });
      setText('');
      onReviewAdded();
      onClose();
    } catch (err) {
      console.error('Error adding review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Building Review">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Star Rating */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Overall Experience</label>
          <StarRating value={stars} size={22} interactive onChange={setStars} />
        </div>

        {/* Navigability Rating */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Navigability & Wayfinding (How easy is it to find rooms?)
          </label>
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4, 5].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => setNavigability(num)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                  navigability === num
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {num}
              </button>
            ))}
            <span className="text-xs text-slate-400 ml-2">
              {navigability === 5 ? 'Crystal clear' : navigability >= 3 ? 'Average' : 'Confusing'}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {availableTags.map(tag => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    active
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Review Text */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Review & Tips for Fellow Students</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            required
            placeholder="Share which floors are best, outlet locations, or quiet corners..."
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-xs font-semibold shadow transition"
          >
            {submitting ? 'Saving...' : 'Post Review (Offline Ready)'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
