import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MessageSquareText } from 'lucide-react';
import clsx from 'clsx';
import type { Player } from '../../types/models';
import { PlayerPhoto } from './PlayerPhoto';

// Demarcacions. x = metres des de la porteria pròpia (0-105); lane = carril en el camp horitzontal
// (0 banda esquerra, 1 interior esquerre, 2 centre, 3 interior dret, 4 banda dreta);
// line = línia en el camp vertical (0 porter ... 7 davanter centre); col = columna en el camp
// vertical (0 esquerra, 1 centre, 2 dreta). En vertical els laterals pugen una línia perquè els
// tres centrals càpiguen en la mateixa fila.
type Zone = { position: string; short: string; x: number; lane: 0 | 1 | 2 | 3 | 4; line: number; col: 0 | 1 | 2 };
const ZONES: Zone[] = [
  { position: 'Portero', short: 'POR', x: 4, lane: 2, line: 0, col: 1 },
  { position: 'Defensa Central Izquierdo', short: 'DFC-I', x: 23, lane: 1, line: 1, col: 0 },
  { position: 'Defensa Central', short: 'DFC', x: 23, lane: 2, line: 1, col: 1 },
  { position: 'Defensa Central Derecho', short: 'DFC-D', x: 23, lane: 3, line: 1, col: 2 },
  { position: 'Lateral Izquierdo', short: 'LI', x: 26, lane: 0, line: 2, col: 0 },
  { position: 'Lateral Derecho', short: 'LD', x: 26, lane: 4, line: 2, col: 2 },
  { position: 'Carrilero Izquierdo', short: 'CI', x: 42, lane: 0, line: 3, col: 0 },
  { position: 'Pivote Defensivo', short: 'MCD', x: 37, lane: 2, line: 3, col: 1 },
  { position: 'Carrilero Derecho', short: 'CD', x: 42, lane: 4, line: 3, col: 2 },
  { position: 'Mediocentro Izquierdo', short: 'MC-I', x: 51, lane: 1, line: 4, col: 0 },
  { position: 'Mediocentro', short: 'MC', x: 51, lane: 2, line: 4, col: 1 },
  { position: 'Mediocentro Derecho', short: 'MC-D', x: 51, lane: 3, line: 4, col: 2 },
  { position: 'Extremo Izquierdo', short: 'EI', x: 76, lane: 0, line: 5, col: 0 },
  { position: 'Mediapunta', short: 'MP', x: 65, lane: 2, line: 5, col: 1 },
  { position: 'Extremo Derecho', short: 'ED', x: 76, lane: 4, line: 5, col: 2 },
  { position: 'Segundo Delantero', short: 'SD', x: 80, lane: 2, line: 6, col: 1 },
  { position: 'Delantero Centro', short: 'DC', x: 96, lane: 2, line: 7, col: 1 }
];
const LANES = 5;
const LINES = 8;

const PITCH_L = 105;
const PITCH_W = 68;
const PAD = 18; // marge fora de les línies (px), hi caben les porteries
const GAP = 6;
const LABEL_H = 18;
const BAND_PAD = 12;
const VERTICAL_BELOW = 760; // per davall d'esta amplària el camp es mostra en vertical

// Targeta ampla (camp horitzontal) i compacta (camp vertical, mòbil)
const WIDE = { w: 132, h: 50 };
const COMPACT_H = 74;

type Accent = 'violet' | 'amber' | 'emerald';

const ACCENTS: Record<Accent, { ring: string; bar: string; label: string }> = {
  violet: { ring: 'border-violet-400/70', bar: 'bg-violet-500', label: 'bg-violet-500/90' },
  amber: { ring: 'border-amber-300/80', bar: 'bg-amber-400', label: 'bg-amber-500/90' },
  emerald: { ring: 'border-emerald-300/80', bar: 'bg-emerald-400', label: 'bg-emerald-600/90' }
};

interface PositionBoardProps {
  players: Player[];
  accent: Accent;
}

