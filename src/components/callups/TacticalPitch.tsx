import React, { useEffect, useMemo, useState } from 'react';
import { X, Users2, MoveHorizontal, RotateCcw, Shield } from 'lucide-react';
import type { Player } from '../../types/models';
import { PlayerPhoto } from '../ui/PlayerPhoto';
import { calculateInfantilYear } from '../../utils/infantilYear';

interface TacticalPitchProps {
  callupId?: string;
  players: Player[];
}

type Category = 'Porteria' | 'Defensa' | 'Migcamp' | 'Davanter';

interface Slot {
  id: string;
  label: string;
  x: number; // % de profunditat: 0 = porteria pròpia (esquerra), 100 = porteria rival
  y: number; // % d'amplària: 0 = banda esquerra (dalt), 100 = banda dreta (baix)
  category: Category;
}

type SlotDef = [label: string, x: number, y: number, category: Category];

const POR: SlotDef = ['POR', 6, 50, 'Porteria'];

// Camp horitzontal: l'equip ataca cap a la dreta, la banda esquerra queda dalt
const FORMATIONS: Record<string, SlotDef[]> = {
  '1-4-4-2': [
    POR,
    ['LI', 25, 13, 'Defensa'], ['DFC', 21, 37, 'Defensa'], ['DFC', 21, 63, 'Defensa'], ['LD', 25, 87, 'Defensa'],
    ['MI', 52, 13, 'Migcamp'], ['MC', 48, 37, 'Migcamp'], ['MC', 48, 63, 'Migcamp'], ['MD', 52, 87, 'Migcamp'],
    ['DC', 78, 35, 'Davanter'], ['DC', 78, 65, 'Davanter']
  ],
  '1-4-3-3': [
    POR,
    ['LI', 25, 13, 'Defensa'], ['DFC', 21, 37, 'Defensa'], ['DFC', 21, 63, 'Defensa'], ['LD', 25, 87, 'Defensa'],
    ['MCD', 42, 50, 'Migcamp'], ['MC', 55, 28, 'Migcamp'], ['MC', 55, 72, 'Migcamp'],
    ['EI', 78, 14, 'Davanter'], ['DC', 82, 50, 'Davanter'], ['ED', 78, 86, 'Davanter']
  ],
  '1-4-2-3-1': [
    POR,
    ['LI', 25, 13, 'Defensa'], ['DFC', 21, 37, 'Defensa'], ['DFC', 21, 63, 'Defensa'], ['LD', 25, 87, 'Defensa'],
    ['MCD', 41, 35, 'Migcamp'], ['MCD', 41, 65, 'Migcamp'],
    ['EI', 62, 14, 'Davanter'], ['MP', 60, 50, 'Migcamp'], ['ED', 62, 86, 'Davanter'],
    ['DC', 82, 50, 'Davanter']
  ],
  '1-4-1-4-1': [
    POR,
    ['LI', 25, 13, 'Defensa'], ['DFC', 21, 37, 'Defensa'], ['DFC', 21, 63, 'Defensa'], ['LD', 25, 87, 'Defensa'],
    ['MCD', 39, 50, 'Migcamp'],
    ['MI', 58, 13, 'Migcamp'], ['MC', 56, 37, 'Migcamp'], ['MC', 56, 63, 'Migcamp'], ['MD', 58, 87, 'Migcamp'],
    ['DC', 82, 50, 'Davanter']
  ],
  '1-3-5-2': [
    POR,
    ['DFC', 21, 25, 'Defensa'], ['DFC', 19, 50, 'Defensa'], ['DFC', 21, 75, 'Defensa'],
    ['CI', 50, 10, 'Defensa'], ['MC', 44, 32, 'Migcamp'], ['MCD', 40, 50, 'Migcamp'], ['MC', 44, 68, 'Migcamp'], ['CD', 50, 90, 'Defensa'],
    ['DC', 78, 35, 'Davanter'], ['DC', 78, 65, 'Davanter']
  ],
  '1-3-4-3': [
    POR,
    ['DFC', 21, 25, 'Defensa'], ['DFC', 19, 50, 'Defensa'], ['DFC', 21, 75, 'Defensa'],
    ['MI', 48, 12, 'Migcamp'], ['MC', 45, 37, 'Migcamp'], ['MC', 45, 63, 'Migcamp'], ['MD', 48, 88, 'Migcamp'],
    ['EI', 76, 18, 'Davanter'], ['DC', 81, 50, 'Davanter'], ['ED', 76, 82, 'Davanter']
  ],
  '1-5-3-2': [
    POR,
    ['CI', 30, 10, 'Defensa'], ['DFC', 21, 30, 'Defensa'], ['DFC', 19, 50, 'Defensa'], ['DFC', 21, 70, 'Defensa'], ['CD', 30, 90, 'Defensa'],
    ['MC', 52, 28, 'Migcamp'], ['MCD', 46, 50, 'Migcamp'], ['MC', 52, 72, 'Migcamp'],
    ['DC', 78, 35, 'Davanter'], ['DC', 78, 65, 'Davanter']
  ]
};

