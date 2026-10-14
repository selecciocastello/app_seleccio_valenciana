import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowLeft,
  ExternalLink,
  Phone,
  Mail,
  Save,
  MessageCircle,
  UserCheck,
  MapPin,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { CustomSelect } from '../../components/ui/Select';
import { useAppStore } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';
import { StarRating } from '../../components/ui/StarRating';
import { PositionPitch } from '../../components/ui/PositionPitch';
import { PLAYER_POSITIONS } from '../../types/models';
import type { PlayerStatus } from '../../types/models';
import { PlayerPhoto } from '../../components/ui/PlayerPhoto';
import { formatAppDate } from '../../utils/dateFormatter';

type Tab = 'fitxa' | 'dades' | 'convocatories' | 'entrenaments' | 'informes';

// Estats de seguiment, en l'ordre en què avança un jugador
const STATUSES: { value: PlayerStatus; label: string; active: string }[] = [
  { value: 'Candidato', label: 'Candidat', active: 'bg-slate-700 text-white border-slate-700' },
  { value: 'Observado', label: 'Observat', active: 'bg-sky-600 text-white border-sky-600' },
  { value: 'Interesante', label: 'Interessant', active: 'bg-violet-600 text-white border-violet-600' },
  { value: 'Preseleccionado', label: 'Preseleccionat', active: 'bg-amber-500 text-white border-amber-500' },
  { value: 'Seleccionado', label: 'Seleccionat', active: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'Lesionado', label: 'Lesionat', active: 'bg-rose-600 text-white border-rose-600' },
  { value: 'No seleccionado', label: 'No seleccionat', active: 'bg-slate-500 text-white border-slate-500' }
];

const FOOT_LABELS: Record<string, string> = { Diestro: 'Dretà', Zurdo: 'Esquerrà', Ambidextro: 'Ambidextre' };

const ATTENDANCE_LABELS: Record<string, string> = {
  Convocado: 'Convocat',
  Confirmado: 'Confirmat',
  'Asistió': 'Va assistir',
  'No asistió': 'No va assistir',
  Justificado: 'Absència justificada',
  Lesionado: 'Lesionat'
};

const SCORE_LABELS: [string, string][] = [
  ['TECNICA', 'Tècnica'],
  ['TACTICA', 'Tàctica'],
  ['FISICA', 'Física'],
  ['ACTITUD', 'Actitud']
];

const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'i', 'y']);

