import React from 'react';
import type { PlayerStatus } from '../../types/models';

interface BadgeProps {
  status?: PlayerStatus | string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold' | 'accent';
  children?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, variant, children, className = '' }) => {
  let styleClass = 'bg-slate-100 text-slate-700 border-slate-200';

  const text = children || status;

  if (status) {
    switch (status) {
      case 'Seleccionado':
        styleClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
        break;
      case 'Preseleccionado':
        styleClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
        break;
      case 'Observado':
        styleClass = 'bg-sky-50 text-sky-700 border-sky-200 font-bold';
        break;
      case 'Candidato':
        styleClass = 'bg-slate-100 text-slate-600 border-slate-200';
        break;
      case 'Lesionado':
        styleClass = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
        break;
      case 'Planificada':
      case 'Convocado':
      case 'Confirmado':
        styleClass = 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
        break;
      default:
        break;
    }
  } else if (variant) {
    switch (variant) {
      case 'accent':
        styleClass = 'bg-[#ff6600] text-white border-transparent font-bold shadow-sm';
        break;
      case 'success':
        styleClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
        break;
      case 'warning':
        styleClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
        break;
      case 'danger':
        styleClass = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
        break;
      case 'info':
        styleClass = 'bg-blue-50 text-blue-700 border-blue-200 font-bold';
        break;
      case 'gold':
        styleClass = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
        break;
    }
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styleClass} ${className}`}
    >
      {text}
    </span>
  );
};
