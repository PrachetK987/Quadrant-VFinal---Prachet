import React from 'react';
import type { Review } from '../../types';
import { StarRating } from '../../components/StarRating';
import { User, MessageSquare } from 'lucide-react';

interface ReviewListProps {
  reviews: Review[];
  currentUserId: string;
  onDeleteReview?: (id: string) => void;
}

export const ReviewList: React.FC<ReviewListProps> = ({ reviews, currentUserId, onDeleteReview }) => {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-4">
        <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No reviews yet for this building.</p>
        <p className="text-xs text-slate-500 mt-1">Be the first to post a review! It saves offline immediately.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map(rev => {
        const isOwn = rev.user_id === currentUserId;
        const formattedDate = new Date(rev.updated_at).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        return (
          <div key={rev.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">{rev.user_name}</span>
                    {isOwn && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 font-semibold">
                        You
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">{formattedDate}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <StarRating value={rev.stars} size={14} />
                {isOwn && onDeleteReview && (
                  <button
                    onClick={() => onDeleteReview(rev.id)}
                    className="text-xs text-rose-400 hover:text-rose-300 ml-2"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{rev.text}</p>

            {rev.tags && rev.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {rev.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