/** "BEJAR SANTAMARIA, PABLO" en majúscules -> "Bejar Santamaria" (més llegible en una fitxa). */
function toTitleCase(text: string) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && PARTICLES.has(w) ? w : w.replace(/(^|[-'])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())))
    .join(' ');
}

const inputClass =
  'w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60 focus:border-[#002568]';

export const PlayerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { players, updatePlayer, callups, trainings, reports } = useAppStore();
  const { showToast } = useToast();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/jugadores');
    }
  };

  const [activeTab, setActiveTab] = useState<Tab>('fitxa');

  const player = players.find((p) => p.id === id);

  // Local state for editable fields
  const [positionInput, setPositionInput] = useState(player?.position || '');
  const [secondaryPositionInput, setSecondaryPositionInput] = useState(player?.secondary_position || '');
  const [ratingInput, setRatingInput] = useState<number>(player?.rating || 0);
  const [dominantFootInput, setDominantFootInput] = useState(player?.dominant_foot || 'Diestro');
  const [phoneInput, setPhoneInput] = useState(player?.phone || '');
  const [emailInput, setEmailInput] = useState(player?.email || '');
  const [guardianNameInput, setGuardianNameInput] = useState(player?.guardian_name || '');
  const [guardianPhoneInput, setGuardianPhoneInput] = useState(player?.guardian_phone || '');
  const [guardianEmailInput, setGuardianEmailInput] = useState(player?.guardian_email || '');
  const [notesInput, setNotesInput] = useState(player?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (player) {
      setPositionInput(player.position && player.position !== 'Candidato' ? player.position : '');
      setSecondaryPositionInput(player.secondary_position && player.secondary_position !== 'Sense definir' ? player.secondary_position : '');
      setRatingInput(player.rating || 0);
      setDominantFootInput(player.dominant_foot || 'Diestro');
      setPhoneInput(player.phone || '');
      setEmailInput(player.email || '');
      setGuardianNameInput(player.guardian_name || '');
      setGuardianPhoneInput(player.guardian_phone || '');
      setGuardianEmailInput(player.guardian_email || '');
      setNotesInput(player.notes || '');
    }
  }, [player]);

  if (!player) {
    return (
      <div className="space-y-6 p-2">
        <button
          type="button"
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#061338]"
        >
          <ArrowLeft className="w-4 h-4 text-[#ff6600]" />
          <span>Jugadors</span>
        </button>
        <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
          <p className="text-slate-700 font-semibold">
            {players.length === 0 ? 'Carregant la fitxa…' : "No s'ha trobat aquest jugador. Torna al llistat i busca'l de nou."}
          </p>
        </div>
      </div>
    );
  }

  const handleStatusChange = (newStatus: PlayerStatus) => {
    if (newStatus === player.status) return;
    updatePlayer(player.id, { status: newStatus });
    showToast(`Estat canviat a "${STATUSES.find((s) => s.value === newStatus)?.label || newStatus}"`, 'success');
  };

  const handlePositionChange = (newPosition: string) => {
    const finalPos = newPosition === 'Sense definir' ? '' : newPosition;
    setPositionInput(finalPos);
    updatePlayer(player.id, { position: finalPos });
    showToast(`Posició principal: ${newPosition}`, 'success');
  };

  const handleSecondaryPositionChange = (newPosition: string) => {
    const finalPos = newPosition === 'Sense definir' ? '' : newPosition;
    setSecondaryPositionInput(finalPos);
    updatePlayer(player.id, { secondary_position: finalPos });
    showToast(`Posició alternativa: ${newPosition}`, 'success');
  };

  const handleRatingChange = (newRating: number) => {
    setRatingInput(newRating);
    updatePlayer(player.id, { rating: newRating });
    showToast(newRating > 0 ? `Valoració: ${newRating} de 5` : 'Valoració esborrada', 'success');
  };

  const handleSaveContactAndNotes = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    updatePlayer(player.id, {
      position: positionInput === 'Sense definir' ? '' : positionInput,
      secondary_position: secondaryPositionInput === 'Sense definir' ? '' : secondaryPositionInput,
      rating: ratingInput,
      dominant_foot: dominantFootInput as any,
      phone: phoneInput || undefined,
      email: emailInput || undefined,
      guardian_name: guardianNameInput || undefined,
      guardian_phone: guardianPhoneInput || undefined,
      guardian_email: guardianEmailInput || undefined,
      notes: notesInput || undefined
    });

    setTimeout(() => {
      setIsSaving(false);
      showToast('Canvis desats', 'success');
    }, 200);
  };

  const handleQuickSaveNotes = () => {
    updatePlayer(player.id, { notes: notesInput });
    showToast('Notes desades', 'success');
  };

  // Estadístiques oficials del scraping FFCV
  const getStat = (keys: string[]): number => {
    const sd = (player.sports_data || {}) as Record<string, any>;
    for (const k of keys) {
      const n = parseFloat(String(sd[k] ?? '').replace(',', '.'));
      if (!isNaN(n)) return n;
    }
    return 0;
  };

  const convocats = getStat(['Convocados', 'convocados']);
  const titular = getStat(['Titular', 'titular']);
  const suplent = getStat(['Suplente', 'suplente']);
  const jugats = getStat(['Jugados', 'jugados', 'matches_played']);
  const gols = getStat(['Goles', 'goles', 'goals']);
  const minuts = getStat(['Minutos', 'minutos']);
  const grogues = getStat(['Amarillas', 'amarillas', 'yellow_cards']);
  const dobleGroga = getStat(['Doble amarilla', 'doble_amarilla']);
  const vermelles = getStat(['Rojas', 'rojas', 'red_cards']);
  const verdes = getStat(['Tarjeta verde', 'tarjeta_verde']);

  const normalizePosition = (pos?: string | null) => {
    if (!pos || pos === 'Candidato' || pos === 'Sense definir') return 'Sense definir';
    const match = PLAYER_POSITIONS.find((p) => p.toLowerCase() === pos.trim().toLowerCase());
    return match || pos;
  };

  const currentPosition = normalizePosition(player.position);
  const currentSecondaryPosition = normalizePosition(player.secondary_position);
  const hasPosition = currentPosition !== 'Sense definir';
  const hasSecondary = currentSecondaryPosition !== 'Sense definir';

  const playerBirthYear =
    player.birth_year || (player.birth_date ? new Date(player.birth_date).getFullYear() : null);

  const displayName = toTitleCase(player.full_name || `${player.first_name} ${player.last_name}`);
  const history = player.history || [];
  const prevSeason = history.find((h) => (h.temporada || '').replace(/\s+/g, '').includes('2025-2026'));

  // Dades reals de la Selecció per a aquest jugador
  const playerCallups = callups
    .map((c) => ({ callup: c, entry: c.callup_players?.find((cp) => cp.player_id === player.id) }))
    .filter((x) => x.entry)
    .sort((a, b) => (b.callup.date || '').localeCompare(a.callup.date || ''));
  const playerTrainings = trainings
    .map((t) => ({ session: t, entry: t.attendance?.find((a) => a.player_id === player.id) }))
    .filter((x) => x.entry)
    .sort((a, b) => (b.session.start_time || '').localeCompare(a.session.start_time || ''));
  const playerReports = reports
    .filter((r) => r.player_id === player.id || r.player?.id === player.id)
    .sort((a, b) => (b.report_date || '').localeCompare(a.report_date || ''));

  const infantilYearReason =
    player.infantil_year === 'Alevín 2º año'
      ? `Nascut el ${playerBirthYear ?? '2015 o després'}: aquesta temporada és aleví de 2n any.`
      : player.infantil_year === 'Infantil 1er año'
        ? `Nascut el ${playerBirthYear ?? 2014}: aquesta temporada és infantil de 1r any.`
        : player.infantil_year === 'Infantil 2º año'
          ? `Nascut el ${playerBirthYear ?? 2013}: aquesta temporada és infantil de 2n any.`
          : "No consta l'any de naixement: no se sap en quin any d'infantil està.";

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'fitxa', label: 'Fitxa' },
    { id: 'dades', label: 'Dades i contacte' },
    { id: 'convocatories', label: 'Convocatòries', count: playerCallups.length },
    { id: 'entrenaments', label: 'Entrenaments', count: playerTrainings.length },
    { id: 'informes', label: 'Informes', count: playerReports.length }
  ];

  const facts: [string, string][] = [
    ['Categoria', player.infantil_year && player.infantil_year !== 'Desconocido' ? player.infantil_year : 'Sense determinar'],
    ['Naixement', playerBirthYear ? `${playerBirthYear}${player.age ? ` (${player.age} anys)` : ''}` : player.age ? `${player.age} anys` : 'Sense dada'],
    ['Peu', player.dominant_foot ? FOOT_LABELS[player.dominant_foot] || player.dominant_foot : 'Sense definir'],
    ['Població', player.city || 'Castelló']
  ];

  return (
    <div className="pb-12 space-y-5 text-slate-900">
      <button
        type="button"
        onClick={handleGoBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#061338] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60"
      >
        <ArrowLeft className="w-4 h-4 text-[#ff6600]" />
        <span>Jugadors</span>
      </button>

      {/* ── Capçalera: qui és i on juga ─────────────────────────────────── */}
      <section className="rounded-2xl bg-[#061338] text-white shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 md:gap-8 p-5 sm:p-7">
          {/* Foto amb el dorsal */}
          <div className="flex md:block items-end gap-4">
            <div className="relative w-28 sm:w-36 shrink-0">
              <PlayerPhoto
                src={player.photo_url}
                alt={displayName}
                firstName={player.first_name}
                lastName={player.last_name}
                imgClassName="w-28 h-36 sm:w-36 sm:h-44 rounded-xl object-cover bg-white/10"
                fallbackClassName="w-28 h-36 sm:w-36 sm:h-44 rounded-xl bg-[#002568] flex items-center justify-center font-black text-4xl text-white/80"
              />
              {player.jersey_number ? (
                <span
                  className="absolute -bottom-4 -right-6 font-jersey text-7xl sm:text-8xl leading-none text-[#ff6600] [paint-order:stroke_fill] [-webkit-text-stroke:8px_#061338]"
                  aria-label={`Dorsal ${player.jersey_number}`}
                >
                  {player.jersey_number}
                </span>
              ) : null}
            </div>
            <PositionPitch
              position={currentPosition}
              secondaryPosition={currentSecondaryPosition}
              className="md:hidden w-16 h-auto ml-auto self-start"
            />
          </div>

          {/* Identitat */}
          <div className="min-w-0 flex flex-col justify-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight">{displayName}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
              <span className={clsx('font-semibold', hasPosition ? 'text-white' : 'text-white/60')}>
                {hasPosition ? currentPosition : 'Posició sense definir'}
                {hasSecondary && <span className="font-normal text-white/60"> o {currentSecondaryPosition}</span>}
              </span>
              <span className="inline-flex items-center gap-2 text-white/85 min-w-0">
                {player.team?.crest_url && (
                  <img
                    src={player.team.crest_url}
                    alt=""
                    className="w-6 h-6 object-contain bg-white rounded p-0.5 shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <span className="truncate">{player.team?.name || 'Sense equip'}</span>
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t border-white/10 pt-4">
              {facts.map(([term, value]) => (
                <div key={term}>
                  <dt className="text-xs text-white/50">{term}</dt>
                  <dd className="text-sm font-semibold mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Mini camp */}
          <figure className="hidden md:flex flex-col items-center gap-2">
            <PositionPitch position={currentPosition} secondaryPosition={currentSecondaryPosition} className="w-28 h-auto" />
            <figcaption className="flex gap-3 text-[11px] text-white/60">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ff6600]" /> Principal</span>
              {hasSecondary && (
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-white" /> Alternativa</span>
              )}
            </figcaption>
          </figure>
        </div>

        {/* Decisions del seleccionador */}
        <div className="bg-white text-slate-900 border-t-4 border-[#ff6600] px-5 sm:px-7 py-5 space-y-5 rounded-b-2xl relative z-20">
          <div>
            <p id="estat-label" className="text-sm font-semibold text-slate-600 mb-2">Estat a la Selecció</p>
            <div role="radiogroup" aria-labelledby="estat-label" className="flex flex-wrap gap-2">
              {STATUSES.map((s) => {
                const active = player.status === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => handleStatusChange(s.value)}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-sm border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60',
                      active ? `${s.active} font-semibold` : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-x-8 gap-y-4 sm:items-end">
            <div>
              <p className="text-sm font-semibold text-slate-600 mb-2">Valoració</p>
              <div className="flex items-center gap-2 h-[38px]">
                <StarRating rating={player.rating || 0} onChange={handleRatingChange} size="lg" />
                <span className="text-sm text-slate-500 w-14">{player.rating ? `${player.rating} de 5` : 'Sense'}</span>
              </div>
            </div>
            <div className="sm:w-56">
              <p className="text-sm font-semibold text-slate-600 mb-2">Posició principal</p>
              <CustomSelect
                value={currentPosition}
                onChange={handlePositionChange}
                options={[{ value: 'Sense definir', label: 'Sense definir' }, ...PLAYER_POSITIONS.map((pos) => ({ value: pos, label: pos }))]}
              />
            </div>
            <div className="sm:w-56">
              <p className="text-sm font-semibold text-slate-600 mb-2">Posició alternativa</p>
              <CustomSelect
                value={currentSecondaryPosition}
                onChange={handleSecondaryPositionChange}
                options={[{ value: 'Sense definir', label: 'Cap' }, ...PLAYER_POSITIONS.map((pos) => ({ value: pos, label: pos }))]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Pestanyes ───────────────────────────────────────────────────── */}
      <nav className="flex gap-1 border-b border-slate-300 overflow-x-auto" aria-label="Seccions de la fitxa">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'px-4 py-3 -mb-px text-sm whitespace-nowrap border-b-[3px] transition-colors focus:outline-none focus-visible:bg-slate-100',
                isActive ? 'border-[#ff6600] text-[#061338] font-bold' : 'border-transparent text-slate-600 hover:text-[#061338] font-medium'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={clsx('ml-1.5 tabular-nums', isActive ? 'text-[#ff6600]' : 'text-slate-400')}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── 1. Fitxa ────────────────────────────────────────────────────── */}
      {activeTab === 'fitxa' && (
        <div className="space-y-5">
          {/* Temporada en xifres, com a l'acta */}
          <section className="bg-white rounded-xl border border-slate-200">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4">
              <h2 className="text-lg font-bold text-[#061338]">Temporada 2026-2027</h2>
              <span className="text-xs text-slate-500">Dades oficials de la FFCV</span>
            </header>
            <dl className="grid grid-cols-2 sm:grid-cols-4 divide-slate-200 sm:divide-x px-1 py-4">
              {[
                ['Partits jugats', jugats, convocats > jugats ? `de ${convocats} convocatòries` : null],
                ['Minuts', minuts, jugats > 0 && minuts > 0 ? `${Math.round(minuts / jugats)}' per partit` : null],
                ['Gols', gols, jugats > 0 && gols > 0 ? `${(gols / jugats).toFixed(2).replace('.', ',')} per partit` : null],
                ['Titular', titular, suplent > 0 ? `i ${suplent} de suplent` : null]
              ].map(([label, value, detail]) => (
                <div key={label as string} className="px-4 py-2">
                  <dt className="text-sm text-slate-600">{label}</dt>
                  <dd className="font-jersey text-5xl leading-none text-[#061338] mt-1 tabular-nums">{value}</dd>
                  {detail && <dd className="text-xs text-slate-500 mt-1">{detail}</dd>}
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 px-5 py-3 text-sm text-slate-700">
              <span className="inline-flex items-center gap-2"><span className="w-3 h-4 rounded-[2px] bg-amber-400" aria-hidden /> {grogues} grogues</span>
              {dobleGroga > 0 && <span className="inline-flex items-center gap-2"><span className="w-3 h-4 rounded-[2px] bg-amber-500" aria-hidden /> {dobleGroga} doble groga</span>}
              <span className="inline-flex items-center gap-2"><span className="w-3 h-4 rounded-[2px] bg-rose-600" aria-hidden /> {vermelles} roges</span>
              {verdes > 0 && <span className="inline-flex items-center gap-2"><span className="w-3 h-4 rounded-[2px] bg-emerald-500" aria-hidden /> {verdes} verdes</span>}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Notes del cos tècnic */}
            <section className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2 flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-lg font-bold text-[#061338]">Notes de seguiment</h2>
                <button
                  type="button"
                  onClick={handleQuickSaveNotes}
                  disabled={notesInput === (player.notes || '')}
                  className="shrink-0 whitespace-nowrap px-4 py-2 bg-[#ff6600] hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60 focus-visible:ring-offset-2"
                >
                  <Save className="w-4 h-4" />
                  Desar notes
                </button>
              </div>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                rows={6}
                aria-label="Notes de seguiment"
                placeholder="Punts forts, aspectes a millorar, caràcter, partits on l'has vist…"
                className={clsx(inputClass, 'flex-1 leading-relaxed resize-y')}
              />
              <p className="text-xs text-slate-500 mt-2">Les veuen tots els seleccionadors.</p>
            </section>

            {/* Contacte */}
            <section className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-[#061338]">Contacte</h2>
                <button type="button" onClick={() => setActiveTab('dades')} className="text-sm font-semibold text-[#002568] hover:underline">
                  Editar
                </button>
              </div>
              <ul className="divide-y divide-slate-100 text-sm">
                {[
                  { who: 'Jugador', phone: player.phone, email: player.email },
                  { who: player.guardian_name ? `Família: ${player.guardian_name}` : 'Família', phone: player.guardian_phone, email: player.guardian_email }
                ].map((c) => (
                  <li key={c.who} className="py-3 first:pt-0">
                    <p className="text-slate-500">{c.who}</p>
                    {c.phone || c.email ? (
                      <div className="mt-1 space-y-1.5">
                        {c.phone && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold tabular-nums">{c.phone}</span>
                            <span className="flex gap-1.5">
                              <a href={`tel:${c.phone}`} aria-label={`Trucar a ${c.phone}`} className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
                                <Phone className="w-4 h-4" />
                              </a>
                              <a
                                href={`https://wa.me/34${c.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`WhatsApp a ${c.phone}`}
                                className="p-2 rounded-lg border border-slate-200 text-emerald-700 hover:bg-emerald-50"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            </span>
                          </div>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-[#002568] hover:underline min-w-0">
                            <Mail className="w-4 h-4 shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </a>
                        )}
                      </div>
                    ) : (
                      <button type="button" onClick={() => setActiveTab('dades')} className="mt-1 text-slate-400 hover:text-[#002568]">
                        Afegir telèfon o email
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Trajectòria */}
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-[#061338]">Trajectòria</h2>
            <p className="text-sm text-slate-600 mt-1 max-w-[70ch]">
              {infantilYearReason}
              {prevSeason && ` La temporada passada va jugar a ${prevSeason.equipo} (${prevSeason.categoria}).`}
            </p>
            {history.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">La FFCV no té temporades anteriors d'aquest jugador.</p>
            ) : (
              <ol className="mt-4 relative border-l-2 border-slate-200 ml-[7px] space-y-4">
                {history.map((h, idx) => {
                  const isCurrent = (h.temporada || '').includes('2026-2027');
                  return (
                    <li key={idx} className="pl-5 relative">
                      <span
                        className={clsx(
                          'absolute -left-[9px] top-2 w-4 h-4 rounded-full border-2 border-white',
                          isCurrent ? 'bg-[#ff6600]' : 'bg-slate-300'
                        )}
                        aria-hidden
                      />
                      <div className="flex items-center gap-3">
                        {h.escudo_url ? (
                          <img
                            src={h.escudo_url}
                            alt=""
                            className="w-8 h-8 object-contain shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.visibility = 'hidden';
                            }}
                          />
                        ) : (
                          <span className="w-8 h-8 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500 tabular-nums">{h.temporada}</p>
                          <p className={clsx('text-sm truncate', isCurrent ? 'font-bold' : 'font-semibold')}>{h.equipo}</p>
                          <p className="text-xs text-slate-600">{h.categoria}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 px-1">
            <span>Licència FFCV {player.source_player_id || 'desconeguda'}</span>
            {player.scraped_at && <span>Actualitzat el {formatAppDate(player.scraped_at)}</span>}
            {player.source_url && (
              <a href={player.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#002568] hover:underline">
                Veure la fitxa a la FFCV <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </footer>
        </div>
      )}

      {/* ── 2. Dades i contacte ─────────────────────────────────────────── */}
      {activeTab === 'dades' && (
        <form onSubmit={handleSaveContactAndNotes} className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          <fieldset className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <legend className="sr-only">Perfil esportiu</legend>
            <h2 className="sm:col-span-2 text-lg font-bold text-[#061338]" aria-hidden>Perfil esportiu</h2>
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Posició principal</p>
              <CustomSelect
                value={positionInput || 'Sense definir'}
                onChange={(val) => setPositionInput(val === 'Sense definir' ? '' : val)}
                options={[{ value: 'Sense definir', label: 'Sense definir' }, ...PLAYER_POSITIONS.map((pos) => ({ value: pos, label: pos }))]}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Posició alternativa</p>
              <CustomSelect
                value={secondaryPositionInput || 'Sense definir'}
                onChange={(val) => setSecondaryPositionInput(val === 'Sense definir' ? '' : val)}
                options={[{ value: 'Sense definir', label: 'Cap' }, ...PLAYER_POSITIONS.map((pos) => ({ value: pos, label: pos }))]}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Peu</p>
              <CustomSelect
                value={dominantFootInput}
                onChange={(val) => setDominantFootInput(val as any)}
                options={[
                  { value: 'Diestro', label: 'Dretà' },
                  { value: 'Zurdo', label: 'Esquerrà' },
                  { value: 'Ambidextro', label: 'Ambidextre' }
                ]}
              />
            </div>
            <div>
              <p className="block text-sm font-semibold text-slate-700 mb-1">Valoració</p>
              <div className="flex items-center h-[42px]">
                <StarRating rating={ratingInput} onChange={(newVal) => setRatingInput(newVal)} size="lg" showValue />
              </div>
            </div>
            <p className="sm:col-span-2 text-xs text-slate-500">
              L'equip, la categoria i l'edat venen de la FFCV i s'actualitzen sols.
            </p>
          </fieldset>

          <fieldset className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <legend className="sr-only">Contacte</legend>
            <h2 className="sm:col-span-2 text-lg font-bold text-[#061338]" aria-hidden>Contacte</h2>
            {[
              { label: 'Telèfon del jugador', type: 'tel', value: phoneInput, set: setPhoneInput, icon: Phone, placeholder: '600 123 456' },
              { label: 'Email del jugador', type: 'email', value: emailInput, set: setEmailInput, icon: Mail, placeholder: 'jugador@email.com' },
              { label: 'Nom de la mare, pare o tutor', type: 'text', value: guardianNameInput, set: setGuardianNameInput, icon: UserCheck, placeholder: 'Joan Ribes (pare)', full: true },
              { label: 'Telèfon de la família', type: 'tel', value: guardianPhoneInput, set: setGuardianPhoneInput, icon: Phone, placeholder: '611 987 654' },
              { label: 'Email de la família', type: 'email', value: guardianEmailInput, set: setGuardianEmailInput, icon: Mail, placeholder: 'familia@email.com' }
            ].map((f) => {
              const Icon = f.icon;
              return (
                <label key={f.label} className={clsx('block', f.full && 'sm:col-span-2')}>
                  <span className="block text-sm font-semibold text-slate-700 mb-1">{f.label}</span>
                  <span className="relative block">
                    <Icon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={f.type}
                      value={f.value}
                      onChange={(e) => f.set(e.target.value)}
                      placeholder={f.placeholder}
                      className={clsx(inputClass, 'pl-9')}
                    />
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className="p-5">
            <label className="block">
              <span className="block text-lg font-bold text-[#061338] mb-2">Notes de seguiment</span>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                rows={5}
                placeholder="Punts forts, aspectes a millorar, caràcter, partits on l'has vist…"
                className={clsx(inputClass, 'leading-relaxed')}
              />
            </label>
            <div className="flex justify-end mt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#ff6600] hover:bg-orange-600 text-white font-semibold text-sm rounded-lg inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60 focus-visible:ring-offset-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Desant…' : 'Desar canvis'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── 3. Convocatòries ────────────────────────────────────────────── */}
      {activeTab === 'convocatories' && (
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-lg font-bold text-[#061338]">Convocatòries de la Selecció</h2>
          {playerCallups.length === 0 ? (
            <EmptyState
              text="Encara no l'has convocat mai."
              action="Anar a convocatòries"
              onAction={() => navigate('/convocatorias')}
            />
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {playerCallups.map(({ callup, entry }) => (
                <li key={callup.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">{formatAppDate(callup.date)}</p>
                    <p className="font-semibold">{callup.title}</p>
                    {callup.location && (
                      <p className="text-sm text-slate-600 inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {callup.location}
                      </p>
                    )}
                  </div>
                  <AttendanceTag status={entry!.status} attended={entry!.attendance} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── 4. Entrenaments ─────────────────────────────────────────────── */}
      {activeTab === 'entrenaments' && (
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-lg font-bold text-[#061338]">Entrenaments de la Selecció</h2>
          {playerTrainings.length === 0 ? (
            <EmptyState
              text="No consta en cap entrenament."
              action="Anar a entrenaments"
              onAction={() => navigate('/entrenamientos')}
            />
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {playerTrainings.map(({ session, entry }) => (
                <li key={session.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">{formatAppDate(session.start_time)}</p>
                    <p className="font-semibold">{session.title}</p>
                    {session.objective && <p className="text-sm text-slate-600">{session.objective}</p>}
                  </div>
                  <AttendanceTag status={entry!.status} attended={entry!.attended} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── 5. Informes ─────────────────────────────────────────────────── */}
      {activeTab === 'informes' && (
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-lg font-bold text-[#061338]">Informes tècnics</h2>
          {playerReports.length === 0 ? (
            <EmptyState
              text="Encara no hi ha cap informe d'aquest jugador."
              action="Fer un informe"
              onAction={() => navigate('/informes')}
            />
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {playerReports.map((report) => (
                <li key={report.id} className="py-4 space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm text-slate-500">{formatAppDate(report.report_date)}</p>
                    {report.recommendation && (
                      <span className="text-sm font-semibold text-[#061338]">{report.recommendation}</span>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {SCORE_LABELS.map(([key, label]) => {
                      const score = report.scores?.[key];
                      return (
                        <div key={key}>
                          <dt className="text-xs text-slate-500">{label}</dt>
                          <dd className="flex items-center gap-2 mt-1">
                            <span className="font-jersey text-2xl leading-none tabular-nums w-7">{score ?? '–'}</span>
                            {score != null && (
                              <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <span className="block h-full bg-[#002568]" style={{ width: `${Math.min(100, score * 10)}%` }} />
                              </span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  {(report.technical_summary || report.general_notes) && (
                    <p className="text-sm text-slate-700 max-w-[75ch] leading-relaxed">
                      {report.technical_summary || report.general_notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

const EmptyState: React.FC<{ text: string; action: string; onAction: () => void }> = ({ text, action, onAction }) => (
  <div className="py-8 text-center">
    <p className="text-slate-600">{text}</p>
    <button
      type="button"
      onClick={onAction}
      className="mt-3 px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-[#061338] hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6600]/60"
    >
      {action}
    </button>
  </div>
);

const AttendanceTag: React.FC<{ status: string; attended?: boolean }> = ({ status, attended }) => {
  const positive = attended || status === 'Asistió' || status === 'Confirmado';
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-sm font-semibold', positive ? 'text-emerald-700' : 'text-slate-600')}>
      {positive ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
      {ATTENDANCE_LABELS[status] || status}
    </span>
  );
};
