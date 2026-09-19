import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', gradient = false, ...props }) => {
  return (
    <div
      className={`rounded-2xl transition-all duration-200 ${
        gradient
          ? 'bg-gradient-to-br from-[#061338] via-[#002568] to-[#003db3] text-white shadow-xl shadow-blue-950/10 border border-blue-900/40'
          : 'bg-white border border-slate-200/90 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_25px_-4px_rgba(0,0,0,0.08)]'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
