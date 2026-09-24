import React, { useState } from 'react';
import { Star } from 'lucide-react';
import clsx from 'clsx';

interface StarRatingProps {
  rating?: number; // 0 to 5 (or 1 to 5)
  onChange?: (rating: number) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  readOnly?: boolean;
  showValue?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating = 0,
  onChange,
  size = 'sm',
  readOnly = false,
  showValue = false,
  theme = 'light',
  className = ''
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const starSizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const currentRating = hoverRating !== null ? hoverRating : rating;

  const handleStarClick = (val: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly || !onChange) return;
    // Si pulsa la misma estrella que ya tiene, se deselecciona a 0
    if (rating === val) {
      onChange(0);
    } else {
      onChange(val);
    }
  };

  return (
    <div className={clsx('inline-flex items-center gap-1 select-none', className)}>
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => !readOnly && setHoverRating(null)}
      >
        {[1, 2, 3, 4, 5].map((starValue) => {
          const isFilled = starValue <= currentRating;
          return (
            <button
              key={starValue}
              type="button"
              disabled={readOnly}
              onClick={(e) => handleStarClick(starValue, e)}
              onMouseEnter={() => !readOnly && setHoverRating(starValue)}
              className={clsx(
                'transition-all duration-150 rounded-sm focus:outline-none focus:ring-1 focus:ring-amber-400 p-0.5',
                readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-125'
              )}
              title={readOnly ? `${rating} de 5 estrelles` : `Valorar amb ${starValue} ${starValue === 1 ? 'estrella' : 'estrelles'}`}
              aria-label={`${starValue} estrelles`}
            >
              <Star
                className={clsx(
                  starSizeClasses[size],
                  'transition-colors duration-150',
                  isFilled
                    ? 'text-amber-400 fill-amber-400 drop-shadow-[0_1px_2px_rgba(251,191,36,0.4)]'
                    : theme === 'dark'
                    ? 'text-slate-600 fill-slate-800/60'
                    : 'text-slate-300 fill-slate-100'
                )}
              />
            </button>
          );
        })}
      </div>

      {showValue && (
        <span
          className={clsx(
            'text-[11px] font-black ml-1',
            theme === 'dark' ? 'text-amber-300' : 'text-amber-600'
          )}
        >
          {rating > 0 ? `${rating}/5` : 'Sense valorar'}
        </span>
      )}
    </div>
  );
};
