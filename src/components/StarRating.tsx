import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  max?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (value: number) => void;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  max = 5,
  size = 16,
  interactive = false,
  onChange
}) => {
  return (
    <div className="flex items-center space-x-1">
      {Array.from({ length: max }, (_, i) => i + 1).map(star => {
        const isFilled = star <= value;
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange && onChange(star)}
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition`}
          >
            <Star
              size={size}
              className={`${
                isFilled
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-600 fill-transparent'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};
