import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import {
  CalendarCheck,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Eye,
  Plus,
  Trash2,
  Search,
  Check,
  X,
  FileText,
  Shield,
  Trophy,
  AlertTriangle,
  Users,
  ChevronRight,
  Navigation
} from 'lucide-react';
import { CustomSelect } from '../../components/ui/Select';
import type { ScoutingAgendaItem, Player } from '../../types/models';
import { useSelectors } from '../../hooks/useSelectors';
import { AgendaPickerModal } from '../../components/agenda/AgendaPickerModal';
import { PlayerScoutingCard } from '../../components/agenda/PlayerScoutingCard';
import { AgendaRouteMap, googleMapsRouteUrl, type RouteStop } from '../../components/agenda/AgendaRouteMap';
import { getAgendaDateTime, isMatchSchedulable, isSameSelector, resolveAgendaMatch } from '../../utils/agenda';
import { formatAppDate, formatAppDateLong, formatMatchDateTime } from '../../utils/dateFormatter';
import { formatCompetition } from '../../utils/competitionFormatter';
import type { Match } from '../../types/models';

const formatDayLabel = (date: string) => {
  return formatAppDateLong(date);
};

export const Agenda: React.FC = () => {
  const { selectors: selectorsList, currentSelectorName } = useSelectors();

  const {
    matches,
    agenda: rawAgenda,
    removeFromAgenda,
    markMatchAsObserved,
    getTeamObservationCount,
    getTeamPlayersBreakdown
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'my_agenda' | 'browse'>('my_agenda');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Planificat' | 'Observat'>('all');
  const [selectorFilter, setSelectorFilter] = useState<string>('all');
  const [searchBrowse, setSearchBrowse] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [matchdayFilter, setMatchdayFilter] = useState('all');

  // Modal de Jugadores / Plantilla del Partido
  const [selectedMatchRosterItem, setSelectedMatchRosterItem] = useState<ScoutingAgendaItem | null>(null);
  const [rosterTab, setRosterTab] = useState<'all' | 'home' | 'away'>('all');
  const [rosterSearch, setRosterSearch] = useState('');

  // Modal de Confirmación de Borrado
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<ScoutingAgendaItem | null>(null);

  // Estado para el modal de Marcar como Observado
  const [observingItem, setObservingItem] = useState<ScoutingAgendaItem | null>(null);
  const [observeNotes, setObserveNotes] = useState('');
  const [observeLocal, setObserveLocal] = useState(true);
  const [observeAway, setObserveAway] = useState(true);
  const [standoutSelected, setStandoutSelected] = useState<string[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);



  const [pickerMatch, setPickerMatch] = useState<Match | null>(null);

  // Les entrades que venen de Supabase no porten el partit: es recupera del calendari
  const agenda = useMemo(
    () => rawAgenda.map((a) => (a.match ? a : { ...a, match: resolveAgendaMatch(a, matches) })),
    [rawAgenda, matches]
  );

  // Lista de categorías únicas para el explorador
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      const cat = formatCompetition(m.competition_name, m.group_name);
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [matches]);

  // Lista de jornadas únicas
  const matchdaysList = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      if (m.matchday) set.add(m.matchday);
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '') || '0', 10);
      const numB = parseInt(b.replace(/\D/g, '') || '0', 10);
      return numA - numB;
    });
  }, [matches]);

  // Partidos en la agenda filtrados
  const filteredAgenda = useMemo(() => {
    return agenda.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesSelector = selectorFilter === 'all' || isSameSelector(item.selector_name, selectorFilter);
      return matchesStatus && matchesSelector;
    }).sort((a, b) => {
      const dateA = a.scheduled_date || a.created_at;
      const dateB = b.scheduled_date || b.created_at;
      return dateA.localeCompare(dateB);
    });
  }, [agenda, statusFilter, selectorFilter]);

  // Una columna per seleccionador, amb els partits ordenats per dia i hora i agrupats per dia
  const agendaColumns = useMemo(() => {
    const columnSelectors =
      selectorFilter === 'all'
        ? selectorsList.filter(
            (s) => isSameSelector(s, currentSelectorName) || agenda.some((a) => isSameSelector(a.selector_name, s))
          )
        : [selectorFilter];
    if (!agenda.length && selectorFilter === 'all') return [];

    return columnSelectors.map((selector) => {
      const items = filteredAgenda
        .filter((a) => isSameSelector(a.selector_name, selector))
        .map((item) => ({ item, ...getAgendaDateTime(item, item.match) }))
        .sort((a, b) => `${a.date} ${a.time || '99:99'}`.localeCompare(`${b.date} ${b.time || '99:99'}`));

      const days: { date: string; items: { item: ScoutingAgendaItem; order: number }[]; stops: RouteStop[] }[] = [];
      items.forEach(({ item, date, time }, index) => {
        let day = days.find((d) => d.date === date);
        if (!day) {
          day = { date, items: [], stops: [] };
          days.push(day);
        }
        const order = index + 1;
        day.items.push({ item, order });
        const m = item.match;
        if (m?.latitude != null && m?.longitude != null) {
          day.stops.push({
            id: item.id,
            order,
            date,
            time,
            lat: Number(m.latitude),
            lng: Number(m.longitude),
            label: `${item.home_team_name} vs ${item.away_team_name}`,
            place: m.field_name,
            observed: item.status === 'Observat'
          });
        }
      });

      return { selector, items: items.map((i) => i.item), days };
    });
  }, [filteredAgenda, agenda, selectorsList, selectorFilter, currentSelectorName]);

  // Partidos del explorador filtrados
  const filteredBrowseMatches = useMemo(() => {
    return matches.filter((m) => {
      const searchLower = searchBrowse.toLowerCase();
      const matchesSearch =
        (m.home_team_name && m.home_team_name.toLowerCase().includes(searchLower)) ||
        (m.away_team_name && m.away_team_name.toLowerCase().includes(searchLower)) ||
        (m.field_name && m.field_name.toLowerCase().includes(searchLower)) ||
        (m.city && m.city.toLowerCase().includes(searchLower));

      const matchCat = formatCompetition(m.competition_name, m.group_name);
      const matchesCategory = categoryFilter === 'all' || matchCat === categoryFilter;
      const matchesJornada = matchdayFilter === 'all' || m.matchday === matchdayFilter;

      return isMatchSchedulable(m) && matchesSearch && matchesCategory && matchesJornada;
    }).slice(0, 100); // Límite de 100 para rendimiento fluido
  }, [matches, searchBrowse, categoryFilter, matchdayFilter]);

  // Estadísticas globales de la agenda
  const agendaStats = useMemo(() => {
    const planned = agenda.filter((a) => a.status === 'Planificat').length;
    const observed = agenda.filter((a) => a.status === 'Observat').length;

    // Equipos únicos observados
    const observedTeamsSet = new Set<string>();
    agenda.forEach((a) => {
      if (a.status === 'Observat') {
        (a.observed_teams || []).forEach((t) => observedTeamsSet.add(t));
      }
    });

    return {
      total: agenda.length,
      planned,
      observed,
      observedTeamsCount: observedTeamsSet.size
    };
  }, [agenda]);

  // Abrir modal de observación
  const handleOpenObserveModal = (item: ScoutingAgendaItem) => {
    setObservingItem(item);
    setObserveNotes(item.notes || '');
    setObserveLocal(true);
    setObserveAway(true);
    setStandoutSelected(item.standout_players || []);
  };

  // Guardar observación completada
  const handleSaveObservation = () => {
    if (!observingItem) return;

    const observedTeams: string[] = [];
    if (observeLocal && observingItem.home_team_name) observedTeams.push(observingItem.home_team_name);
    if (observeAway && observingItem.away_team_name) observedTeams.push(observingItem.away_team_name);

    markMatchAsObserved(observingItem.id, {
      notes: observeNotes,
      observedTeams,
      standoutPlayers: standoutSelected,
      observedAt: new Date().toISOString()
    });

    const matchLabel = `${observingItem.home_team_name} vs ${observingItem.away_team_name}`;
    setSuccessToast(`Partit "${matchLabel}" marcat com a Observat!`);
    setTimeout(() => setSuccessToast(null), 4000);
    setObservingItem(null);
  };

  // Targeta d'un partit dins de la columna d'un seleccionador
  const renderAgendaCard = (item: ScoutingAgendaItem, order: number) => {
    const isObserved = item.status === 'Observat';
    const localBreakdown = getTeamPlayersBreakdown(item.home_team_name);
    const awayBreakdown = getTeamPlayersBreakdown(item.away_team_name);
    const localObsCount = getTeamObservationCount(item.home_team_name);
    const awayObsCount = getTeamObservationCount(item.away_team_name);
    const localPreselected = localBreakdown.playersList.filter((p) => p.status === 'Preseleccionado').length;
    const awayPreselected = awayBreakdown.playersList.filter((p) => p.status === 'Preseleccionado').length;

    const { time: itemTime } = getAgendaDateTime(item, item.match);

    return (
      <div
        key={item.id}
        onClick={() => {
          setSelectedMatchRosterItem(item);
          setRosterTab('all');
          setRosterSearch('');
        }}
        className={`rounded-xl p-5 border transition-all shadow-md flex flex-col justify-between cursor-pointer group hover:border-sky-500/60 hover:shadow-xl ${
          isObserved
            ? 'bg-slate-900/90 border-emerald-900/50 hover:border-emerald-700/60'
            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div>
          {/* Cabecera de la Tarjeta */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center text-white ${
                  isObserved ? 'bg-emerald-600' : 'bg-[#ff6600]'
                }`}
                title="Ordre a la ruta"
              >
                {order}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                  isObserved
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                    : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                }`}
              >
                {isObserved ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> Observat
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3" /> Planificat
                  </>
                )}
              </span>

              <span className="text-sky-400 font-bold text-[11px] flex items-center gap-1">
                <Trophy className="w-3 h-3 text-sky-400" />
                <span>{formatCompetition(item.match?.competition_name, item.match?.group_name)}</span>
              </span>
            </div>

            {/* Botón borrar de la agenda con confirmación */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteItem(item);
              }}
              title="Treure de l'agenda"
              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Info del Partido (Local vs Visitant) */}
          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              {/* Local */}
              <div className="flex-1 text-left min-w-0">
                <h4 className="text-sm font-black text-white break-words group-hover:text-sky-300 transition-colors">
                  {item.home_team_name}
                </h4>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[10px] text-emerald-300 font-semibold">
                    🟢 {localBreakdown.firstYear} (1r)
                  </span>
                  <span className="text-[10px] text-indigo-300 font-semibold">
                    🔵 {localBreakdown.secondYear} (2n)
                  </span>
                  {localPreselected > 0 && (
                    <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                      ⭐ {localPreselected}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">·</span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    👁️ {localObsCount}v
                  </span>
                </div>
              </div>

              <div className="px-2.5 py-1 bg-slate-950 rounded-lg text-xs font-black text-slate-400">
                VS
              </div>

              {/* Visitante */}
              <div className="flex-1 text-right min-w-0">
                <h4 className="text-sm font-black text-white break-words group-hover:text-sky-300 transition-colors">
                  {item.away_team_name}
                </h4>
                <div className="flex flex-wrap items-center justify-end gap-2 mt-1">
                  <span className="text-[10px] text-emerald-300 font-semibold">
                    🟢 {awayBreakdown.firstYear} (1r)
                  </span>
                  <span className="text-[10px] text-indigo-300 font-semibold">
                    🔵 {awayBreakdown.secondYear} (2n)
                  </span>
                  {awayPreselected > 0 && (
                    <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                      ⭐ {awayPreselected}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">·</span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    👁️ {awayObsCount}v
                  </span>
                </div>
              </div>
            </div>

            {/* Fecha, Hora y Campo */}
            <div className="bg-slate-950/60 rounded-lg p-2.5 text-xs text-slate-300 space-y-1">
              <div className="flex items-center justify-between gap-1.5 font-bold text-sky-200">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>{itemTime ? `${itemTime}h` : 'Hora per confirmar'}</span>
                </div>
                <span className="text-[10px] font-bold text-sky-400 group-hover:underline flex items-center gap-0.5">
                  Veure Plantilles i Informes <ChevronRight className="w-3 h-3" />
                </span>
              </div>

              {item.match?.field_name && (
                <div className="flex items-start gap-1.5 text-[11px] text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span className="line-clamp-2 break-words">
                    {item.match.field_name}
                    {item.match.city ? ` (${item.match.city})` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Notas de la observación (si está observado) */}
            {isObserved && item.notes && (
              <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-lg p-2.5 text-xs text-emerald-200">
                <span className="font-bold flex items-center gap-1 text-[11px] text-emerald-300 mb-0.5">
                  <FileText className="w-3 h-3" /> Notes de l'observació:
                </span>
                <p className="text-[11px] text-slate-300 italic">{item.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Botón de Acción Principal */}
        <div className="pt-3 border-t border-slate-800">
          {!isObserved ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenObserveModal(item);
              }}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Marcar com Observat (Vist)</span>
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Observació completada el{' '}
                {item.observed_at ? formatAppDate(item.observed_at) : 'recentment'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenObserveModal(item);
                }}
                className="text-xs text-sky-400 hover:underline font-bold"
              >
                Editar Notes
              </button>
            </div>
          )}
          {isObserved && (
            <p className="mt-2 text-[10.5px] font-semibold text-slate-400 flex items-center gap-1">
              <Users className="w-3 h-3 shrink-0" />
              {item.lineup_processed_at
                ? `${item.played_player_ids?.length ?? 0} jugadors que van jugar marcats com a observats (segons l'acta)`
                : "Els jugadors que juguen es marcaran com a observats 2 dies després del partit, segons l'acta"}
            </p>
          )}
        </div>
      </div>
    );
  };


  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <AgendaPickerModal match={pickerMatch} onClose={() => setPickerMatch(null)} />

      {/* Toast de Éxito */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      {/* ── CABECERA Y METRICAS DE LA AGENDA ──────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#061338] via-[#002568] to-[#003db3] rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-blue-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#ff6600]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#ff6600] text-white">
                  Scouting FFCV
                </span>
                <span className="text-xs text-sky-200 font-semibold tracking-wide">
                  Seguiment Territorial
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">
                Agenda de Seleccionadors
              </h1>
              <p className="text-sm text-sky-100/80 max-w-2xl mt-1">
                Planifica els partits a veure en directe cada cap de setmana i registra l'observació per actualitzar l'històric dels equips.
              </p>
            </div>

            {/* Identificador de seleccionador activo */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 flex items-center gap-3 shrink-0 self-start md:self-auto">
              <div className="w-9 h-9 rounded-full bg-sky-400 text-slate-950 font-black flex items-center justify-center text-xs shadow-inner">
                {currentSelectorName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <span className="text-[10px] text-sky-200 uppercase font-bold tracking-wider block">
                  Tècnic Actiu
                </span>
                <span className="text-xs font-bold text-white block truncate max-w-[140px]">
                  {currentSelectorName}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjetas de Métricas de la Agenda */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider">Total Agenda</span>
                <Calendar className="w-4 h-4 text-sky-300" />
              </div>
              <p className="text-2xl font-black text-white mt-1">{agendaStats.total}</p>
              <p className="text-[10px] text-sky-200/70 mt-0.5">Partits seleccionats</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">Planificats</span>
                <Clock className="w-4 h-4 text-amber-300" />
              </div>
              <p className="text-2xl font-black text-white mt-1">{agendaStats.planned}</p>
              <p className="text-[10px] text-amber-200/70 mt-0.5">Pendents d'assistir</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Observats</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              </div>
              <p className="text-2xl font-black text-white mt-1">{agendaStats.observed}</p>
              <p className="text-[10px] text-emerald-200/70 mt-0.5">Vistos pel cos tècnic</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Equips Coberts</span>
                <Shield className="w-4 h-4 text-indigo-300" />
              </div>
              <p className="text-2xl font-black text-white mt-1">{agendaStats.observedTeamsCount}</p>
              <p className="text-[10px] text-indigo-200/70 mt-0.5">Amb informe d'assistència</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SELECTOR DE PESTAÑAS PRINCIPALES ──────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex gap-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('my_agenda')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'my_agenda'
                ? 'bg-[#ff6600] text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-700 hover:text-[#061338] hover:bg-slate-100 shadow-xs'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Agendes ({agenda.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'browse'
                ? 'bg-[#ff6600] text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-700 hover:text-[#061338] hover:bg-slate-100 shadow-xs'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Afegir Partits des del Calendari</span>
          </button>
        </div>

        {activeTab === 'my_agenda' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Filtro Estado */}
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={[
                { value: 'all', label: 'Tots els estats' },
                { value: 'Planificat', label: `Només Planificats (${agendaStats.planned})` },
                { value: 'Observat', label: `Només Observats (${agendaStats.observed})` },
              ]}
            />

            {/* Filtro Seleccionador */}
            {selectorsList.length > 1 && (
              <CustomSelect
                value={selectorsList.find((s) => isSameSelector(s, selectorFilter)) || 'all'}
                onChange={setSelectorFilter}
                options={[
                  { value: 'all', label: 'Tots els tècnics' },
                  ...selectorsList.map((s) => ({ value: s, label: s })),
                ]}
              />
            )}
          </div>
        )}
      </div>

      {/* ── CONTENIDO PESTAÑA 1: LA MEUA AGENDA ──────────────────────────────── */}
      {activeTab === 'my_agenda' && (
        <div className="space-y-4">
          {agendaColumns.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <CalendarCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#061338]">No hi ha partits a l'agenda</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                Encara no hi ha cap partit a la planificació d'observació territorial.
              </p>
              <button
                onClick={() => setActiveTab('browse')}
                className="px-4 py-2.5 bg-[#ff6600] hover:bg-orange-600 text-white rounded-xl text-xs font-black transition-colors inline-flex items-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Explorar i Seleccionar Partits</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <div
                className="grid gap-4 items-start"
                style={{ gridTemplateColumns: `repeat(${agendaColumns.length}, minmax(340px, 1fr))` }}
              >
                {agendaColumns.map((column) => {
                  const routeStops = column.days.flatMap((d) => d.stops);
                  return (
                    <section key={column.selector} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 min-w-0">
                      {/* Capçalera del seleccionador */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#002568] text-white font-black flex items-center justify-center text-xs shrink-0">
                            {column.selector.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-black text-[#061338] uppercase truncate">
                              {column.selector}
                              {isSameSelector(column.selector, currentSelectorName) && (
                                <span className="ml-1.5 text-[10px] font-bold text-slate-400 normal-case">(tu)</span>
                              )}
                            </h3>
                            <p className="text-[11px] font-semibold text-slate-500">
                              {column.items.length} {column.items.length === 1 ? 'partit' : 'partits'} ·{' '}
                              {column.items.filter((i) => i.status === 'Observat').length} observats
                            </p>
                          </div>
                        </div>
                        {routeStops.length > 0 && (
                          <a
                            href={googleMapsRouteUrl(routeStops)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#061338] hover:bg-[#002568] text-white text-[11px] font-black transition-colors"
                            title="Obrir la ruta completa a Google Maps"
                          >
                            <Navigation className="w-3.5 h-3.5" /> Ruta
                          </a>
                        )}
                      </div>

                      {/* Mapa de la ruta */}
                      <AgendaRouteMap stops={routeStops} />

                      {column.items.length === 0 && (
                        <p className="text-xs text-slate-400 font-semibold text-center py-6">
                          Encara no hi ha partits en aquesta agenda.
                        </p>
                      )}

                      {/* Partits agrupats per dia, ordenats per hora */}
                      {column.days.map((day) => (
                        <div key={day.date || 'sense-data'} className="space-y-3">
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                            <h4 className="text-xs font-black uppercase tracking-wider text-[#002568] pt-3">
                              {formatDayLabel(day.date)}
                            </h4>
                            {day.stops.length > 1 && (
                              <a
                                href={googleMapsRouteUrl(day.stops)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pt-3 text-[11px] font-black text-[#ff6600] hover:underline inline-flex items-center gap-1"
                              >
                                <Navigation className="w-3 h-3" /> Ruta del dia
                              </a>
                            )}
                          </div>
                          {day.items.map(({ item, order }) => renderAgendaCard(item, order))}
                        </div>
                      ))}
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CONTENIDO PESTAÑA 2: EXPLORADOR DE PARTIDOS ───────────────────────── */}
      {activeTab === 'browse' && (
        <div className="space-y-4">
          {/* Barra de Filtros del Explorador */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cercar per equip, camp, municipi..."
                value={searchBrowse}
                onChange={(e) => setSearchBrowse(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600]/30 transition-all"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <CustomSelect
                theme="dark"
                value={categoryFilter}
                onChange={setCategoryFilter}
                searchable={categoriesList.length > 5}
                searchPlaceholder="Cercar categoria..."
                options={[
                  { value: 'all', label: 'Totes les categories' },
                  ...categoriesList.map((cat) => ({ value: cat, label: cat })),
                ]}
              />

              <CustomSelect
                theme="dark"
                value={matchdayFilter}
                onChange={setMatchdayFilter}
                searchable={matchdaysList.length > 8}
                searchPlaceholder="Cercar jornada..."
                options={[
                  { value: 'all', label: 'Totes les jornades' },
                  ...matchdaysList.map((j) => ({ value: j, label: j })),
                ]}
              />
            </div>
          </div>

          {/* Listado de Partidos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredBrowseMatches.map((match) => {
              const matchAgendaItems = agenda.filter((a) => a.match_id === match.id);
              const isAdded = matchAgendaItems.length > 0;
              const isObserved = matchAgendaItems.some((a) => a.status === 'Observat');

              const localBreakdown = getTeamPlayersBreakdown(match.home_team_name || '');
              const awayBreakdown = getTeamPlayersBreakdown(match.away_team_name || '');
              const localObs = getTeamObservationCount(match.home_team_name || '');
              const awayObs = getTeamObservationCount(match.away_team_name || '');

              return (
                <div
                  key={match.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition-all"
                >
                  <div>
                    {/* Header: Jornada y Competición */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800">
                      <span className="font-bold text-sky-300 flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-sky-400" />
                        <span>{formatCompetition(match.competition_name, match.group_name)} {match.matchday ? `· ${match.matchday}` : ''}</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-300 font-semibold">
                        <Clock className="w-3 h-3 text-sky-400" />
                        <span>{formatMatchDateTime(match)}</span>
                      </span>
                    </div>

                    {/* Equipos */}
                    <div className="py-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-white break-words">
                          {match.home_team_name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {localBreakdown.secondYear} de 2n any · 👁️ {localObs}v
                        </p>
                      </div>

                      <span className="text-[10px] font-black px-2 py-0.5 bg-slate-950 text-slate-400 rounded">
                        VS
                      </span>

                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-xs font-black text-white break-words">
                          {match.away_team_name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {awayBreakdown.secondYear} de 2n any · 👁️ {awayObs}v
                        </p>
                      </div>
                    </div>

                    {/* Campo */}
                    {match.field_name && (
                      <p className="text-[10px] text-slate-500 flex items-start gap-1 mb-3">
                        <MapPin className="w-3 h-3 text-slate-600 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 break-words">{match.field_name} {match.city ? `(${match.city})` : ''}</span>
                      </p>
                    )}
                  </div>

                  {/* Botón de Añadir / Estado */}
                  <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    {isAdded ? (
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className={`text-xs font-bold flex items-center gap-1 min-w-0 ${isObserved ? 'text-emerald-400' : 'text-sky-400'}`}>
                          {isObserved ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Check className="w-3.5 h-3.5 shrink-0" />}
                          <span className="truncate">{matchAgendaItems.map((a) => a.selector_name).join(', ')}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setPickerMatch(match)}
                          className="text-[11px] text-sky-300 hover:underline font-bold shrink-0"
                        >
                          Canviar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPickerMatch(match)}
                        className="w-full py-2 bg-slate-800 hover:bg-[#ff6600] text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Afegir a l'agenda</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL DE PLANTILLAS / SCOUTING DE PARTIDO AL CLICKAR ────────────── */}
      {selectedMatchRosterItem && (() => {
        const homeBD = getTeamPlayersBreakdown(selectedMatchRosterItem.home_team_name);
        const awayBD = getTeamPlayersBreakdown(selectedMatchRosterItem.away_team_name);

        let activePlayers: Player[] = [];
        if (rosterTab === 'home') activePlayers = homeBD.playersList;
        else if (rosterTab === 'away') activePlayers = awayBD.playersList;
        else activePlayers = [...homeBD.playersList, ...awayBD.playersList];

        if (rosterSearch.trim()) {
          const q = rosterSearch.toLowerCase().trim();
          activePlayers = activePlayers.filter(
            (p) =>
              p.full_name.toLowerCase().includes(q) ||
              (p.position || '').toLowerCase().includes(q) ||
              (p.jersey_number && String(p.jersey_number).includes(q)) ||
              (p.team?.name || '').toLowerCase().includes(q)
          );
        }

        const homePreselectedCount = homeBD.playersList.filter((p) => p.status === 'Preseleccionado').length;
        const awayPreselectedCount = awayBD.playersList.filter((p) => p.status === 'Preseleccionado').length;

        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fade-in"
            onClick={() => setSelectedMatchRosterItem(null)}
          >
            <div
              className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del Modal */}
              <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2.5 py-0.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-sky-400" />
                      <span>{formatCompetition(selectedMatchRosterItem.match?.competition_name, selectedMatchRosterItem.match?.group_name)}</span>
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {selectedMatchRosterItem.match?.matchday || 'Partit FFCV'}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    <span>{selectedMatchRosterItem.home_team_name}</span>
                    <span className="text-slate-500 font-normal">vs</span>
                    <span>{selectedMatchRosterItem.away_team_name}</span>
                  </h2>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1 font-semibold">
                    <span>📅 {formatAppDateLong(selectedMatchRosterItem.scheduled_date, selectedMatchRosterItem.match?.time)}</span>
                    <span>📍 {selectedMatchRosterItem.match?.field_name || 'Camp FFCV'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const item = selectedMatchRosterItem;
                      setSelectedMatchRosterItem(null);
                      handleOpenObserveModal(item);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{selectedMatchRosterItem.status === 'Observat' ? 'Editar Observació' : 'Marcar Observat'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMatchRosterItem(null)}
                    className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Barra de Filtro y Pestañas de Equipos */}
              <div className="p-4 bg-slate-900/60 border-b border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                {/* Pestañas de Equipos */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRosterTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      rosterTab === 'all'
                        ? 'bg-sky-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tots ({homeBD.total + awayBD.total})
                  </button>

                  <button
                    type="button"
                    onClick={() => setRosterTab('home')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      rosterTab === 'home'
                        ? 'bg-sky-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{selectedMatchRosterItem.home_team_name.split(' ')[0]} ({homeBD.total})</span>
                    {homePreselectedCount > 0 && (
                      <span className="bg-amber-500 text-slate-950 text-[10px] px-1 rounded-full font-black">
                        ⭐{homePreselectedCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setRosterTab('away')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      rosterTab === 'away'
                        ? 'bg-sky-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{selectedMatchRosterItem.away_team_name.split(' ')[0]} ({awayBD.total})</span>
                    {awayPreselectedCount > 0 && (
                      <span className="bg-amber-500 text-slate-950 text-[10px] px-1 rounded-full font-black">
                        ⭐{awayPreselectedCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Input de Búsqueda de Jugador */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cercar dorsal, nom, posició..."
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#ff6600]"
                  />
                  {rosterSearch && (
                    <button
                      type="button"
                      onClick={() => setRosterSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Contenido / Listado de Jugadores con Informe y Preselección */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3">
                {activePlayers.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-bold">No s'han trobat jugadors per a aquesta selecció.</p>
                  </div>
                ) : (
                  activePlayers.map((player) => <PlayerScoutingCard key={player.id} player={player} />)
                )}
              </div>

              {/* Pie del Modal */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Total en pantalla: <strong className="text-white">{activePlayers.length} jugadors</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMatchRosterItem(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white"
                >
                  Tancar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL DE CONFIRMACIÓN DE BORRADO DE PARTIDO ───────────────────────── */}
      {confirmDeleteItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setConfirmDeleteItem(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Eliminar Partit de l'Agenda</h3>
                <p className="text-xs text-slate-400">Confirmació d'acció</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <p className="text-xs font-bold text-white">
                {confirmDeleteItem.home_team_name} <span className="text-slate-500">vs</span> {confirmDeleteItem.away_team_name}
              </p>
              <p className="text-[11px] text-slate-400">
                📅 {confirmDeleteItem.scheduled_date ? formatAppDate(confirmDeleteItem.scheduled_date) : ''} · Tècnic: {confirmDeleteItem.selector_name}
              </p>
            </div>

            <p className="text-xs text-slate-300">
              Segur que vols eliminar aquest partit de la teua agenda de seguiment territorial?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel·lar
              </button>
              <button
                type="button"
                onClick={() => {
                  removeFromAgenda(confirmDeleteItem.id);
                  setSuccessToast(`Partit eliminat de l'agenda correctament.`);
                  setTimeout(() => setSuccessToast(null), 3000);
                  setConfirmDeleteItem(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-950/40"
              >
                Sí, Eliminar de l'Agenda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL MARCAR COMO OBSERVADO ───────────────────────────────────────── */}
      {observingItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            {/* Cabecera del Modal */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Completar Observació de Partit</h3>
                  <p className="text-xs text-slate-400">Actualitza el recompte d'inspecció dels equips</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setObservingItem(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-5 space-y-4">
              {/* Resumen del Partido */}
              <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 text-center">
                <p className="text-[10px] text-sky-300 font-bold uppercase tracking-wider mb-1">
                  Partit objecte de seguiment
                </p>
                <p className="text-sm font-black text-white">
                  {observingItem.home_team_name} <span className="text-slate-500 font-normal">vs</span>{' '}
                  {observingItem.away_team_name}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {observingItem.scheduled_date ? formatAppDate(observingItem.scheduled_date, observingItem.match?.time) : ''} ·{' '}
                  {observingItem.match?.field_name || 'Camp FFCV'}
                </p>
              </div>

              {/* Checkboxes de Equipos Observados */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">
                  Quins equips has observat en este partit?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={observeLocal}
                      onChange={(e) => setObserveLocal(e.target.checked)}
                      className="w-4 h-4 rounded text-[#ff6600] focus:ring-0"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-white block">{observingItem.home_team_name}</span>
                      <span className="text-[10px] text-slate-400">Equip Local (sumarà 1 observació)</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={observeAway}
                      onChange={(e) => setObserveAway(e.target.checked)}
                      className="w-4 h-4 rounded text-[#ff6600] focus:ring-0"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-white block">{observingItem.away_team_name}</span>
                      <span className="text-[10px] text-slate-400">Equip Visitant (sumarà 1 observació)</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Notas Técnicas de la Observación */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Notes tècniques del partit (opcional):
                </label>
                <textarea
                  rows={3}
                  value={observeNotes}
                  onChange={(e) => setObserveNotes(e.target.value)}
                  placeholder="Ex: Bon partit defensiu del central local. L'extrem dret visitant ha destacat en 1 contra 1..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#ff6600]"
                />
              </div>
            </div>

            {/* Pie del Modal */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setObservingItem(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel·lar
              </button>
              <button
                type="button"
                onClick={handleSaveObservation}
                disabled={!observeLocal && !observeAway}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-2 shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Observació</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