const FORMATION_NAMES = Object.keys(FORMATIONS);
const DEFAULT_FORMATION = '1-4-4-2';

function buildSlots(formation: string): Slot[] {
  return (FORMATIONS[formation] || FORMATIONS[DEFAULT_FORMATION]).map(([label, x, y, category], i) => ({
    id: `s${i}`,
    label,
    x,
    y,
    category
  }));
}

type Assignments = Record<string, string[]>;

/**
 * Reubica els jugadors en canviar de sistema: primer a la mateixa demarcació,
 * després a la posició de la mateixa línia més pròxima en amplària.
 */
function remapAssignments(oldSlots: Slot[], newSlots: Slot[], assignments: Assignments): Assignments {
  const next: Assignments = Object.fromEntries(newSlots.map((s) => [s.id, []]));
  const labelSeen: Record<string, number> = {};

  for (const old of oldSlots) {
    const ids = assignments[old.id] || [];
    const occurrence = labelSeen[old.label] ?? 0;
    labelSeen[old.label] = occurrence + 1;
    if (ids.length === 0) continue;

    const sameLabel = newSlots.filter((s) => s.label === old.label);
    let target: Slot | undefined = sameLabel.length ? sameLabel[occurrence % sameLabel.length] : undefined;
    if (!target) {
      const sameCategory = newSlots.filter((s) => s.category === old.category);
      target = (sameCategory.length ? sameCategory : newSlots).reduce((best, s) =>
        Math.abs(s.y - old.y) < Math.abs(best.y - old.y) ? s : best
      );
    }
    next[target.id].push(...ids);
  }
  return next;
}

// A les bandes la pila de jugadors creix cap a dins del camp perquè no isca per fora
function stackTransform(y: number): string {
  if (y <= 20) return 'translate(-50%, -22px)';
  if (y >= 80) return 'translate(-50%, calc(-100% + 22px))';
  return 'translate(-50%, -50%)';
}

const LINEUP_STORAGE_PREFIX = 'seleccio_lineup_v1_';

interface StoredLineup {
  formation: string;
  assignments: Assignments;
}

