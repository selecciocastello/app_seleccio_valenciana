import React, { useMemo, useState } from 'react';
import { X, Users2, MoveHorizontal } from 'lucide-react';
import type { Player } from '../../types/models';
import { JerseyBadge } from '../ui/JerseyBadge';

interface TacticalPitchProps {
  players: Player[];
}

type Category = 'Porteria' | 'Defensa' | 'Migcamp' | 'Davanter';

interface Slot {
  id: string;
  label: string;
  top: number; // % desde arriba
  left: number; // % desde la izquierda
  category: Category;
}

// Formació 1-4-4-2: 1 porter, 4 defenses, 4 migcampistes, 2 davanters
const SLOTS: Slot[] = [
  { id: 'fw1', label: 'DC', top: 14, left: 36, category: 'Davanter' },
  { id: 'fw2', label: 'DC', top: 14, left: 64, category: 'Davanter' },

  { id: 'mf1', label: 'MI', top: 40, left: 13, category: 'Migcamp' },
  { id: 'mf2', label: 'MC', top: 44, left: 37, category: 'Migcamp' },
  { id: 'mf3', label: 'MC', top: 44, left: 63, category: 'Migcamp' },
  { id: 'mf4', label: 'MD', top: 40, left: 87, category: 'Migcamp' },

  { id: 'df1', label: 'LI', top: 68, left: 13, category: 'Defensa' },
  { id: 'df2', label: 'DFC', top: 72, left: 37, category: 'Defensa' },
  { id: 'df3', label: 'DFC', top: 72, left: 63, category: 'Defensa' },
  { id: 'df4', label: 'LD', top: 68, left: 87, category: 'Defensa' },

  { id: 'gk', label: 'POR', top: 91, left: 50, category: 'Porteria' }
];

function categoryOf(position?: string): Category {
  if (!position) return 'Migcamp';
  if (position === 'Portero') return 'Porteria';
  if (position.includes('Defensa') || position.includes('Lateral') || position.includes('Carrilero')) return 'Defensa';
  if (position.includes('Delantero') || position.includes('Extremo') || position.includes('Punta')) return 'Davanter';
  return 'Migcamp';
}

const CATEGORY_COLOR: Record<Category, string> = {
  Porteria: 'amber',
  Defensa: 'blue',
  Migcamp: 'sky',
  Davanter: 'orange'
};

