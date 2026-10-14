import React from 'react';

// Ubicació de cada posició al camp (en %), atacant cap amunt: la dreta del jugador és la dreta de la pantalla
const POSITION_SPOTS: Record<string, { x: number; y: number }> = {
  'Portero': { x: 50, y: 91 },
  'Lateral Derecho': { x: 82, y: 70 },
  'Lateral Izquierdo': { x: 18, y: 70 },
  'Defensa Central': { x: 50, y: 74 },
  'Carrilero Derecho': { x: 86, y: 52 },
  'Carrilero Izquierdo': { x: 14, y: 52 },
  'Pivote Defensivo': { x: 50, y: 59 },
  'Mediocentro': { x: 50, y: 47 },
  'Mediapunta': { x: 50, y: 34 },
  'Extremo Derecho': { x: 82, y: 25 },
  'Extremo Izquierdo': { x: 18, y: 25 },
  'Delantero Centro': { x: 50, y: 13 },
  'Segundo Delantero': { x: 50, y: 23 }
};

interface PositionPitchProps {
  position?: string | null;
  secondaryPosition?: string | null;
  className?: string;
}

/** Mini camp amb la posició principal (punt taronja) i l'alternativa (cercle buit). */
export const PositionPitch: React.FC<PositionPitchProps> = ({ position, secondaryPosition, className = '' }) => {
  const main = position ? POSITION_SPOTS[position] : undefined;
  const alt = secondaryPosition && secondaryPosition !== position ? POSITION_SPOTS[secondaryPosition] : undefined;
  const label = [
    main ? `Posició principal: ${position}` : 'Posició sense definir',
    alt ? `alternativa: ${secondaryPosition}` : null
  ].filter(Boolean).join(', ');

  return (
    <svg viewBox="0 0 68 105" role="img" aria-label={label} className={className}>
      <rect width="68" height="105" rx="3" fill="#1d6b47" />
      {/* Franges de la gespa */}
      {[0, 2, 4, 6, 8].map((i) => (
        <rect key={i} x="0" y={i * 10.5} width="68" height="10.5" fill="#ffffff" opacity="0.035" />
      ))}
      <g fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.6">
        <rect x="3" y="3" width="62" height="99" />
        <line x1="3" y1="52.5" x2="65" y2="52.5" />
        <circle cx="34" cy="52.5" r="9.15" />
        <rect x="13.85" y="3" width="40.3" height="16.5" />
        <rect x="24.85" y="3" width="18.3" height="5.5" />
        <rect x="13.85" y="85.5" width="40.3" height="16.5" />
        <rect x="24.85" y="96.5" width="18.3" height="5.5" />
      </g>
      {alt && (
        <circle cx={(alt.x / 100) * 68} cy={(alt.y / 100) * 105} r="4.2" fill="none" stroke="#ffffff" strokeWidth="1.4" />
      )}
      {main && (
        <>
          <circle cx={(main.x / 100) * 68} cy={(main.y / 100) * 105} r="7" fill="#ff6600" opacity="0.25" />
          <circle cx={(main.x / 100) * 68} cy={(main.y / 100) * 105} r="4.2" fill="#ff6600" stroke="#ffffff" strokeWidth="1" />
        </>
      )}
    </svg>
  );
};
