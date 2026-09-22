import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { useAuth } from '../../contexts/AuthContext';
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
  Shield
} from 'lucide-react';
import type { ScoutingAgendaItem } from '../../types/models';

export const Agenda: React.FC = () => {
  const { user } = useAuth();
  const currentSelectorName = user?.full_name || 'Seleccionador';

  const {
    matches,
    agenda,
    addToAgenda,
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

  // Estado para el modal de Marcar como Observado
  const [observingItem, setObservingItem] = useState<ScoutingAgendaItem | null>(null);
  const [observeNotes, setObserveNotes] = useState('');
  const [observeLocal, setObserveLocal] = useState(true);
  const [observeAway, setObserveAway] = useState(true);
  const [standoutSelected, setStandoutSelected] = useState<string[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Lista única de seleccionadores que tienen partidos en la agenda
  const selectorsList = useMemo(() => {
    const set = new Set<string>();
    agenda.forEach((a) => {
      if (a.selector_name) set.add(a.selector_name);
    });
    return Array.from(set);
  }, [agenda]);

  // Lista de categorías únicas para el explorador
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      const cat = m.competition_name ? `${m.competition_name} ${m.group_name ? `- ${m.group_name}` : ''}` : 'Altres';
      set.add(cat);
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
      const matchesSelector = selectorFilter === 'all' || item.selector_name === selectorFilter;
      return matchesStatus && matchesSelector;
    }).sort((a, b) => {
      const dateA = a.scheduled_date || a.created_at;
      const dateB = b.scheduled_date || b.created_at;
      return dateA.localeCompare(dateB);
    });
  }, [agenda, statusFilter, selectorFilter]);

  // Partidos del explorador filtrados
  const filteredBrowseMatches = useMemo(() => {
    return matches.filter((m) => {
      const searchLower = searchBrowse.toLowerCase();
      const matchesSearch =
        (m.home_team_name && m.home_team_name.toLowerCase().includes(searchLower)) ||
        (m.away_team_name && m.away_team_name.toLowerCase().includes(searchLower)) ||
        (m.field_name && m.field_name.toLowerCase().includes(searchLower)) ||
        (m.city && m.city.toLowerCase().includes(searchLower));

      const matchCat = m.competition_name ? `${m.competition_name} ${m.group_name ? `- ${m.group_name}` : ''}` : 'Altres';
      const matchesCategory = categoryFilter === 'all' || matchCat === categoryFilter;
      const matchesJornada = matchdayFilter === 'all' || m.matchday === matchdayFilter;

      return matchesSearch && matchesCategory && matchesJornada;
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

  // Helper para saber si un partido del explorador ya está en la agenda
  const getAgendaItemForMatch = (matchId: string) => {
    return agenda.find((a) => a.match_id === matchId);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex gap-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('my_agenda')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'my_agenda'
                ? 'bg-[#ff6600] text-white shadow-lg shadow-orange-950/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>La meua Agenda ({agenda.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'browse'
                ? 'bg-[#ff6600] text-white shadow-lg shadow-orange-950/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Afegir Partits des del Calendari</span>
          </button>
        </div>

        {activeTab === 'my_agenda' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Filtro Estado */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full sm:w-auto bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#ff6600]"
            >
              <option value="all">Tots els estats</option>
              <option value="Planificat">Només Planificats ({agendaStats.planned})</option>
              <option value="Observat">Només Observats ({agendaStats.observed})</option>
            </select>

            {/* Filtro Seleccionador */}
            {selectorsList.length > 1 && (
              <select
                value={selectorFilter}
                onChange={(e) => setSelectorFilter(e.target.value)}
                className="w-full sm:w-auto bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#ff6600]"
              >
                <option value="all">Tots els tècnics</option>
                {selectorsList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* ── CONTENIDO PESTAÑA 1: LA MEUA AGENDA ──────────────────────────────── */}
      {activeTab === 'my_agenda' && (
        <div className="space-y-4">
          {filteredAgenda.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <CalendarCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No hi ha partits a l'agenda</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-5">
                Encara no has afegit cap partit a la teua planificació d'observació territorial.
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAgenda.map((item) => {
                const isObserved = item.status === 'Observat';
                const localBreakdown = getTeamPlayersBreakdown(item.home_team_name);
                const awayBreakdown = getTeamPlayersBreakdown(item.away_team_name);
                const localObsCount = getTeamObservationCount(item.home_team_name);
                const awayObsCount = getTeamObservationCount(item.away_team_name);

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-5 border transition-all shadow-md flex flex-col justify-between ${
                      isObserved
                        ? 'bg-slate-900/90 border-emerald-900/50 hover:border-emerald-700/60'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Cabecera de la Tarjeta */}
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-xs">
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

                          <span className="text-slate-400 text-[11px]">
                            {item.selector_name}
                          </span>
                        </div>

                        {/* Botón borrar de la agenda */}
                        <button
                          onClick={() => removeFromAgenda(item.id)}
                          title="Treure de l'agenda"
                          className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Info del Partido (Local vs Visitant) */}
                      <div className="py-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          {/* Local */}
                          <div className="flex-1 text-left min-w-0">
                            <h4 className="text-sm font-black text-white line-clamp-2 break-words">
                              {item.home_team_name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-indigo-300 font-semibold">
                                {localBreakdown.secondYear} de 2n
                              </span>
                              <span className="text-[10px] text-slate-500">·</span>
                              <span className="text-[10px] text-amber-300 font-semibold">
                                👁️ {localObsCount}v
                              </span>
                            </div>
                          </div>

                          <div className="px-2.5 py-1 bg-slate-950 rounded-lg text-xs font-black text-slate-400">
                            VS
                          </div>

                          {/* Visitante */}
                          <div className="flex-1 text-right min-w-0">
                            <h4 className="text-sm font-black text-white line-clamp-2 break-words">
                              {item.away_team_name}
                            </h4>
                            <div className="flex items-center justify-end gap-2 mt-1">
                              <span className="text-[10px] text-indigo-300 font-semibold">
                                {awayBreakdown.secondYear} de 2n
                              </span>
                              <span className="text-[10px] text-slate-500">·</span>
                              <span className="text-[10px] text-amber-300 font-semibold">
                                👁️ {awayObsCount}v
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Fecha, Hora y Campo */}
                        <div className="bg-slate-950/60 rounded-lg p-2.5 text-xs text-slate-300 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-sky-200">
                            <Clock className="w-3.5 h-3.5 text-sky-400" />
                            <span>
                              {item.scheduled_date ? item.scheduled_date.slice(0, 10) : 'Data per definir'}
                              {item.match?.time ? ` · ${item.match.time}h` : ''}
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
                          onClick={() => handleOpenObserveModal(item)}
                          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Marcar com Observat (Vist)</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Completat el{' '}
                            {item.observed_at ? item.observed_at.slice(0, 10) : 'recentment'}
                          </span>
                          <button
                            onClick={() => handleOpenObserveModal(item)}
                            className="text-xs text-sky-400 hover:underline font-bold"
                          >
                            Editar Notes
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CONTENIDO PESTAÑA 2: EXPLORADOR DE PARTIDOS ───────────────────────── */}
      {activeTab === 'browse' && (
        <div className="space-y-4">
          {/* Barra de Filtros del Explorador */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cercar per equip, camp, municipi..."
                value={searchBrowse}
                onChange={(e) => setSearchBrowse(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#ff6600]"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-auto bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#ff6600]"
              >
                <option value="all">Totes les categories</option>
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={matchdayFilter}
                onChange={(e) => setMatchdayFilter(e.target.value)}
                className="w-full sm:w-auto bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#ff6600]"
              >
                <option value="all">Totes les jornades</option>
                {matchdaysList.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Listado de Partidos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredBrowseMatches.map((match) => {
              const agendaItem = getAgendaItemForMatch(match.id);
              const isAdded = Boolean(agendaItem);
              const isObserved = agendaItem?.status === 'Observat';

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
                      <span className="font-bold text-sky-300">
                        {match.matchday || 'Partit'} · {match.competition_name || 'Infantil'}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {match.match_date ? match.match_date.slice(0, 10) : ''}
                        {match.time ? ` · ${match.time}` : ''}
                      </span>
                    </div>

                    {/* Equipos */}
                    <div className="py-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-white line-clamp-2 break-words">
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
                        <p className="text-xs font-black text-white line-clamp-2 break-words">
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
                    {isObserved ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Observat
                      </span>
                    ) : isAdded ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-sky-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> A la teua agenda
                        </span>
                        <button
                          onClick={() => removeFromAgenda(agendaItem!.id)}
                          className="text-[11px] text-rose-400 hover:underline font-bold"
                        >
                          Treure
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          addToAgenda(match, currentSelectorName);
                          setSuccessToast(`Afegit a l'agenda: ${match.home_team_name} vs ${match.away_team_name}`);
                          setTimeout(() => setSuccessToast(null), 3000);
                        }}
                        className="w-full py-2 bg-slate-800 hover:bg-[#ff6600] text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Afegir a la meua agenda</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
                  {observingItem.scheduled_date ? observingItem.scheduled_date.slice(0, 10) : ''} ·{' '}
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
                onClick={() => setObservingItem(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel·lar
              </button>
              <button
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