export const TacticalPitch: React.FC<TacticalPitchProps> = ({ players }) => {
  const [assignments, setAssignments] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(SLOTS.map((s) => [s.id, null]))
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [benchDragOver, setBenchDragOver] = useState(false);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const assignedIds = useMemo(
    () => new Set(Object.values(assignments).filter(Boolean) as string[]),
    [assignments]
  );

  const benchPlayers = useMemo(
    () => players.filter((p) => !assignedIds.has(p.id)),
    [players, assignedIds]
  );

  const movePlayer = (playerId: string, targetSlotId: string | null) => {
    setAssignments((prev) => {
      const next = { ...prev };
      const sourceSlotId = Object.keys(next).find((k) => next[k] === playerId) || null;

      if (targetSlotId === null) {
        if (sourceSlotId) next[sourceSlotId] = null;
        return next;
      }

      const displacedPlayerId = next[targetSlotId] ?? null;
      next[targetSlotId] = playerId;
      if (sourceSlotId && sourceSlotId !== targetSlotId) {
        next[sourceSlotId] = displacedPlayerId;
      }
      return next;
    });
    setSelectedPlayerId(null);
  };

  const handleDragStart = (e: React.DragEvent, playerId: string) => {
    e.dataTransfer.setData('text/plain', playerId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSlotDrop = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    setDragOverSlot(null);
    const playerId = e.dataTransfer.getData('text/plain');
    if (playerId) movePlayer(playerId, slotId);
  };

  const handleBenchDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setBenchDragOver(false);
    const playerId = e.dataTransfer.getData('text/plain');
    if (playerId) movePlayer(playerId, null);
  };

  const handleSlotTap = (slotId: string) => {
    const occupantId = assignments[slotId];
    if (selectedPlayerId) {
      movePlayer(selectedPlayerId, slotId);
      return;
    }
    if (occupantId) {
      movePlayer(occupantId, null);
    }
  };

  const handleBenchPlayerTap = (playerId: string) => {
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Camp de joc */}
      <div className="flex-1 lg:max-w-2xl mx-auto lg:mx-0 w-full">
        <div className="relative w-full aspect-[3/4.2] bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-800 rounded-3xl border-4 border-white/20 shadow-2xl overflow-hidden select-none">
          {/* Textura de franjas de gespa */}
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, #fff 0 40px, transparent 40px 80px)'
          }} />

          {/* Líneas del campo */}
          <div className="absolute inset-2 border-2 border-white/40 rounded-2xl pointer-events-none" />
          <div className="absolute top-[45%] left-0 right-0 h-0.5 bg-white/40 pointer-events-none" />
          <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/40 rounded-full pointer-events-none" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[55%] h-[13%] border-2 border-t-0 border-white/40 rounded-b-xl pointer-events-none" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[55%] h-[13%] border-2 border-b-0 border-white/40 rounded-t-xl pointer-events-none" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[28%] h-[6%] border-2 border-b-0 border-white/40 rounded-t-lg pointer-events-none" />

          {/* Badge de formació */}
          <div className="absolute top-3 right-3 z-20 bg-[#061338]/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 shadow">
            <span className="text-[10px] font-black text-white tracking-wider">1-4-4-2</span>
          </div>

          {/* Slots tàctics */}
          {SLOTS.map((slot) => {
            const occupantId = assignments[slot.id];
            const occupant = occupantId ? playersById.get(occupantId) : null;
            const isDragOver = dragOverSlot === slot.id;
            const color = CATEGORY_COLOR[slot.category];

            return (
              <div
                key={slot.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverSlot(slot.id);
                }}
                onDragLeave={() => setDragOverSlot((prev) => (prev === slot.id ? null : prev))}
                onDrop={(e) => handleSlotDrop(e, slot.id)}
                onClick={() => handleSlotTap(slot.id)}
                style={{ top: `${slot.top}%`, left: `${slot.left}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer touch-manipulation"
              >
                {occupant ? (
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, occupant.id)}
                    className="group flex flex-col items-center gap-1 animate-fade-in"
                  >
                    <div className="relative">
                      <JerseyBadge
                        number={occupant.jersey_number}
                        size="sm"
                        variant="kit"
                        color={color === 'orange' ? 'orange' : 'blue'}
                        className={`ring-2 ring-white/60 group-hover:ring-4 group-hover:ring-amber-400/60 transition-all ${
                          isDragOver ? 'ring-amber-400 ring-4' : ''
                        }`}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          movePlayer(occupant.id, null);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-600 hover:bg-rose-500 rounded-full flex items-center justify-center border border-white/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                    <div className="bg-[#061338]/90 backdrop-blur-md px-1.5 py-0.5 rounded-full border border-white/20 max-w-[74px] shadow">
                      <p className="text-[8px] font-black text-white truncate uppercase leading-tight text-center">
                        {occupant.first_name}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                      isDragOver
                        ? 'border-amber-400 bg-amber-400/20 scale-110'
                        : selectedPlayerId
                        ? 'border-white/80 bg-white/10 animate-pulse'
                        : 'border-white/40 bg-black/10'
                    }`}
                  >
                    <span className="text-[8px] font-black text-white/70">{slot.label}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[10.5px] text-slate-500 font-semibold flex items-center justify-center gap-1.5">
          <MoveHorizontal className="w-3.5 h-3.5" />
          Arrossega un jugador fins a una demarcació, o toca'l i despres toca la posició al camp
        </p>
      </div>

      {/* Llista lateral de jugadors disponibles */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setBenchDragOver(true);
        }}
        onDragLeave={() => setBenchDragOver(false)}
        onDrop={handleBenchDrop}
        className={`w-full lg:w-64 shrink-0 rounded-2xl border-2 p-3 transition-colors ${
          benchDragOver ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 mb-3 px-1">
          <Users2 className="w-4 h-4 text-[#ff6600]" />
          <h3 className="text-xs font-black uppercase text-slate-700">
            Sense posicionar ({benchPlayers.length})
          </h3>
        </div>

        {benchPlayers.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-6 px-2">
            Tots els jugadors convocats estan ja ubicats al campograma.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[420px] lg:max-h-[560px] overflow-y-auto custom-scrollbar pr-0.5">
            {benchPlayers.map((p) => {
              const cat = categoryOf(p.position);
              const color = CATEGORY_COLOR[cat];
              const isSelected = selectedPlayerId === p.id;
              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, p.id)}
                  onClick={() => handleBenchPlayerTap(p.id)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-grab active:cursor-grabbing transition-all touch-manipulation ${
                    isSelected
                      ? 'bg-[#061338] border-[#061338] shadow-md scale-[1.02]'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <JerseyBadge
                    number={p.jersey_number}
                    size="xs"
                    variant="kit"
                    color={color === 'orange' ? 'orange' : 'blue'}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[11px] font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {p.full_name}
                    </p>
                    <p className={`text-[9.5px] truncate ${isSelected ? 'text-sky-300' : 'text-slate-500'}`}>
                      {p.position || cat}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
