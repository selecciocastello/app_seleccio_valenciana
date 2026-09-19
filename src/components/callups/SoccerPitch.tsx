import React from 'react';
import type { Player } from '../../types/models';

interface SoccerPitchProps {
  players: Player[];
  formation?: '4-3-3' | '4-2-3-1' | '4-4-2';
  onPlayerClick?: (player: Player) => void;
}

export const SoccerPitch: React.FC<SoccerPitchProps> = ({ players, onPlayerClick }) => {
  // Agrupar jugadores por demarcación
  const porteros = players.filter((p) => p.position === 'Portero');
  const defensas = players.filter((p) =>
    p.position?.includes('Defensa') || p.position?.includes('Lateral')
  );
  const medios = players.filter((p) =>
    p.position?.includes('Medio') || p.position?.includes('Pivote') || p.position?.includes('Mediapunta')
  );
  const delanteros = players.filter((p) =>
    p.position?.includes('Delantero') || p.position?.includes('Extremo')
  );

  return (
    <div className="relative w-full aspect-[4/3] max-w-2xl mx-auto bg-gradient-to-b from-emerald-700 via-emerald-600 to-emerald-700 rounded-3xl p-4 md:p-6 border-4 border-white/20 shadow-2xl overflow-hidden select-none">
      {/* Marcado de Césped y Líneas de Campo */}
      <div className="absolute inset-2 border-2 border-white/40 rounded-2xl pointer-events-none" />
      {/* Círculo Central */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 md:w-36 md:h-36 border-2 border-white/40 rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/40 pointer-events-none" />
      {/* Área Grande Superior */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-48 h-20 md:w-64 md:h-28 border-2 border-t-0 border-white/40 rounded-b-xl pointer-events-none" />
      {/* Área Grande Inferior */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-48 h-20 md:w-64 md:h-28 border-2 border-b-0 border-white/40 rounded-t-xl pointer-events-none" />

      {/* Distribución por Demarcaciones en el Campograma */}
      <div className="relative z-10 h-full flex flex-col justify-between py-2">
        {/* Delanteros (Ataque) */}
        <div className="flex justify-around items-center px-4">
          {delanteros.length === 0 ? (
            <span className="text-[10px] text-white/60 uppercase font-bold bg-black/20 px-2 py-0.5 rounded-full">Davanters</span>
          ) : (
            delanteros.map((p) => (
              <PlayerPin key={p.id} player={p} onClick={onPlayerClick} color="bg-[#ff6600]" />
            ))
          )}
        </div>

        {/* Migcampistes (Centrocampistas) */}
        <div className="flex justify-around items-center px-4">
          {medios.length === 0 ? (
            <span className="text-[10px] text-white/60 uppercase font-bold bg-black/20 px-2 py-0.5 rounded-full">Migcamp</span>
          ) : (
            medios.map((p) => (
              <PlayerPin key={p.id} player={p} onClick={onPlayerClick} color="bg-[#002568]" />
            ))
          )}
        </div>

        {/* Defenses (Defensas) */}
        <div className="flex justify-around items-center px-4">
          {defensas.length === 0 ? (
            <span className="text-[10px] text-white/60 uppercase font-bold bg-black/20 px-2 py-0.5 rounded-full">Defenses</span>
          ) : (
            defensas.map((p) => (
              <PlayerPin key={p.id} player={p} onClick={onPlayerClick} color="bg-[#061338]" />
            ))
          )}
        </div>

        {/* Porter (Guardameta) */}
        <div className="flex justify-center items-center">
          {porteros.length === 0 ? (
            <span className="text-[10px] text-white/60 uppercase font-bold bg-black/20 px-2 py-0.5 rounded-full">Porter</span>
          ) : (
            porteros.map((p) => (
              <PlayerPin key={p.id} player={p} onClick={onPlayerClick} color="bg-amber-500" />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

interface PlayerPinProps {
  player: Player;
  color: string;
  onClick?: (p: Player) => void;
}

const PlayerPin: React.FC<PlayerPinProps> = ({ player, color, onClick }) => {
  return (
    <button
      onClick={() => onClick && onClick(player)}
      className="group flex flex-col items-center gap-1 transition-transform hover:scale-110 focus:outline-none"
    >
      <div
        className={`w-9 h-9 md:w-11 md:h-11 rounded-full ${color} text-white font-black text-xs md:text-sm border-2 border-white flex items-center justify-center shadow-lg group-hover:ring-4 group-hover:ring-[#ff6600]/50`}
      >
        {player.jersey_number || player.first_name[0]}
      </div>
      <div className="bg-[#061338]/90 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20 text-center max-w-[90px] truncate shadow">
        <p className="text-[9px] md:text-[10px] font-black text-white truncate uppercase leading-tight">
          {player.first_name} {player.last_name.split(' ')[0]}
        </p>
        <p className="text-[8px] font-bold text-sky-300 truncate">{player.position}</p>
      </div>
    </button>
  );
};
