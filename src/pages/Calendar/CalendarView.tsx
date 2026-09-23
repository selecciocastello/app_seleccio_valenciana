import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ShieldAlert,
  Dumbbell,
  MapPin,
  Search,
  Trophy,
  Navigation,
  X,
  Users,
  Info,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Check,
  CalendarCheck,
  Shield,
  LayoutGrid
} from 'lucide-react';
import clsx from 'clsx';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { CustomSelect } from '../../components/ui/Select';
import { useAppStore } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';
import type { Match, Player } from '../../types/models';

const MONTH_NAMES_CA = [
  'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
  'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'
];

const WEEKDAY_NAMES_CA = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'];
const WEEKDAY_FULL_CA = [
  'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge'
];

export const CalendarView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    callups,
    trainings,
    matches,
    agenda,
    addToAgenda,
    removeFromAgenda,
    getTeamPlayersBreakdown
  } = useAppStore();

  // Tab Principal (Partits vs Convocatòries)
  const [activeMainTab, setActiveMainTab] = useState<'matches' | 'events'>('matches');

  // Vista de partits: 'month' (Calendari Mensual) o 'jornada' (Llistat per Jornada)
  const [matchesViewMode, setMatchesViewMode] = useState<'month' | 'jornada'>('month');

  // Navegació de dates del Calendari Mensual (Per defecte: Setembre 2026, inici de la temporada)
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(8); // 8 = Setembre (0-indexed)

  // Filtres
  const [selectedComp, setSelectedComp] = useState<string>('all');
  const [selectedJornada, setSelectedJornada] = useState<string>('Jornada 1');
  const [search, setSearch] = useState<string>('');
  const [dayTypeFilter, setDayTypeFilter] = useState<'all' | 'weekend' | 'saturday' | 'sunday'>('all');
  const [startTimeFilter, setStartTimeFilter] = useState<string>('all');
  const [endTimeFilter, setEndTimeFilter] = useState<string>('all');

  // Seleccionador per defecte a qui assignar els partits a l'agenda
  const [selectedTargetSelector, setSelectedTargetSelector] = useState<string>('Víctor Zandalinas');

  // Modals
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [dayModalSearch, setDayModalSearch] = useState<string>('');

  // Llista de seleccionadors disponibles per al selector (Només els existents: Víctor Zandalinas i Administrador FFCV Castelló)
  const availableSelectors = useMemo(() => {
    return ['Víctor Zandalinas', 'Administrador FFCV Castelló'];
  }, []);

  // Competicions úniques disponibles en els partits
  const competitionsList = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      if (m.competition_name && m.group_name) {
        set.add(`${m.competition_name} - ${m.group_name}`);
      }
    });
    return Array.from(set);
  }, [matches]);

  // Llista de jornades disponibles ordenades numèricament
  const jornadasList = useMemo(() => {
    const map = new Map<string, string>();
    matches.forEach((m) => {
      if (m.matchday) {
        if (!map.has(m.matchday)) {
          map.set(m.matchday, m.matchday);
        }
      }
    });
    return Array.from(map.keys()).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
  }, [matches]);

  // Funció per formatar la hora extreta de match_time (format 15:00:00 -> 15:00)
  const formatMatchTime = useCallback((m: Match): string => {
    const rawTime = m.match_time || m.time;
    if (!rawTime) return '15:00';
    const parts = rawTime.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return rawTime;
  }, []);

  // Format net de data (elimina T00:00:00... i retorna DD/MM/YYYY)
  const formatCleanMatchDate = useCallback((dateStr?: string): string => {
    if (!dateStr) return 'Data per confirmar';
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return clean;
  }, []);

  // Comprovar si un partit està a l'agenda
  const getMatchAgendaItem = useCallback(
    (matchId: string) => {
      return agenda.find((a) => a.match_id === matchId);
    },
    [agenda]
  );

  // Alternar partit a l'agenda
  const handleToggleAgenda = useCallback(
    (e: React.MouseEvent, match: Match, customSelector?: string) => {
      e.stopPropagation();
      const existing = getMatchAgendaItem(match.id);
      const targetSelector = customSelector || selectedTargetSelector;

      if (existing) {
        removeFromAgenda(existing.id);
        showToast(`Partit eliminat de l'agenda`, 'info');
      } else {
        addToAgenda(match, targetSelector);
        showToast(`Partit afegit a l'agenda de ${targetSelector}`, 'success');
      }
    },
    [getMatchAgendaItem, selectedTargetSelector, addToAgenda, removeFromAgenda, showToast]
  );

  // Filtrado de partits
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const compKey = `${m.competition_name} - ${m.group_name}`;
      const matchesComp = selectedComp === 'all' || compKey === selectedComp;
      const matchesJornada =
        matchesViewMode === 'month' || selectedJornada === 'all' || m.matchday === selectedJornada;

      const matchesSearch =
        !search ||
        (m.home_team_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.away_team_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.field_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.city || '').toLowerCase().includes(search.toLowerCase());

      // Filtre per tipus de dia
      let matchesDayType = true;
      if (dayTypeFilter !== 'all' && m.match_date) {
        const d = new Date(m.match_date);
        const dayOfWeek = (d.getDay() + 6) % 7; // 0=Dl, 5=Ds, 6=Dg
        if (dayTypeFilter === 'weekend') matchesDayType = dayOfWeek === 5 || dayOfWeek === 6;
        if (dayTypeFilter === 'saturday') matchesDayType = dayOfWeek === 5;
        if (dayTypeFilter === 'sunday') matchesDayType = dayOfWeek === 6;
      }

      // Filtre per horari del partit (De quina hora a quina hora)
      let matchesTimeRange = true;
      if (startTimeFilter !== 'all' || endTimeFilter !== 'all') {
        const mTime = formatMatchTime(m); // "11:15"
        if (startTimeFilter !== 'all' && mTime < startTimeFilter) {
          matchesTimeRange = false;
        }
        if (endTimeFilter !== 'all' && mTime > endTimeFilter) {
          matchesTimeRange = false;
        }
      }

      return matchesComp && matchesJornada && matchesSearch && matchesDayType && matchesTimeRange;
    });
  }, [matches, selectedComp, selectedJornada, search, matchesViewMode, dayTypeFilter, startTimeFilter, endTimeFilter, formatMatchTime]);

  // Mapa de partits agrupats per data (YYYY-MM-DD)
  const matchesByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    filteredMatches.forEach((m) => {
      if (m.match_date) {
        const dateKey = m.match_date.includes('T') ? m.match_date.split('T')[0] : m.match_date;
        const existing = map.get(dateKey) || [];
        existing.push(m);
        map.set(dateKey, existing);
      }
    });
    return map;
  }, [filteredMatches]);

  // Dies de la graella del calendari mensual
  const calendarGridDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // 0 = Dilluns
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isWeekend: boolean;
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Dies del mes anterior
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(currentYear, currentMonth - 1, d);
      const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = (prevDate.getDay() + 6) % 7;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend: dayOfWeek === 5 || dayOfWeek === 6
      });
    }

    // Dies del mes actual
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const curDate = new Date(currentYear, currentMonth, d);
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = (curDate.getDay() + 6) % 7;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isWeekend: dayOfWeek === 5 || dayOfWeek === 6
      });
    }

    // Dies del mes següent
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(currentYear, currentMonth + 1, d);
      const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = (nextDate.getDay() + 6) % 7;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend: dayOfWeek === 5 || dayOfWeek === 6
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Partits del mes actual seleccionat
  const currentMonthMatchesCount = useMemo(() => {
    let count = 0;
    calendarGridDays.forEach((d) => {
      if (d.isCurrentMonth) {
        count += (matchesByDate.get(d.dateStr) || []).length;
      }
    });
    return count;
  }, [calendarGridDays, matchesByDate]);

  // Partits del dia seleccionat per al modal del dia (amb suport de cerca)
  const selectedDayMatches = useMemo(() => {
    if (!selectedDayDate) return [];
    const list = matchesByDate.get(selectedDayDate) || [];
    if (!dayModalSearch.trim()) return list;
    const q = dayModalSearch.toLowerCase().trim();
    return list.filter(
      (m) =>
        (m.home_team_name || '').toLowerCase().includes(q) ||
        (m.away_team_name || '').toLowerCase().includes(q) ||
        (m.field_name || '').toLowerCase().includes(q) ||
        (m.city || '').toLowerCase().includes(q) ||
        (m.group_name || '').toLowerCase().includes(q) ||
        (m.competition_name || '').toLowerCase().includes(q)
    );
  }, [selectedDayDate, matchesByDate, dayModalSearch]);

  // Navegació de mesos
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleResetToSeasonStart = () => {
    setCurrentYear(2026);
    setCurrentMonth(8); // Setembre
  };

  // Jugadors del partit seleccionat per al modal de detall
  const matchRosters = useMemo(() => {
    if (!selectedMatch) return { homePlayers: [], awayPlayers: [], homeBreakdown: null, awayBreakdown: null };

    const homeBreakdown = getTeamPlayersBreakdown(selectedMatch.home_team_name || '');
    const awayBreakdown = getTeamPlayersBreakdown(selectedMatch.away_team_name || '');

    return {
      homePlayers: homeBreakdown.playersList,
      awayPlayers: awayBreakdown.playersList,
      homeBreakdown,
      awayBreakdown
    };
  }, [selectedMatch, getTeamPlayersBreakdown]);

  // Format amigable de data
  const formatMatchDateLong = (dateStr?: string) => {
    if (!dateStr) return 'Data per confirmar';
    try {
      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        return date.toLocaleDateString('ca-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      const date = new Date(dateStr);
      return date.toLocaleDateString('ca-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── HEADER PRINCIPAL ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#061338] uppercase tracking-wider flex items-center gap-3">
            <span>Agenda i Calendari de Partits</span>
            <span className="bg-[#ff6600]/10 text-[#ff6600] border border-[#ff6600]/30 text-xs px-2.5 py-0.5 rounded-full font-black">
              FFCV Oficial
            </span>
          </h1>
          <p className="text-xs font-semibold text-slate-600 mt-1">
            Partits oficials de futbol infantil (Preferent i Primera Infantil), instal·lacions, escuts, jugadors de 1r i 2n any i gestió d'agenda
          </p>
        </div>

        {/* Tab Selector Principal (Partits vs Convocatòries) */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shrink-0 overflow-x-auto custom-scrollbar w-full sm:w-auto">
          <button
            onClick={() => setActiveMainTab('matches')}
            className={clsx(
              "px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap shrink-0",
              activeMainTab === 'matches'
                ? "bg-[#002568] text-white shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Trophy className="w-3.5 h-3.5 text-sky-400" />
            <span>Partits FFCV ({matches.length})</span>
          </button>
          <button
            onClick={() => setActiveMainTab('events')}
            className={clsx(
              "px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap shrink-0",
              activeMainTab === 'events'
                ? "bg-[#002568] text-white shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Convocatòries ({callups.length + trainings.length})</span>
          </button>
        </div>
      </div>

      {activeMainTab === 'matches' && (
        <div className="space-y-4">
          {/* ── BARRA DE FILTRES I SELECTOR DE VISTA ─────────────────────────── */}
          <Card className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Buscador de partits */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cercar equip, camp o municipi..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Selector de Mode de Vista: Mensual vs Jornada */}
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setMatchesViewMode('month')}
                  className={clsx(
                    "px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all",
                    matchesViewMode === 'month'
                      ? "bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  <CalendarDays className="w-4 h-4" />
                  <span>Calendari Mensual</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMatchesViewMode('jornada')}
                  className={clsx(
                    "px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all",
                    matchesViewMode === 'jornada'
                      ? "bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Llistat per Jornada</span>
                </button>
              </div>
            </div>

            {/* Filtres Específics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
              {/* Filtro Competición / Grupo */}
              <CustomSelect
                theme="dark"
                value={selectedComp}
                onChange={setSelectedComp}
                searchable={competitionsList.length > 5}
                searchPlaceholder="Cercar competició..."
                options={[
                  { value: 'all', label: 'Totes les Competicions i Grups' },
                  ...competitionsList.map((c) => ({ value: c, label: c }))
                ]}
              />

              {/* Filtro de Jornada (en vista jornada) o Tipus de Dia (en vista mensual) */}
              {matchesViewMode === 'jornada' ? (
                <CustomSelect
                  theme="dark"
                  value={selectedJornada}
                  onChange={setSelectedJornada}
                  searchable={jornadasList.length > 8}
                  searchPlaceholder="Cercar jornada..."
                  options={[
                    { value: 'all', label: 'Totes les Jornades (1 a 30)' },
                    ...jornadasList.map((j) => ({ value: j, label: j }))
                  ]}
                />
              ) : (
                <CustomSelect
                  theme="dark"
                  value={dayTypeFilter}
                  onChange={(val) => setDayTypeFilter(val as any)}
                  options={[
                    { value: 'all', label: 'Tots els dies de partit' },
                    { value: 'weekend', label: 'Cap de setmana (Ds i Dg)' },
                    { value: 'saturday', label: 'Només Dissabtes' },
                    { value: 'sunday', label: 'Només Diumenges' }
                  ]}
                />
              )}

              {/* Selector de Seleccionador destí per a l'agenda */}
              <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <CalendarCheck className="w-4 h-4 text-[#ff6600] shrink-0" />
                  <span className="truncate">Afegir partits a l'agenda de:</span>
                </div>
                <div className="w-full sm:w-52">
                  <CustomSelect
                    theme="dark"
                    size="sm"
                    value={selectedTargetSelector}
                    onChange={setSelectedTargetSelector}
                    options={availableSelectors.map((s) => ({ value: s, label: s }))}
                  />
                </div>
              </div>
            </div>

            {/* Filtre per Franja Horària (De quina hora a quina hora) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2.5 border-t border-slate-800/60 bg-slate-950/50 p-3 rounded-2xl border border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 shrink-0">
                <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Filtrar per Hora del Partit:</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Hora Des de */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">Des de:</span>
                  <div className="w-32">
                    <CustomSelect
                      theme="dark"
                      size="sm"
                      value={startTimeFilter}
                      onChange={setStartTimeFilter}
                      options={[
                        { value: 'all', label: 'Inici (00:00)' },
                        { value: '09:00', label: '09:00 h' },
                        { value: '10:00', label: '10:00 h' },
                        { value: '11:00', label: '11:00 h' },
                        { value: '12:00', label: '12:00 h' },
                        { value: '13:00', label: '13:00 h' },
                        { value: '15:00', label: '15:00 h' },
                        { value: '16:00', label: '16:00 h' },
                        { value: '17:00', label: '17:00 h' },
                        { value: '18:00', label: '18:00 h' },
                        { value: '19:00', label: '19:00 h' },
                        { value: '20:00', label: '20:00 h' }
                      ]}
                    />
                  </div>
                </div>

                {/* Hora Fins a */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">Fins a:</span>
                  <div className="w-32">
                    <CustomSelect
                      theme="dark"
                      size="sm"
                      value={endTimeFilter}
                      onChange={setEndTimeFilter}
                      options={[
                        { value: 'all', label: 'Fi (23:59)' },
                        { value: '11:00', label: '11:00 h' },
                        { value: '12:00', label: '12:00 h' },
                        { value: '13:00', label: '13:00 h' },
                        { value: '14:00', label: '14:00 h' },
                        { value: '15:00', label: '15:00 h' },
                        { value: '16:00', label: '16:00 h' },
                        { value: '17:00', label: '17:00 h' },
                        { value: '18:00', label: '18:00 h' },
                        { value: '19:00', label: '19:00 h' },
                        { value: '20:00', label: '20:00 h' },
                        { value: '21:00', label: '21:00 h' },
                        { value: '22:00', label: '22:00 h' }
                      ]}
                    />
                  </div>
                </div>

                {/* Presets ràpids */}
                <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                  <button
                    type="button"
                    onClick={() => {
                      setStartTimeFilter('09:00');
                      setEndTimeFilter('14:00');
                    }}
                    className={clsx(
                      "px-2.5 py-1 rounded-lg text-xs font-black transition-all border",
                      startTimeFilter === '09:00' && endTimeFilter === '14:00'
                        ? "bg-sky-600 text-white border-sky-400"
                        : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    Matí (9h-14h)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStartTimeFilter('14:00');
                      setEndTimeFilter('22:00');
                    }}
                    className={clsx(
                      "px-2.5 py-1 rounded-lg text-xs font-black transition-all border",
                      startTimeFilter === '14:00' && endTimeFilter === '22:00'
                        ? "bg-sky-600 text-white border-sky-400"
                        : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    Vesprada (14h-22h)
                  </button>

                  {(startTimeFilter !== 'all' || endTimeFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartTimeFilter('all');
                        setEndTimeFilter('all');
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                    >
                      Totes les hores ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Llegenda explicativa de colors dels jugadors */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 text-xs text-slate-400 border-t border-slate-800/60">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-semibold text-[11px] sm:text-xs">
                <span className="text-slate-300 font-bold uppercase tracking-wider text-[10px] sm:text-[11px]">
                  Colors Jugadors:
                </span>
                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  🟢 Infantil 1er any (2014)
                </span>
                <span className="inline-flex items-center gap-1 bg-sky-500/10 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                  🔵 Infantil 2n any (2013)
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] sm:text-xs font-bold">
                <Clock className="w-3 h-3 text-sky-400" />
                <span>Hora FFCV extreta de <code className="text-sky-300 bg-slate-950 px-1 py-0.2 rounded text-[10px]">match_time</code> (15:00:00)</span>
              </div>
            </div>
          </Card>

          {/* ── VISTA 1: CALENDARI MENSUAL ────────────────────────────────────── */}
          {matchesViewMode === 'month' && (
            <div className="space-y-4">
              {/* Barra de Navegació del Mes */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePrevMonth}
                    className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-white flex items-center justify-center transition-all shadow-md active:scale-95"
                    title="Mes anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="text-center sm:text-left">
                    <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider flex items-center gap-2.5">
                      <span>{MONTH_NAMES_CA[currentMonth]} {currentYear}</span>
                    </h2>
                    <p className="text-xs font-semibold text-slate-400">
                      {currentMonthMatchesCount} partits programats en aquest mes
                    </p>
                  </div>

                  <button
                    onClick={handleNextMonth}
                    className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-white flex items-center justify-center transition-all shadow-md active:scale-95"
                    title="Mes següent"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetToSeasonStart}
                    className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500 text-xs font-bold text-sky-400 hover:text-white transition-all shadow-sm"
                  >
                    Setembre 2026 (Inici)
                  </button>

                  <button
                    onClick={() => {
                      const now = new Date();
                      setCurrentYear(now.getFullYear());
                      setCurrentMonth(now.getMonth());
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#002568] hover:bg-blue-900 border border-sky-500/30 text-xs font-bold text-white transition-all shadow-md"
                  >
                    Hui (Mes actual)
                  </button>
                </div>
              </div>

              {/* Graella del Calendari Mensual (7 Columnes) */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-3xl p-3 sm:p-5 shadow-2xl overflow-hidden">
                {/* Capçalera de Dies de la Setmana */}
                <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-3 text-center">
                  {WEEKDAY_NAMES_CA.map((dayName, idx) => {
                    const isWeekend = idx === 5 || idx === 6;
                    return (
                      <div
                        key={dayName}
                        className={clsx(
                          "py-2 sm:py-2.5 rounded-xl font-black text-xs uppercase tracking-wider",
                          isWeekend
                            ? "bg-[#ff6600]/10 text-[#ff6600] border border-[#ff6600]/20"
                            : "bg-slate-900/80 text-slate-300 border border-slate-800"
                        )}
                      >
                        <span className="hidden sm:inline">{WEEKDAY_FULL_CA[idx]}</span>
                        <span className="sm:hidden">{dayName}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Graella de Cel·les de Dies */}
                <div className="grid grid-cols-7 gap-2 sm:gap-3">
                  {calendarGridDays.map((cell, idx) => {
                    const dayMatches = matchesByDate.get(cell.dateStr) || [];
                    const hasMatches = dayMatches.length > 0;
                    const isRightCols = (idx % 7) >= 4;
                    const isBottomRows = idx >= 21;

                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => {
                          if (hasMatches) {
                            setSelectedDayDate(cell.dateStr);
                          }
                        }}
                        className={clsx(
                          "h-[115px] sm:h-[135px] rounded-2xl p-2 sm:p-2.5 flex flex-col justify-between transition-all relative border group select-none",
                          cell.isCurrentMonth
                            ? hasMatches
                              ? "bg-slate-900/90 border-slate-800 hover:border-sky-500 hover:shadow-xl hover:shadow-sky-950/60 hover:bg-slate-850 cursor-pointer"
                              : "bg-slate-900/40 border-slate-800/60"
                            : "bg-slate-950/50 border-slate-900 opacity-35 hover:opacity-75",
                          cell.isToday && "ring-2 ring-[#ff6600] border-[#ff6600]"
                        )}
                      >
                        {/* Capçalera del Dia (Número + Badge de Partits) */}
                        <div className="flex items-center justify-between gap-1 mb-1 shrink-0">
                          <span
                            className={clsx(
                              "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-all",
                              cell.isToday
                                ? "bg-[#ff6600] text-white shadow-md"
                                : cell.isWeekend
                                ? "text-[#ff6600] font-black"
                                : cell.isCurrentMonth
                                ? "text-slate-200"
                                : "text-slate-500"
                            )}
                          >
                            {cell.dayNumber}
                          </span>

                          {hasMatches && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/15 text-sky-300 border border-sky-500/30 group-hover:bg-sky-500 group-hover:text-slate-950 transition-all shrink-0"
                            >
                              {dayMatches.length} {dayMatches.length === 1 ? 'partit' : 'partits'}
                            </span>
                          )}
                        </div>

                        {/* Contingut resumit dels partits (1 o 2 mini-files elegants) */}
                        <div className="space-y-1 flex-1 overflow-hidden flex flex-col justify-center">
                          {hasMatches ? (
                            <>
                              {dayMatches.slice(0, 2).map((m) => {
                                const homeBD = getTeamPlayersBreakdown(m.home_team_name || '');
                                const awayBD = getTeamPlayersBreakdown(m.away_team_name || '');
                                const matchTime = formatMatchTime(m);
                                const inAgenda = Boolean(getMatchAgendaItem(m.id));

                                return (
                                  <div
                                    key={m.id}
                                    className={clsx(
                                      "px-1.5 py-0.5 rounded-md border text-[10px] font-bold transition-all flex items-center justify-between gap-1 truncate",
                                      inAgenda
                                        ? "bg-amber-950/40 border-amber-500/40 text-amber-200"
                                        : "bg-slate-950/70 border-slate-800/80 text-slate-300 group-hover:border-slate-700"
                                    )}
                                  >
                                    <span className="text-sky-400 font-black shrink-0 text-[9px]">{matchTime}</span>
                                    <span className="truncate flex-1 font-semibold text-[9px] text-slate-200">
                                      {m.home_team_name?.split(' ')[0]} - {m.away_team_name?.split(' ')[0]}
                                    </span>
                                    <div className="flex items-center gap-0.5 shrink-0 text-[8px] font-black">
                                      {homeBD.firstYear + awayBD.firstYear > 0 && <span className="text-emerald-400">🟢{homeBD.firstYear + awayBD.firstYear}</span>}
                                      {homeBD.secondYear + awayBD.secondYear > 0 && <span className="text-sky-400">🔵{homeBD.secondYear + awayBD.secondYear}</span>}
                                    </div>
                                  </div>
                                );
                              })}

                              {dayMatches.length > 2 && (
                                <div className="w-full py-0.5 px-1 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[9px] font-black text-center truncate">
                                  +{dayMatches.length - 2} partits més...
                                </div>
                              )}
                            </>
                          ) : (
                            cell.isCurrentMonth && (
                              <div className="text-[10px] text-slate-600/70 italic text-center py-1">
                                Sense partits
                              </div>
                            )
                          )}
                        </div>

                        {/* ── POP-OVER FLOTANT EN PASSAR EL RATOLÍ (HOVER CARD) ─────────────── */}
                        {hasMatches && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDayDate(cell.dateStr);
                            }}
                            className={clsx(
                              "absolute z-50 w-72 sm:w-80 p-3.5 rounded-2xl bg-slate-950/98 backdrop-blur-2xl border border-sky-500/50 shadow-2xl transition-all duration-150 pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 hidden md:block",
                              isBottomRows ? "bottom-full mb-2" : "top-full mt-2",
                              isRightCols ? "right-0" : "left-0"
                            )}
                          >
                            {/* Header del Hover Popover */}
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                              <div>
                                <span className="text-xs font-black text-white capitalize block">
                                  {formatMatchDateLong(cell.dateStr)}
                                </span>
                                <span className="text-[10px] font-bold text-sky-400">
                                  {dayMatches.length} partits programats
                                </span>
                              </div>
                              <span className="text-[9px] font-extrabold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full">
                                Clica per obrir
                              </span>
                            </div>

                            {/* Llista de partits dins del hover */}
                            <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                              {dayMatches.slice(0, 5).map((m) => {
                                const homeBD = getTeamPlayersBreakdown(m.home_team_name || '');
                                const awayBD = getTeamPlayersBreakdown(m.away_team_name || '');
                                const matchTime = formatMatchTime(m);
                                const inAgenda = Boolean(getMatchAgendaItem(m.id));

                                return (
                                  <div
                                    key={m.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMatch(m);
                                    }}
                                    className={clsx(
                                      "p-1.5 rounded-xl border text-[10px] font-bold transition-all flex flex-col gap-1 cursor-pointer hover:border-sky-400",
                                      inAgenda
                                        ? "bg-amber-950/40 border-amber-500/50"
                                        : "bg-slate-900/90 border-slate-800/90"
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-1 text-[9px]">
                                      <span className="text-sky-400 font-extrabold truncate flex items-center gap-1">
                                        <Trophy className="w-2.5 h-2.5 shrink-0" />
                                        <span>{m.competition_name || 'Lliga FFCV'}{m.group_name ? ` · ${m.group_name}` : ''}</span>
                                      </span>
                                      <span className="text-white font-black bg-slate-950 px-1 py-0.2 rounded">
                                        🕒 {matchTime}
                                      </span>
                                    </div>

                                    {/* Local */}
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1 min-w-0 flex-1">
                                        <img
                                          src={m.home_crest || 'https://appwebffcv.novanet.es/pnfg/usr/local/projects/weblogic/repository/AS400/02/DOCS/201211/14/12043583.jpg'}
                                          alt=""
                                          className="w-3 h-3 object-contain shrink-0"
                                          onError={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
                                        />
                                        <span className="truncate text-white font-bold text-[10px]">{m.home_team_name}</span>
                                      </div>
                                      <span className="text-[8px] font-black shrink-0">
                                        🟢{homeBD.firstYear} 🔵{homeBD.secondYear}
                                      </span>
                                    </div>

                                    {/* Visitant */}
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1 min-w-0 flex-1">
                                        <img
                                          src={m.away_crest || 'https://appwebffcv.novanet.es/pnfg/usr/local/projects/weblogic/repository/AS400/02/DOCS/201306/21/12080863.jpg'}
                                          alt=""
                                          className="w-3 h-3 object-contain shrink-0"
                                          onError={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
                                        />
                                        <span className="truncate text-slate-300 font-bold text-[10px]">{m.away_team_name}</span>
                                      </div>
                                      <span className="text-[8px] font-black shrink-0">
                                        🟢{awayBD.firstYear} 🔵{awayBD.secondYear}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}

                              {dayMatches.length > 5 && (
                                <p className="text-[9px] font-bold text-slate-400 text-center py-0.5">
                                  +{dayMatches.length - 5} partits addicionals...
                                </p>
                              )}
                            </div>

                            {/* Footer del Popover */}
                            <div className="mt-2.5 pt-2 border-t border-slate-800 text-center">
                              <span className="text-[10px] font-extrabold text-[#ff6600] hover:underline flex items-center justify-center gap-1">
                                <span>Fes clic per obrir tot el dia</span>
                                <span>→</span>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── VISTA 2: LLISTAT PER JORNADA (TRADICIONAL) ───────────────────── */}
          {matchesViewMode === 'jornada' && (
            <div className="space-y-4">
              {filteredMatches.length === 0 ? (
                <Card className="p-12 text-center text-slate-400 space-y-2 border border-slate-800 bg-slate-950/80 rounded-2xl">
                  <Trophy className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="font-bold">No s'han trobat partits amb els filtres seleccionats.</p>
                  <p className="text-xs text-slate-500">Prova de canviar de jornada o cercar un altre equip.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMatches.map((m) => {
                    const homeBD = getTeamPlayersBreakdown(m.home_team_name || '');
                    const awayBD = getTeamPlayersBreakdown(m.away_team_name || '');
                    const matchTime = formatMatchTime(m);
                    const inAgenda = Boolean(getMatchAgendaItem(m.id));

                    return (
                      <div key={m.id} className="flex flex-col space-y-1.5">
                        {/* Etiqueta superior del partit: Competicio, Jornada i Data */}
                        <div className="flex items-center justify-between px-2 text-[11px] text-slate-400 font-bold">
                          <span className="flex items-center gap-1.5 text-sky-400">
                            <Trophy className="w-3 h-3" />
                            <span>{m.competition_name} • {m.group_name}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300 font-bold">{formatCleanMatchDate(m.match_date)}</span>
                            <span className="bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                              {m.matchday || 'Partit'}
                            </span>
                          </div>
                        </div>

                        {/* Targeta de Partit interactiva */}
                        <div
                          className="match-card group cursor-pointer"
                          onClick={() => setSelectedMatch(m)}
                        >
                          {/* Costat Esquerre: Equips, Escuts i Desglossament de Jugadors */}
                          <div className="match-left space-y-2">
                            {/* Fila Equip Local */}
                            <div className="team-row flex items-center justify-between gap-1.5 sm:gap-2">
                              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                                <img
                                  className="team-logo lazy-logo shrink-0"
                                  src={m.home_crest || 'https://appwebffcv.novanet.es/pnfg/usr/local/projects/weblogic/repository/AS400/02/DOCS/201211/14/12043583.jpg'}
                                  alt={m.home_team_name || 'Local'}
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                                <span className="team-row-name font-extrabold text-white leading-tight flex-1 min-w-0" title={m.home_team_name}>
                                  {m.home_team_name}
                                </span>
                              </div>

                              {/* Badges 1r i 2n any Local */}
                              {(homeBD.firstYear > 0 || homeBD.secondYear > 0) && (
                                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 ml-1">
                                  {homeBD.firstYear > 0 && (
                                    <span
                                      className="px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded text-[7.5px] sm:text-[8.5px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap"
                                      title={`${homeBD.firstYear} jugadors d'Infantil 1er any`}
                                    >
                                      🟢 {homeBD.firstYear}<span className="hidden sm:inline"> (1r)</span>
                                    </span>
                                  )}
                                  {homeBD.secondYear > 0 && (
                                    <span
                                      className="px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded text-[7.5px] sm:text-[8.5px] font-black bg-sky-500/20 text-sky-300 border border-sky-500/30 whitespace-nowrap"
                                      title={`${homeBD.secondYear} jugadors d'Infantil 2n any`}
                                    >
                                      🔵 {homeBD.secondYear}<span className="hidden sm:inline"> (2n)</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Fila Equip Visitant */}
                            <div className="team-row flex items-center justify-between gap-1.5 sm:gap-2">
                              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                                <img
                                  className="team-logo lazy-logo shrink-0"
                                  src={m.away_crest || 'https://appwebffcv.novanet.es/pnfg/usr/local/projects/weblogic/repository/AS400/02/DOCS/201306/21/12080863.jpg'}
                                  alt={m.away_team_name || 'Visitante'}
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                                <span className="team-row-name font-extrabold text-white leading-tight flex-1 min-w-0" title={m.away_team_name}>
                                  {m.away_team_name}
                                </span>
                              </div>

                              {/* Badges 1r i 2n any Visitant */}
                              {(awayBD.firstYear > 0 || awayBD.secondYear > 0) && (
                                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 ml-1">
                                  {awayBD.firstYear > 0 && (
                                    <span
                                      className="px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded text-[7.5px] sm:text-[8.5px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap"
                                      title={`${awayBD.firstYear} jugadors d'Infantil 1er any`}
                                    >
                                      🟢 {awayBD.firstYear}<span className="hidden sm:inline"> (1r)</span>
                                    </span>
                                  )}
                                  {awayBD.secondYear > 0 && (
                                    <span
                                      className="px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded text-[7.5px] sm:text-[8.5px] font-black bg-sky-500/20 text-sky-300 border border-sky-500/30 whitespace-nowrap"
                                      title={`${awayBD.secondYear} jugadors d'Infantil 2n any`}
                                    >
                                      🔵 {awayBD.secondYear}<span className="hidden sm:inline"> (2n)</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Divisor Central */}
                          <div className="match-divider"></div>

                          {/* Costat Dret: Hora FFCV i Botó Agenda */}
                          <div className="match-right space-y-1.5 sm:space-y-2">
                            <div className="m-time text-sm sm:text-base font-black text-sky-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span>{matchTime}</span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleToggleAgenda(e, m)}
                              className={clsx(
                                "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all shadow-sm shrink-0",
                                inAgenda
                                  ? "bg-emerald-600 text-white hover:bg-rose-600"
                                  : "bg-[#ff6600] hover:bg-orange-600 text-white"
                              )}
                            >
                              {inAgenda ? (
                                <>
                                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                  <span>En Agenda</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                  <span>+ Agenda</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Sub-barra: Camp i GPS */}
                        <div className="flex items-start justify-between gap-2 px-2 text-[11px] text-slate-400">
                          <div className="flex items-start gap-1.5 max-w-[70%]">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="font-semibold text-slate-300 line-clamp-1 break-words">
                              {m.field_name || 'Camp per determinar'}
                              {m.city && <span className="text-slate-500"> ({m.city})</span>}
                            </span>
                          </div>

                          {m.latitude && m.longitude ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${m.latitude},${m.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 shrink-0"
                            >
                              <Navigation className="w-2.5 h-2.5" />
                              <span>GPS ({m.latitude.toFixed(3)}, {m.longitude.toFixed(3)})</span>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL DEL DIA SELECCIONAT ("PARTITS DEL DIA") ───────────────────── */}
      {selectedDayDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedDayDate(null)}
        >
          <div
            className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl custom-scrollbar flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal del Dia */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-950/95 backdrop-blur-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Partits del {formatMatchDateLong(selectedDayDate)}
                  </h3>
                  <p className="text-xs font-semibold text-slate-400">
                    {selectedDayMatches.length} partits programats en aquesta data
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDayDate(null)}
                className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Barra de control del modal: Cerca de partits del dia + Seleccionador */}
            <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={dayModalSearch}
                  onChange={(e) => setDayModalSearch(e.target.value)}
                  placeholder="Cercar equip, camp o categoria d'aquest dia..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                />
                {dayModalSearch && (
                  <button
                    onClick={() => setDayModalSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300 whitespace-nowrap">
                  Agenda per a:
                </span>
                <div className="w-48 sm:w-56">
                  <CustomSelect
                    theme="dark"
                    size="sm"
                    value={selectedTargetSelector}
                    onChange={setSelectedTargetSelector}
                    options={availableSelectors.map((s) => ({ value: s, label: s }))}
                  />
                </div>
              </div>
            </div>

            {/* Llistat de partits d'aquest dia */}
            <div className="p-4 sm:p-6 space-y-4">
              {selectedDayMatches.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="font-bold">No hi ha partits registrats per a aquesta data amb els filtres actius.</p>
                </div>
              ) : (
                selectedDayMatches.map((m) => {
                  const homeBD = getTeamPlayersBreakdown(m.home_team_name || '');
                  const awayBD = getTeamPlayersBreakdown(m.away_team_name || '');
                  const matchTime = formatMatchTime(m);
                  const inAgenda = Boolean(getMatchAgendaItem(m.id));

                  return (
                    <div
                      key={m.id}
                      className="bg-slate-900/80 border border-slate-800 hover:border-sky-500/50 rounded-2xl p-4 sm:p-5 transition-all space-y-4"
                    >
                      {/* Capçalera del partit */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-sky-500/10 text-sky-300 border border-sky-500/20 px-2.5 py-1 rounded-lg text-xs font-black uppercase flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-sky-400" />
                            <span>{m.competition_name || 'Lliga FFCV'}{m.group_name ? ` · ${m.group_name}` : ''}</span>
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            {m.matchday || 'Partit oficial'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className="inline-flex items-center gap-1.5 text-sm font-black text-sky-300 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800"
                            title={`Hora oficial match_time: ${m.match_time || m.time || '15:00:00'}`}
                          >
                            <Clock className="w-3.5 h-3.5 text-sky-400" />
                            <span>{matchTime} h</span>
                          </span>

                          <button
                            type="button"
                            onClick={(e) => handleToggleAgenda(e, m)}
                            className={clsx(
                              "px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md",
                              inAgenda
                                ? "bg-emerald-600 hover:bg-rose-600 text-white"
                                : "bg-[#ff6600] hover:bg-orange-600 text-white"
                            )}
                          >
                            {inAgenda ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>A l'Agenda ({getMatchAgendaItem(m.id)?.selector_name})</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Afegir a l'Agenda</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Equip Local vs Equip Visitant amb Escuts */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Local */}
                        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={m.home_crest || 'https://appwebffcv.novanet.es/pnfg/usr/local/projects/weblogic/repository/AS400/02/DOCS/201211/14/12043583.jpg'}
                              alt={m.home_team_name}
                              className="w-8 h-8 object-contain rounded-lg bg-white/5 p-1 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs sm:text-sm font-black text-white break-words">{m.home_team_name}</h4>
                              <span className="text-[10px] font-bold text-sky-400 uppercase">Local</span>
                            </div>
                          </div>

                          {/* Desglossament jugadors 1r i 2n any */}
                          <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              🟢 {homeBD.firstYear} (1r any)
                            </span>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-sky-500/15 text-sky-300 border border-sky-500/30">
                              🔵 {homeBD.secondYear} (2n any)
                            </span>
                          </div>
                        </div>

                        {/* Visitant */}
                        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={m.away_crest || 'https://appwebffcv.novanet.es/pnfg/usr/local/projects/weblogic/repository/AS400/02/DOCS/201306/21/12080863.jpg'}
                              alt={m.away_team_name}
                              className="w-8 h-8 object-contain rounded-lg bg-white/5 p-1 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs sm:text-sm font-black text-white break-words">{m.away_team_name}</h4>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Visitant</span>
                            </div>
                          </div>

                          {/* Desglossament jugadors 1r i 2n any */}
                          <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              🟢 {awayBD.firstYear} (1r any)
                            </span>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-sky-500/15 text-sky-300 border border-sky-500/30">
                              🔵 {awayBD.secondYear} (2n any)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Camp i Botó de Detalls */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs text-slate-400">
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-semibold text-slate-300 truncate">
                            {m.field_name || 'Camp per determinar'} {m.city ? `(${m.city})` : ''}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDayDate(null);
                            setSelectedMatch(m);
                          }}
                          className="text-sky-400 hover:text-white font-bold underline text-xs self-end sm:self-auto"
                        >
                          Veure fitxa completa i plantilles →
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE DETALL DE PARTIT ────────────────────────────────────────── */}
      {selectedMatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedMatch(null)}
        >
          <div
            className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl custom-scrollbar flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-950/95 backdrop-blur-sm z-10">
              <div className="flex items-center gap-2">
                <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-lg text-xs font-black uppercase">
                  {selectedMatch.matchday || 'Partit FFCV'}
                </span>
                <span className="text-xs font-bold text-slate-300">
                  {selectedMatch.competition_name} • {selectedMatch.group_name}
                </span>
              </div>
              <button
                onClick={() => setSelectedMatch(null)}
                className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contingut del Modal */}
            <div className="p-4 sm:p-6 space-y-6">
              {/* Marcador Principal i Equips */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-inner">
                <div className="grid grid-cols-12 items-center gap-2 sm:gap-4">
                  {/* Local */}
                  <div className="col-span-5 flex flex-col items-center text-center space-y-2 min-w-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/90 border border-slate-800 p-1.5 sm:p-2 flex items-center justify-center shadow-lg">
                      <img
                        src={selectedMatch.home_crest || 'https://appwebffcv.novanet.es/pnfg/usr/local/projects/weblogic/repository/AS400/02/DOCS/201211/14/12043583.jpg'}
                        alt={selectedMatch.home_team_name || 'Local'}
                        className="w-9 h-9 sm:w-12 sm:h-12 object-contain"
                      />
                    </div>
                    <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight w-full break-words">
                      {selectedMatch.home_team_name}
                    </h3>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {matchRosters.homeBreakdown && (
                        <>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            🟢 {matchRosters.homeBreakdown.firstYear} (1r)
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
                            🔵 {matchRosters.homeBreakdown.secondYear} (2n)
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Centre: Horari / Marcador */}
                  <div className="col-span-2 flex flex-col items-center justify-center text-center">
                    {selectedMatch.status === 'Finalizado' && selectedMatch.home_score != null ? (
                      <span className="text-2xl font-black text-white bg-slate-900 px-3 py-1 rounded-xl border border-slate-700 shadow-md">
                        {selectedMatch.home_score} - {selectedMatch.away_score}
                      </span>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-black text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                          VS
                        </span>
                        <span className="text-lg font-black text-white mt-1">
                          {formatMatchTime(selectedMatch)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Visitant */}
                  <div className="col-span-5 flex flex-col items-center text-center space-y-2 min-w-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/90 border border-slate-800 p-1.5 sm:p-2 flex items-center justify-center shadow-lg">
                      <img
                        src={selectedMatch.away_crest || 'https://appwebffcv.novanet.es/pnfg/usr/local/projects/weblogic/repository/AS400/02/DOCS/201306/21/12080863.jpg'}
                        alt={selectedMatch.away_team_name || 'Visitant'}
                        className="w-9 h-9 sm:w-12 sm:h-12 object-contain"
                      />
                    </div>
                    <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight w-full break-words">
                      {selectedMatch.away_team_name}
                    </h3>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {matchRosters.awayBreakdown && (
                        <>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            🟢 {matchRosters.awayBreakdown.firstYear} (1r)
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
                            🔵 {matchRosters.awayBreakdown.secondYear} (2n)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botó de Gestió d'Agenda de Seleccionador */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#ff6600]/10 text-[#ff6600] border border-[#ff6600]/20">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-white tracking-wider">
                      Agenda de Seguiment del Seleccionador
                    </h4>
                    <p className="text-xs text-slate-400">
                      {getMatchAgendaItem(selectedMatch.id)
                        ? `Aquest partit està a l'agenda de ${getMatchAgendaItem(selectedMatch.id)?.selector_name}`
                        : "Planifica l'observació d'aquest partit per als tècnics de la FFCV"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleToggleAgenda(e, selectedMatch)}
                  className={clsx(
                    "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md w-full sm:w-auto justify-center",
                    getMatchAgendaItem(selectedMatch.id)
                      ? "bg-emerald-600 hover:bg-rose-600 text-white"
                      : "bg-[#ff6600] hover:bg-orange-600 text-white"
                  )}
                >
                  {getMatchAgendaItem(selectedMatch.id) ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>En l'Agenda (Clic per treure)</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Afegir a l'Agenda ({selectedTargetSelector})</span>
                    </>
                  )}
                </button>
              </div>

              {/* Bloque Dades del Partit i Designació CTAFFCV */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Info className="w-4 h-4 text-sky-400" />
                  <span>Dades del Partit i Designació CTAFFCV</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Data */}
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <CalendarIcon className="w-4 h-4 text-sky-400 shrink-0" />
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold uppercase">Data Oficial</span>
                      <span className="text-white font-bold capitalize">{formatMatchDateLong(selectedMatch.match_date)}</span>
                    </div>
                  </div>

                  {/* Hora exacta de match_time */}
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold uppercase">Hora FFCV (match_time)</span>
                      <span className="text-white font-bold">{selectedMatch.match_time || selectedMatch.time || '15:00:00'}</span>
                    </div>
                  </div>
                </div>

                {/* Àrbitres */}
                <div className="pt-1">
                  {selectedMatch.referees && selectedMatch.referees.length > 0 ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
                      <span className="text-[11px] font-black uppercase text-emerald-400 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" />
                        Equip Arbitral Designat (CTAFFCV)
                      </span>
                      {selectedMatch.referees.map((ref, i) => (
                        <p key={i} className="text-xs font-bold text-white pl-1">
                          {ref}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-slate-400 text-xs">
                      <p className="font-bold text-slate-300">Pendent de designació CTAFFCV</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Instal·lació i Terreny de Joc */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>Instal·lació Esportiva</span>
                  </h4>
                  {selectedMatch.field_code && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                      Codi FFCV: {selectedMatch.field_code}
                    </span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-white font-bold block text-sm">
                        {selectedMatch.field_name || 'Camp per determinar'}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 block">
                        {selectedMatch.address ? `${selectedMatch.address}, ` : ''}{selectedMatch.city ? `${selectedMatch.city}` : 'Castelló'}
                      </span>
                    </div>
                  </div>

                  {selectedMatch.latitude && selectedMatch.longitude ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedMatch.latitude},${selectedMatch.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 font-bold text-xs border border-sky-500/30 transition-all mt-2"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Obrir Navegació GPS ({selectedMatch.latitude.toFixed(4)}, {selectedMatch.longitude.toFixed(4)})</span>
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Plantilles dels dos Equips desglossades per 1r i 2n Any */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>Jugadors en Seguiment ({matchRosters.homePlayers.length + matchRosters.awayPlayers.length})</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Plantilla Local */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-black text-sky-400 uppercase truncate">
                        {selectedMatch.home_team_name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {matchRosters.homePlayers.length} jugadors
                      </span>
                    </div>

                    {matchRosters.homePlayers.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">Sense jugadors registrats en seguiment.</p>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                        {matchRosters.homePlayers.map((p: Player) => (
                          <div
                            key={p.id}
                            onClick={() => navigate(`/jugadores/${p.id}`)}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={p.photo_url || 'https://appwebffcv.novanet.es/pnfg/images/silueta_persona.png'}
                                alt={p.full_name}
                                className="w-7 h-7 rounded-full object-cover bg-slate-800 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-white block truncate">{p.full_name}</span>
                                <span className="text-[10px] text-slate-400">{p.position || 'Sense posició'}</span>
                              </div>
                            </div>

                            <span
                              className={clsx(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded shrink-0",
                                p.infantil_year === 'Infantil 1er año'
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : p.infantil_year === 'Infantil 2º año'
                                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                  : "bg-slate-800 text-slate-400"
                              )}
                            >
                              {p.infantil_year === 'Infantil 1er año' ? '🟢 1r any' : p.infantil_year === 'Infantil 2º año' ? '🔵 2n any' : 'Desc'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Plantilla Visitant */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-black text-sky-400 uppercase truncate">
                        {selectedMatch.away_team_name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {matchRosters.awayPlayers.length} jugadors
                      </span>
                    </div>

                    {matchRosters.awayPlayers.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">Sense jugadors registrats en seguiment.</p>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                        {matchRosters.awayPlayers.map((p: Player) => (
                          <div
                            key={p.id}
                            onClick={() => navigate(`/jugadores/${p.id}`)}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={p.photo_url || 'https://appwebffcv.novanet.es/pnfg/images/silueta_persona.png'}
                                alt={p.full_name}
                                className="w-7 h-7 rounded-full object-cover bg-slate-800 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-white block truncate">{p.full_name}</span>
                                <span className="text-[10px] text-slate-400">{p.position || 'Sense posició'}</span>
                              </div>
                            </div>

                            <span
                              className={clsx(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded shrink-0",
                                p.infantil_year === 'Infantil 1er año'
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : p.infantil_year === 'Infantil 2º año'
                                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                  : "bg-slate-800 text-slate-400"
                              )}
                            >
                              {p.infantil_year === 'Infantil 1er año' ? '🟢 1r any' : p.infantil_year === 'Infantil 2º año' ? '🔵 2n any' : 'Desc'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VISTA 3: CONVOCATÒRIES I ENTRENAMENTS ─────────────────────────────── */}
      {activeMainTab === 'events' && (
        <Card className="p-6 space-y-4 bg-slate-950/80 border border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-emerald-400" />
            <span>Esdeveniments Oficials de la Selecció Valenciana Castelló</span>
          </h3>

          <div className="space-y-3">
            {callups.map((c) => (
              <div
                key={c.id}
                className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-blue-400 uppercase">Convocatòria Oficial</span>
                    <h4 className="text-sm font-bold text-white line-clamp-2 break-words">{c.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2 break-words">{c.location}</p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <Badge status={c.status} />
                  <p className="text-xs font-semibold text-slate-400 mt-1">
                    {new Date(c.date).toLocaleDateString('ca-ES')}
                  </p>
                </div>
              </div>
            ))}

            {trainings.map((t) => (
              <div
                key={t.id}
                className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">Entrenament Tàctic</span>
                    <h4 className="text-sm font-bold text-white line-clamp-2 break-words">{t.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2 break-words">{t.location}</p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <Badge variant="success">Programat</Badge>
                  <p className="text-xs font-semibold text-slate-400 mt-1">
                    {new Date(t.start_time).toLocaleDateString('ca-ES')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default CalendarView;