function loadLineup(callupId?: string): StoredLineup | null {
  if (!callupId) return null;
  try {
    const raw = localStorage.getItem(LINEUP_STORAGE_PREFIX + callupId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLineup;
    if (!FORMATIONS[parsed.formation] || typeof parsed.assignments !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

const NAME_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'i', 'da', 'dos', 'van', 'von']);

/** Nom principal complet i la resta abreujada: "AARON GASCO GARCIA" -> "AARON G. G." */
export function shortPlayerName(p: Player): string {
  let first = (p.first_name || '').trim();
  let last = (p.last_name || '').trim();
  if (!first) {
    const parts = (p.full_name || '').trim().split(/\s+/);
    first = parts.shift() || '';
    last = parts.join(' ');
  }
  const [mainName, ...otherNames] = first.split(/\s+/);
  const initials = [...otherNames, ...last.split(/\s+/)]
    .filter((w) => w && !NAME_PARTICLES.has(w.toLowerCase()))
    .map((w) => `${w[0]}.`);
  return [mainName, ...initials].join(' ');
}

function shortLeague(competition?: string): string | null {
  if (!competition) return null;
  const c = competition.toLowerCase();
  if (c.includes('preferent')) return 'PREF';
  if (c.includes('primera')) return '1a';
  if (c.includes('segona') || c.includes('segunda')) return '2a';
  if (c.includes('tercera')) return '3a';
  return competition.split(/\s+/)[0].slice(0, 5).toUpperCase();
}

function yearLabel(p: Player): { text: string; className: string } | null {
  const year = calculateInfantilYear(p.history, p.age, p.infantil_year, p.birth_year);
  if (year === 'Infantil 1er año') return { text: '1r', className: 'bg-sky-400 text-[#061338]' };
  if (year === 'Infantil 2º año') return { text: '2n', className: 'bg-amber-400 text-[#061338]' };
  if (year === 'Alevín 2º año') return { text: 'ALV', className: 'bg-violet-400 text-[#061338]' };
  return null;
}

function categoryOf(position?: string): Category {
  if (!position) return 'Migcamp';
  if (position === 'Portero') return 'Porteria';
  if (position.includes('Defensa') || position.includes('Lateral') || position.includes('Carrilero')) return 'Defensa';
  if (position.includes('Delantero') || position.includes('Extremo') || position.includes('Punta')) return 'Davanter';
  return 'Migcamp';
}

const CATEGORY_RING: Record<Category, string> = {
  Porteria: 'border-amber-400',
  Defensa: 'border-sky-400',
  Migcamp: 'border-emerald-300',
  Davanter: 'border-orange-500'
};

interface PitchCardProps {
  player: Player;
  selected: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onRemove?: () => void;
  light?: boolean;
}

const PitchCard: React.FC<PitchCardProps> = ({ player, selected, onDragStart, onClick, onRemove, light }) => {
  const year = yearLabel(player);
  const league = shortLeague(player.team?.competition);
  const ring = CATEGORY_RING[categoryOf(player.position)];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      title={`${player.full_name}${player.team?.name ? ` · ${player.team.name}` : ''}${player.team?.competition ? ` · ${player.team.competition}` : ''}`}
      className={`group relative flex items-center gap-1.5 w-[132px] pl-0.5 pr-1.5 py-0.5 rounded-lg border shadow-md cursor-grab active:cursor-grabbing touch-manipulation transition-all ${
        selected
          ? 'bg-[#ff6600] border-white scale-105'
          : light
          ? 'bg-white border-slate-200 hover:border-slate-400'
          : 'bg-[#061338]/90 border-white/20 hover:border-white/60 backdrop-blur-sm'
      }`}
    >
      <div className="relative shrink-0">
        <PlayerPhoto
          src={player.photo_url}
          alt={player.full_name}
          firstName={player.first_name}
          lastName={player.last_name}
          imgClassName={`w-7 h-7 rounded-md object-cover object-top border-l-2 bg-slate-200 ${ring}`}
          fallbackClassName={`w-7 h-7 rounded-md bg-[#002568] text-white flex items-center justify-center font-black text-[9px] uppercase border-l-2 ${ring}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[9px] font-black uppercase leading-tight truncate ${
            light && !selected ? 'text-[#061338]' : 'text-white'
          }`}
        >
          {shortPlayerName(player)}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <span
            className={`shrink-0 min-w-[14px] h-[13px] px-0.5 rounded text-[8px] font-black leading-[13px] text-center ${
              light && !selected ? 'bg-[#061338] text-white' : 'bg-white text-[#061338]'
            }`}
          >
            {player.jersey_number ?? '-'}
          </span>
          {player.team?.crest_url ? (
            <img
              src={player.team.crest_url}
              alt=""
              className="w-3 h-3 object-contain shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <Shield className="w-3 h-3 text-slate-400 shrink-0" />
          )}
          {league && (
            <span
              className={`text-[7.5px] font-bold leading-none truncate ${
                light && !selected ? 'text-slate-500' : 'text-white/70'
              }`}
            >
              {league}
            </span>
          )}
          {year && (
            <span className={`ml-auto text-[7.5px] font-black leading-none px-1 py-[2px] rounded ${year.className}`}>
              {year.text}
            </span>
          )}
        </div>
      </div>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-600 hover:bg-rose-500 rounded-full flex items-center justify-center border border-white/60 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Treure del camp"
        >
          <X className="w-2.5 h-2.5 text-white" />
        </button>
      )}
    </div>
  );
};

