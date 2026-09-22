import React from 'react';
import clsx from 'clsx';

export interface JerseyBadgeProps {
  number?: number | string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'kit' | 'pill' | 'number-only' | 'card';
  color?: 'blue' | 'orange' | 'dark' | 'white';
  className?: string;
  showLabel?: boolean;
}

export const JerseyBadge: React.FC<JerseyBadgeProps> = ({
  number,
  size = 'md',
  variant = 'pill',
  color = 'blue',
  className,
  showLabel = false
}) => {
  const displayNum = number !== undefined && number !== null && number !== '' ? number : '-';

  // Variant: Number Only (El número en 3D puro como en la foto de la camiseta)
  if (variant === 'number-only') {
    const sizeClasses = {
      xs: 'text-base',
      sm: 'text-xl',
      md: 'text-3xl',
      lg: 'text-5xl',
      xl: 'text-7xl'
    }[size];

    return (
      <div className={clsx('relative inline-flex items-center justify-center font-jersey', className)}>
        <span className={clsx('jersey-number-3d select-none tracking-tight', sizeClasses)}>
          {displayNum}
        </span>
        {/* Micro-perforación / punto oficial en la base del dorsal (como en la foto oficial) */}
        {displayNum !== '-' && (size === 'lg' || size === 'xl') && (
          <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#061338] border border-white/40 shadow-inner" />
        )}
      </div>
    );
  }

  // Variant: Mini Kit (Samarreta de futbol amb el dorsal estampat al darrere)
  if (variant === 'kit') {
    const kitSizes = {
      xs: { container: 'w-7 h-8 rounded-md', num: 'text-xs', collar: 'w-2.5 h-1' },
      sm: { container: 'w-9 h-10 rounded-lg', num: 'text-base', collar: 'w-3 h-1.5' },
      md: { container: 'w-12 h-14 rounded-xl', num: 'text-2xl', collar: 'w-4 h-2' },
      lg: { container: 'w-16 h-20 rounded-2xl', num: 'text-4xl', collar: 'w-6 h-2.5' },
      xl: { container: 'w-24 h-28 rounded-3xl', num: 'text-6xl', collar: 'w-8 h-3.5' }
    }[size];

    const bgGradient =
      color === 'orange'
        ? 'jersey-badge-kit-orange'
        : 'jersey-badge-kit';

    return (
      <div
        className={clsx(
          'relative flex flex-col items-center justify-center overflow-hidden transition-transform duration-200 hover:scale-105 select-none shadow-md',
          kitSizes.container,
          bgGradient,
          className
        )}
        title={`Dorsal ${displayNum}`}
      >
        {/* Cuello de la camiseta */}
        <div
          className={clsx(
            'absolute top-0 rounded-b-full bg-white/20 border-b border-white/30',
            kitSizes.collar
          )}
        />
        {/* Número 3D */}
        <span className={clsx('jersey-number-3d mt-1', kitSizes.num)}>
          {displayNum}
        </span>
        {/* Detalle inferior */}
        {showLabel && size !== 'xs' && (
          <span className="text-[8px] font-black uppercase tracking-widest text-sky-200 mt-0.5 opacity-80">
            DORSAL
          </span>
        )}
      </div>
    );
  }

  // Variant: Card (Targeta de perfil esportiu amb textura de samarreta)
  if (variant === 'card') {
    return (
      <div
        className={clsx(
          'relative flex items-center gap-3 p-2.5 rounded-2xl jersey-badge-kit border border-white/20 shadow-md text-white select-none',
          className
        )}
      >
        <div className="relative flex items-center justify-center px-3 py-1 bg-black/20 rounded-xl border border-white/10">
          <span className="jersey-number-3d text-3xl">{displayNum}</span>
        </div>
        <div>
          <span className="text-[9px] font-black uppercase tracking-wider text-sky-300 block">
            DORSAL OFICIAL
          </span>
          <span className="text-xs font-bold text-white">Samarreta Titular</span>
        </div>
      </div>
    );
  }

  // Variant: Pill (Badget atlètic modern amb el número 3D i estil samarreta)
  const pillSizes = {
    xs: { wrap: 'px-2 py-0.5 gap-1', num: 'text-xs', label: 'text-[8px]' },
    sm: { wrap: 'px-2.5 py-1 gap-1.5', num: 'text-sm', label: 'text-[9px]' },
    md: { wrap: 'px-3 py-1.5 gap-2', num: 'text-lg', label: 'text-[10px]' },
    lg: { wrap: 'px-4 py-2 gap-2.5', num: 'text-2xl', label: 'text-xs' },
    xl: { wrap: 'px-5 py-2.5 gap-3', num: 'text-4xl', label: 'text-sm' }
  }[size];

  const pillColor =
    color === 'orange'
      ? 'bg-gradient-to-r from-orange-600 via-[#ff6600] to-amber-600 text-white border-orange-400/40 shadow-orange-950/20'
      : color === 'white'
      ? 'bg-white/15 text-white border-white/25 backdrop-blur-sm shadow-sm'
      : 'bg-gradient-to-r from-[#061338] via-[#002568] to-[#003db3] text-white border-blue-400/30 shadow-blue-950/30';

  return (
    <div
      className={clsx(
        'inline-flex items-center justify-center rounded-xl font-bold border shadow-sm select-none transition-all',
        pillSizes.wrap,
        pillColor,
        className
      )}
    >
      <span className={clsx('uppercase font-black tracking-wider text-sky-200/90', pillSizes.label)}>
        Dorsal
      </span>
      <span className={clsx('jersey-number-3d', pillSizes.num)}>
        {displayNum}
      </span>
    </div>
  );
};