/** Nom curt per a la targeta: "MANEL ROIG", o "M. ROIG" si és massa llarg. */
function shortName(p: Player, max: number): string {
  const first = (p.first_name || '').trim();
  const surname = (p.last_name || '').trim().split(/\s+/)[0] || '';
  const full = [first, surname].filter(Boolean).join(' ') || p.full_name || '';
  if (full.length <= max) return full;
  return [first ? `${first[0]}.` : '', surname || full].filter(Boolean).join(' ');
}

const stackHeight = (n: number, cardH: number) =>
  LABEL_H + n * cardH + Math.max(0, n - 1) * GAP + 2 * BAND_PAD;

export const PositionBoard: React.FC<PositionBoardProps> = ({ players, accent }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(1100);
  const [openId, setOpenId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setContainerW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { byZone, unplaced } = useMemo(() => {
    const map = new Map<string, Player[]>();
    const rest: Player[] = [];
    const byRating = [...players].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    for (const p of byRating) {
      if (p.position && ZONES.some((z) => z.position === p.position)) {
        map.set(p.position, [...(map.get(p.position) || []), p]);
      } else {
        rest.push(p);
      }
    }
    return { byZone: map, unplaced: rest };
  }, [players]);

  const vertical = containerW < VERTICAL_BELOW;
  const count = (z: Zone) => byZone.get(z.position)?.length || 0;

  // Geometria en coordenades locals: l = al llarg del camp (0 = porteria pròpia), a = d'ample
  // (0 = banda esquerra). L'escala s (px/metre) és fixa; si una demarcació no hi cap, el camp
  // s'allarga o s'eixampla per eixe costat sense deformar àrees ni cercles.
  const geo = useMemo(() => {
    if (!vertical) {
      const width = Math.max(1040, containerW);
      const s = (width - 2 * PAD) / PITCH_L;
      const natural = (PITCH_W * s) / LANES;
      const lane = Array.from({ length: LANES }, (_, ln) =>
        Math.max(natural, stackHeight(Math.max(1, ...ZONES.filter((z) => z.lane === ln).map(count)), WIDE.h))
      );
      const totalA = lane.reduce((a, b) => a + b, 0);
      return {
        s,
        totalL: PITCH_L * s,
        totalA,
        svgW: width,
        svgH: totalA + 2 * PAD,
        cardW: WIDE.w,
        cardH: WIDE.h,
        // Pila de cada demarcació: centre horitzontal i franja vertical del seu carril
        slot: (z: Zone) => ({
          cx: PAD + z.x * s,
          bandStart: PAD + lane.slice(0, z.lane).reduce((a, b) => a + b, 0),
          bandSize: lane[z.lane]
        })
      };
    }
    const width = containerW;
    const s = (width - 2 * PAD) / PITCH_W;
    const colW = (PITCH_W * s) / 3;
    const natural = (PITCH_L * s) / LINES;
    const band = Array.from({ length: LINES }, (_, i) =>
      Math.max(natural, stackHeight(Math.max(1, ...ZONES.filter((z) => z.line === i).map(count)), COMPACT_H))
    );
    const totalL = band.reduce((a, b) => a + b, 0);
    return {
      s,
      totalL,
      totalA: PITCH_W * s,
      svgW: width,
      svgH: totalL + 2 * PAD,
      cardW: Math.floor(colW - 8),
      cardH: COMPACT_H,
      // La línia 0 (porter) queda baix: la franja es compta des del final
      slot: (z: Zone) => ({
        cx: PAD + (z.col + 0.5) * colW,
        bandStart: PAD + totalL - band.slice(0, z.line + 1).reduce((a, b) => a + b, 0),
        bandSize: band[z.line]
      })
    };
  }, [vertical, containerW, byZone]);

  // Punt del camp en px. Horitzontal: l -> x, a -> y. Vertical: rotació de 90° (s'ataca cap amunt).
  const pt = (l: number, a: number): [number, number] =>
    vertical ? [PAD + a, PAD + geo.totalL - l] : [PAD + l, PAD + a];
  // Metres al llarg -> l: cada meitat es mesura des de la seua porteria i el centre queda al mig
  const Lm = (m: number) => (m < 52.5 ? m * geo.s : m > 52.5 ? geo.totalL - (PITCH_L - m) * geo.s : geo.totalL / 2);
  // Metres des de l'eix longitudinal -> a
  const Am = (m: number) => geo.totalA / 2 + m * geo.s;

  return (
    <div className="space-y-2">
      <div
        ref={wrapRef}
        className={clsx('rounded-2xl shadow-lg ring-1 ring-black/10', !vertical && 'overflow-x-auto custom-scrollbar')}
      >
        <div className="relative" style={{ width: geo.svgW, height: geo.svgH }}>
          <PitchSvg width={geo.svgW} height={geo.svgH} s={geo.s} pt={pt} Lm={Lm} Am={Am} totalA={geo.totalA} />

          {ZONES.map((z) => {
            const list = byZone.get(z.position) || [];
            const { cx, bandStart, bandSize } = geo.slot(z);
            const stackH = LABEL_H + list.length * geo.cardH + Math.max(0, list.length - 1) * GAP;
            const top = bandStart + (bandSize - stackH) / 2;
            const left = Math.min(Math.max(cx - geo.cardW / 2, PAD + 4), geo.svgW - PAD - geo.cardW - 4);
            const popup: PopupPlacement = vertical
              ? { up: z.line <= 3, align: z.col === 0 ? 'left' : z.col === 2 ? 'right' : 'center' }
              : { up: z.lane >= 3, align: z.x > 70 ? 'right' : 'left' };

            return (
              <div key={z.position} className="absolute flex flex-col items-center" style={{ left, top, width: geo.cardW }}>
                <span
                  className={clsx(
                    'h-[14px] mb-1 px-1.5 rounded text-[9px] leading-[14px] font-black tracking-wider',
                    list.length > 0 ? `${ACCENTS[accent].label} text-white shadow` : 'bg-black/20 text-white/45'
                  )}
                  title={z.position}
                >
                  {z.short}
                </span>
                <div className="flex flex-col w-full" style={{ gap: GAP }}>
                  {list.map((p) => (
                    <PlayerCard
                      key={p.id}
                      player={p}
                      accent={accent}
                      compact={vertical}
                      height={geo.cardH}
                      open={openId === p.id}
                      popup={popup}
                      onToggle={() => setOpenId((prev) => (prev === p.id ? null : p.id))}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {unplaced.length > 0 && (
        <div className="rounded-2xl bg-[#0b1f17] border border-emerald-950 p-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200/70 block mb-2">
            Sense posició definida · {unplaced.length}
          </span>
          <div className={clsx(vertical ? 'grid grid-cols-3' : 'flex flex-wrap')} style={{ gap: GAP }}>
            {unplaced.map((p, i) => (
              <div key={p.id} style={vertical ? undefined : { width: WIDE.w }}>
                <PlayerCard
                  player={p}
                  accent={accent}
                  compact={vertical}
                  height={vertical ? COMPACT_H : WIDE.h}
                  open={openId === p.id}
                  popup={{ up: true, align: vertical ? (['left', 'center', 'right'] as const)[i % 3] : 'left' }}
                  onToggle={() => setOpenId((prev) => (prev === p.id ? null : p.id))}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Camp de futbol (mesures reglamentàries a escala) ────────────────────────
interface PitchSvgProps {
  width: number;
  height: number;
  s: number;
  totalA: number;
  pt: (l: number, a: number) => [number, number];
  Lm: (m: number) => number;
  Am: (m: number) => number;
}

const PitchSvg: React.FC<PitchSvgProps> = ({ width, height, s, totalA, pt, Lm, Am }) => {
  const line = { fill: 'none', stroke: 'rgba(255,255,255,0.82)', strokeWidth: 2 };
  const dot = 'rgba(255,255,255,0.9)';

  // Polígon i arc en coordenades del camp (la rotació conserva el sentit dels arcs)
  const poly = (pts: [number, number][]) => pts.map(([l, a]) => pt(l, a).join(',')).join(' ');
  const arc = (from: [number, number], to: [number, number], r: number, sweep: 0 | 1) =>
    `M ${pt(...from).join(' ')} A ${r} ${r} 0 0 ${sweep} ${pt(...to).join(' ')}`;
  const rect = (l0: number, l1: number, a0: number, a1: number) => poly([[l0, a0], [l1, a0], [l1, a1], [l0, a1]]);

  const penArcDy = Math.sqrt(9.15 ** 2 - 5.5 ** 2); // on l'arc del penal talla l'àrea
  const end = Lm(PITCH_L);

  const half = (side: 'own' | 'rival') => {
    const L = (m: number) => (side === 'own' ? Lm(m) : Lm(PITCH_L - m));
    const sweep = side === 'own' ? 1 : 0;
    const goalDepth = (side === 'own' ? -1 : 1) * 2.4 * s;
    const [sx, sy] = pt(L(11), Am(0));
    return (
      <g key={side}>
        <polygon points={rect(L(0), L(16.5), Am(-20.16), Am(20.16))} {...line} />
        <polygon points={rect(L(0), L(5.5), Am(-9.16), Am(9.16))} {...line} />
        <circle cx={sx} cy={sy} r={2.2} fill={dot} />
        <path d={arc([L(16.5), Am(-penArcDy)], [L(16.5), Am(penArcDy)], 9.15 * s, sweep)} {...line} />
        <polygon
          points={rect(L(0), L(0) + goalDepth, Am(-3.66), Am(3.66))}
          fill="url(#goal-net)"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth={2}
        />
      </g>
    );
  };

  const [cx, cy] = pt(Lm(52.5), Am(0));
  const cr = s; // radi del córner (1 m)
  const stripes = 14;

  return (
    <svg width={width} height={height} className="absolute inset-0" aria-hidden="true">
      <defs>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f8a4f" />
          <stop offset="0.5" stopColor="#287d46" />
          <stop offset="1" stopColor="#21703d" />
        </linearGradient>
        <radialGradient id="grass-light" cx="50%" cy="45%" r="75%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.10" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.22" />
        </radialGradient>
        <pattern id="goal-net" width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="rgba(255,255,255,0.08)" />
          <path d="M0 0 L5 5 M5 0 L0 5" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
        </pattern>
      </defs>

      <rect width={width} height={height} fill="url(#grass)" />
      {/* Franges de segat, perpendiculars a la llargària del camp */}
      {Array.from({ length: stripes }, (_, i) =>
        i % 2 === 0 ? (
          <polygon key={i} points={rect((i * end) / stripes, ((i + 1) * end) / stripes, -PAD, totalA + PAD)} fill="#ffffff" opacity="0.05" />
        ) : null
      )}
      <rect width={width} height={height} fill="url(#grass-light)" />

      <polygon points={rect(0, end, 0, totalA)} {...line} />
      <polygon points={rect(Lm(52.5), Lm(52.5), 0, totalA)} {...line} />
      <circle cx={cx} cy={cy} r={9.15 * s} {...line} />
      <circle cx={cx} cy={cy} r={2.6} fill={dot} />
      {half('own')}
      {half('rival')}

      {/* Arcs de córner */}
      <path d={arc([cr, 0], [0, cr], cr, 1)} {...line} />
      <path d={arc([0, totalA - cr], [cr, totalA], cr, 1)} {...line} />
      <path d={arc([end, cr], [end - cr, 0], cr, 1)} {...line} />
      <path d={arc([end - cr, totalA], [end, totalA - cr], cr, 1)} {...line} />
    </svg>
  );
};

// ── Targeta del jugador ─────────────────────────────────────────────────────
interface PopupPlacement {
  up: boolean;
  align: 'left' | 'center' | 'right';
}

interface PlayerCardProps {
  player: Player;
  accent: Accent;
  compact: boolean;
  height: number;
  open: boolean;
  popup: PopupPlacement;
  onToggle: () => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, accent, compact, height, open, popup, onToggle }) => {
  const notes = player.notes?.trim();
  const crest = player.team?.crest_url;
  const rating = player.rating || 0;
  const photoSize = 'w-9 h-9';

  const photo = (
    <span className="relative shrink-0">
      <PlayerPhoto
        src={player.photo_url}
        alt={player.full_name}
        firstName={player.first_name}
        lastName={player.last_name}
        imgClassName={`${photoSize} rounded-full object-cover object-top bg-slate-200 ring-2 ring-white/80`}
        fallbackClassName={`${photoSize} rounded-full bg-slate-600 ring-2 ring-white/80 text-white text-xs font-black flex items-center justify-center`}
      />
      {player.jersey_number != null && (
        <span className="absolute -top-1 -left-1.5 min-w-[18px] h-[16px] px-0.5 rounded-md bg-[#ff6600] text-white text-[9px] font-black leading-[16px] text-center tabular-nums shadow">
          {player.jersey_number}
        </span>
      )}
      {crest && (
        <img
          src={crest}
          alt=""
          className="absolute -bottom-1 -right-1.5 w-5 h-5 rounded-full bg-white p-0.5 object-contain shadow"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
        />
      )}
    </span>
  );

  const stars = (
    <span className="text-[10px] leading-none tracking-tight">
      <span className="text-amber-400">{'★'.repeat(rating)}</span>
      <span className="text-white/20">{'★'.repeat(5 - rating)}</span>
    </span>
  );

  return (
    <div className={clsx('relative group', open && 'z-40')} style={{ height }}>
      <button
        type="button"
        onClick={onToggle}
        className={clsx(
          'relative w-full h-full rounded-xl border bg-[#081a2e]/85 backdrop-blur-sm text-left',
          'shadow-[0_4px_12px_rgba(0,0,0,0.35)] hover:bg-[#0c2440]/95 transition-colors cursor-pointer overflow-hidden',
          compact ? 'flex flex-col items-center justify-center gap-1 px-1 pt-1.5' : 'flex items-center gap-2 pl-2.5 pr-1.5',
          ACCENTS[accent].ring
        )}
      >
        <span className={clsx('absolute', compact ? 'left-0 right-0 top-0 h-1' : 'left-0 top-0 bottom-0 w-1', ACCENTS[accent].bar)} />
        {photo}
        <span className={clsx('min-w-0', compact ? 'w-full text-center' : 'flex-1')}>
          <span className="block text-[10.5px] font-black text-white uppercase truncate leading-tight">
            {shortName(player, compact ? 10 : 9)}
          </span>
          <span className={clsx('flex items-center gap-1 mt-0.5', compact && 'justify-center')}>
            {stars}
            {notes && <MessageSquareText className="w-3 h-3 text-sky-300 shrink-0" />}
          </span>
        </span>
      </button>

      {/* Comentari: hover a l'escriptori, toc al mòbil */}
      <div
        className={clsx(
          'absolute z-50 w-72 max-w-[calc(100vw-2rem)]',
          popup.up ? 'bottom-full pb-1.5' : 'top-full pt-1.5',
          popup.align === 'right' ? 'right-0' : popup.align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0',
          open ? 'block' : 'hidden group-hover:block'
        )}
      >
        <div className="bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 p-3">
          <div className="flex items-center gap-2.5">
            <PlayerPhoto
              src={player.photo_url}
              alt={player.full_name}
              firstName={player.first_name}
              lastName={player.last_name}
              imgClassName="w-11 h-11 rounded-full object-cover object-top bg-slate-100"
              fallbackClassName="w-11 h-11 rounded-full bg-slate-200 text-slate-600 text-xs font-black flex items-center justify-center"
            />
            <div className="min-w-0">
              <p className="text-xs font-black text-[#061338] leading-tight">
                {player.jersey_number != null && <span className="text-[#ff6600]">#{player.jersey_number} </span>}
                {player.full_name}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{player.team?.name}</p>
              <p className="text-[11px] text-slate-500 truncate">
                {[player.position, player.infantil_year].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] leading-snug whitespace-pre-line max-h-48 overflow-y-auto">
            {notes || <span className="italic text-slate-400">Sense comentaris</span>}
          </div>
          <Link
            to={`/jugadores/${player.id}`}
            className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-black text-[#ff6600] hover:underline"
          >
            Veure fitxa <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