export const TacticalPitch: React.FC<TacticalPitchProps> = ({ callupId, players }) => {
  const [formation, setFormation] = useState<string>(() => loadLineup(callupId)?.formation || DEFAULT_FORMATION);
  const slots = useMemo(() => buildSlots(formation), [formation]);
  const [assignments, setAssignments] = useState<Assignments>(() => {
    const stored = loadLineup(callupId);
    const base = buildSlots(stored?.formation || DEFAULT_FORMATION);
    return Object.fromEntries(base.map((s) => [s.id, stored?.assignments[s.id] || []]));
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!callupId) return;
    try {
      localStorage.setItem(LINEUP_STORAGE_PREFIX + callupId, JSON.stringify({ formation, assignments }));
    } catch {
      // Sense emmagatzematge disponible: l'alineació només viu en memòria
    }
  }, [callupId, formation, assignments]);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const assignedIds = useMemo(() => new Set(Object.values(assignments).flat()), [assignments]);

  const benchPlayers = useMemo(() => players.filter((p) => !assignedIds.has(p.id)), [players, assignedIds]);

  const movePlayer = (playerId: string, targetSlotId: string | null) => {
    setAssignments((prev) => {
      const next: Assignments = {};
      for (const [slotId, ids] of Object.entries(prev)) next[slotId] = ids.filter((id) => id !== playerId);
      if (targetSlotId) next[targetSlotId] = [...(next[targetSlotId] || []), playerId];
      return next;
    });
    setSelectedPlayerId(null);
  };

  const changeFormation = (newFormation: string) => {
    if (newFormation === formation) return;
    setAssignments((prev) => remapAssignments(slots, buildSlots(newFormation), prev));
    setFormation(newFormation);
  };

  const resetLineup = () => {
    setAssignments(Object.fromEntries(slots.map((s) => [s.id, []])));
    setSelectedPlayerId(null);
  };

  const handleDragStart = (e: React.DragEvent, playerId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', playerId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const dropProps = (targetId: string, slotId: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragOverTarget !== targetId) setDragOverTarget(targetId);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverTarget(null);
      const playerId = e.dataTransfer.getData('text/plain');
      if (playerId) movePlayer(playerId, slotId);
    }
  });

  const toggleSelect = (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  };

  const placedCount = assignedIds.size;

  return (
    <div className="space-y-3" onDragEnd={() => setDragOverTarget(null)}>
      {/* Barra de sistema */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-black uppercase text-[#061338] mr-1">Sistema</span>
        {FORMATION_NAMES.map((f) => (
          <button
            key={f}
            onClick={() => changeFormation(f)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-black tracking-wide transition-all ${
              f === formation
                ? 'bg-[#061338] text-white shadow'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-[11px] font-bold text-slate-500">
          {placedCount}/{players.length} al camp
        </span>
        <button
          onClick={resetLineup}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200"
        >
          <RotateCcw className="w-3 h-3" /> Buidar
        </button>
      </div>

      {/* Camp de joc horitzontal: limitat a l'alçada de la pantalla perquè es veja sencer */}
      <div className="overflow-x-auto custom-scrollbar">
        <div
          className="relative mx-auto aspect-[105/68] min-w-[680px]"
          style={{ width: 'min(100%, 900px, calc((100vh - 320px) * 105 / 68))' }}
        >
          <div
            className="absolute inset-0 rounded-2xl border-4 border-white/20 shadow-2xl select-none bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700"
            onClick={() => setSelectedPlayerId(null)}
          >
            {/* Franjes de gespa */}
            <div
              className="absolute inset-0 rounded-xl opacity-[0.07] pointer-events-none"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg, #fff 0 9.09%, transparent 9.09% 18.18%)' }}
            />
            {/* Línies del camp */}
            <div className="absolute inset-[2%] border-2 border-white/40 rounded-sm pointer-events-none" />
            <div className="absolute top-[2%] bottom-[2%] left-1/2 w-0.5 -translate-x-1/2 bg-white/40 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[27%] aspect-square border-2 border-white/40 rounded-full pointer-events-none" />
            <div className="absolute top-[20%] bottom-[20%] left-[2%] w-[15.5%] border-2 border-l-0 border-white/40 pointer-events-none" />
            <div className="absolute top-[36%] bottom-[36%] left-[2%] w-[5.5%] border-2 border-l-0 border-white/40 pointer-events-none" />
            <div className="absolute top-[20%] bottom-[20%] right-[2%] w-[15.5%] border-2 border-r-0 border-white/40 pointer-events-none" />
            <div className="absolute top-[36%] bottom-[36%] right-[2%] w-[5.5%] border-2 border-r-0 border-white/40 pointer-events-none" />

            {/* Posicions */}
            {slots.map((slot) => {
              const ids = (assignments[slot.id] || []).filter((id) => playersById.has(id));
              const isDragOver = dragOverTarget === slot.id;
              return (
                <div
                  key={slot.id}
                  {...dropProps(slot.id, slot.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedPlayerId) movePlayer(selectedPlayerId, slot.id);
                  }}
                  style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: stackTransform(slot.y) }}
                  className={`absolute z-10 flex flex-col items-center gap-1 p-1 rounded-xl transition-colors ${
                    isDragOver ? 'bg-amber-400/30 ring-2 ring-amber-400' : selectedPlayerId ? 'bg-white/10' : ''
                  }`}
                >
                  <span className="px-1.5 rounded bg-black/30 text-[8px] font-black text-white/80 tracking-wider">
                    {slot.label}
                    {ids.length > 1 ? ` · ${ids.length}` : ''}
                  </span>
                  {ids.length === 0 ? (
                    <div
                      className={`w-9 h-9 rounded-full border-2 border-dashed ${
                        isDragOver
                          ? 'border-amber-400 bg-amber-400/20'
                          : selectedPlayerId
                          ? 'border-white/80 bg-white/10 animate-pulse'
                          : 'border-white/40 bg-black/10'
                      }`}
                    />
                  ) : (
                    ids.map((id) => {
                      const p = playersById.get(id)!;
                      return (
                        <PitchCard
                          key={id}
                          player={p}
                          selected={selectedPlayerId === id}
                          onDragStart={(e) => handleDragStart(e, id)}
                          onClick={(e) => toggleSelect(e, id)}
                          onRemove={() => movePlayer(id, null)}
                        />
                      );
                    })
                  )}
                </div>
              );
            })}

            <div className="absolute bottom-[3%] right-[3%] text-[9px] font-black text-white/50 tracking-widest pointer-events-none">
              ATAC →
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-[10.5px] text-slate-500 font-semibold flex items-center justify-center gap-1.5">
        <MoveHorizontal className="w-3.5 h-3.5" />
        Arrossega jugadors a una demarcació (pots posar-ne més d'un) o toca'n un i després la posició. Arrossega'l ací baix per a llevar-lo.
      </p>

      {/* Jugadors sense posicionar */}
      <div
        {...dropProps('bench', null)}
        onClick={() => {
          if (selectedPlayerId && assignedIds.has(selectedPlayerId)) movePlayer(selectedPlayerId, null);
        }}
        className={`rounded-2xl border-2 p-3 transition-colors ${
          dragOverTarget === 'bench' ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 mb-2 px-1">
          <Users2 className="w-4 h-4 text-[#ff6600]" />
          <h3 className="text-xs font-black uppercase text-slate-700">Sense posicionar ({benchPlayers.length})</h3>
        </div>
        {benchPlayers.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-3">
            Tots els jugadors convocats estan ja ubicats al campograma.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {benchPlayers.map((p) => (
              <PitchCard
                key={p.id}
                player={p}
                light
                selected={selectedPlayerId === p.id}
                onDragStart={(e) => handleDragStart(e, p.id)}
                onClick={(e) => toggleSelect(e, p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
