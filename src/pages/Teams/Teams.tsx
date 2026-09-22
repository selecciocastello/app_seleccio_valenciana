import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../hooks/useAppStore';
import {
  Shield,
  MapPin,
  Calendar,
  Users,
  Eye,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  X,
  Plus
} from 'lucide-react';
import { JerseyBadge } from '../../components/ui/JerseyBadge';
import type { Team, Player } from '../../types/models';

export const Teams: React.FC = () => {
  const navigate = useNavigate();
  const {
    teams,
    players,
    agenda,
    addToAgenda,
    getTeamObservationCount,
    getTeamObservations,
    getTeamPlayersBreakdown,
    getTeamNextMatch
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'observed_desc' | 'observed_asc' | 'second_year' | 'first_year'>('name');
  const [selectedTeamForModal, setSelectedTeamForModal] = useState<Team | null>(null);

  // Lista única de categorías/competiciones disponibles
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      const cat = t.competition ? `${t.competition} - ${t.group || 'Grup 1'}` : 'Altres Equips';
      set.add(cat);
    });
    return Array.from(set).sort();
  }, [teams]);

  // Resumen global para las tarjetas superiores (cens real de jugadors de 2n i 1r any)
  const statsOverview = useMemo(() => {
    const total2nd = players.filter((p) => p.infantil_year === 'Infantil 2º año').length;
    const total1st = players.filter((p) => p.infantil_year === 'Infantil 1er año').length;
    let observedTeamsCount = 0;

    teams.forEach((t) => {
      if (getTeamObservationCount(t.name) > 0) {
        observedTeamsCount++;
      }
    });

    return {
      totalTeams: teams.length,
      total2nd,
      total1st,
      observedTeamsCount
    };
  }, [teams, players, getTeamObservationCount]);

  // Equipos filtrados y ordenados
  const filteredTeams = useMemo(() => {
    let result = teams.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.club.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.city && t.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.field_name && t.field_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const teamCat = t.competition ? `${t.competition} - ${t.group || 'Grup 1'}` : 'Altres Equips';
      const matchesCategory = selectedCategory === 'all' || teamCat === selectedCategory;

      return matchesSearch && matchesCategory;
    });

    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'observed_desc') return getTeamObservationCount(b.name) - getTeamObservationCount(a.name);
      if (sortBy === 'observed_asc') return getTeamObservationCount(a.name) - getTeamObservationCount(b.name);
      if (sortBy === 'second_year') return getTeamPlayersBreakdown(b.name).secondYear - getTeamPlayersBreakdown(a.name).secondYear;
      if (sortBy === 'first_year') return getTeamPlayersBreakdown(b.name).firstYear - getTeamPlayersBreakdown(a.name).firstYear;
      return 0;
    });

    return result;
  }, [teams, searchTerm, selectedCategory, sortBy, getTeamObservationCount, getTeamPlayersBreakdown]);

  // Agrupar por categoría para visualización seccionada
  const groupedTeams = useMemo(() => {
    const map = new Map<string, Team[]>();
    filteredTeams.forEach((t) => {
      const cat = t.competition ? `${t.competition} - ${t.group || 'Grup 1'}` : 'Lliga Infantil Castelló';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    });
    return map;
  }, [filteredTeams]);

  // Helper para verificar si un partido ya está en la agenda
  const isMatchInAgenda = (matchId: string) => {
    return agenda.some((a) => a.match_id === matchId);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── CABECERA Y METRICAS PRINCIPALES ───────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#061338] via-[#002568] to-[#003db3] rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-blue-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#ff6600]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#ff6600] text-white">
                  FFCV Castelló
                </span>
                <span className="text-xs text-sky-200 font-semibold tracking-wide">
                  Temporada 2026/2027
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">
                Equips i Clubs de Castelló
              </h1>
              <p className="text-sm text-sky-100/80 max-w-2xl mt-1">
                Supervisió tècnica per categories, seguiment de partits de l'agenda i cens de jugadors de 1r i 2n any.
              </p>
            </div>
          </div>

          {/* Tarjetas de Métricas Rápidas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider">Total Equips</span>
                <Shield className="w-4 h-4 text-sky-300" />
              </div>
              <p className="text-2xl font-black text-white mt-1">{statsOverview.totalTeams}</p>
              <p className="text-[10px] text-sky-200/70 mt-0.5">En competicions FFCV</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Jugadors 2n Any</span>
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              </div>
              <p className="text-2xl font-black text-white mt-1">{statsOverview.total2nd}</p>
              <p className="text-[10px] text-indigo-200/70 mt-0.5">Prioritaris territorial</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Jugadors 1r Any</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <p className="text-2xl font-black text-white mt-1">{statsOverview.total1st}</p>
              <p className="text-[10px] text-emerald-200/70 mt-0.5">Projecció sub-13</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">Equips Observats</span>
                <Eye className="w-4 h-4 text-amber-300" />
              </div>
              <p className="text-2xl font-black text-white mt-1">{statsOverview.observedTeamsCount}</p>
              <p className="text-[10px] text-amber-200/70 mt-0.5">Vistos en partits</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRA DE BÚSQUEDA Y FILTROS ────────────────────────────────────────── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Input de Búsqueda */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cercar per equip, club, camp o municipi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#ff6600]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtro por Categoría */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto bg-slate-950/80 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#ff6600]"
            >
              <option value="all">Totes les categories ({teams.length})</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Ordenar por */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full sm:w-auto bg-slate-950/80 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#ff6600]"
          >
            <option value="name">Ordenar: Nom (A-Z)</option>
            <option value="observed_desc">Més observats primer</option>
            <option value="observed_asc">Menys observats primer</option>
            <option value="second_year">Més jugadors 2n any</option>
            <option value="first_year">Més jugadors 1r any</option>
          </select>
        </div>
      </div>

      {/* ── LISTADO DE EQUIPOS ORGANIZADOS POR CATEGORÍA ──────────────────────── */}
      {filteredTeams.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No s'han trobat equips</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Revisa el text de cerca o el filtre de categoria seleccionat.
          </p>
        </div>
      ) : (
        Array.from(groupedTeams.entries()).map(([categoryTitle, categoryTeams]) => (
          <div key={categoryTitle} className="space-y-3.5">
            {/* Cabecera de Categoría */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-[#ff6600]" />
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  {categoryTitle}
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {categoryTeams.length} {categoryTeams.length === 1 ? 'equip' : 'equips'}
                </span>
              </div>
            </div>

            {/* Rejilla de Tarjetas de Equipos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {categoryTeams.map((team) => {
                const obsCount = getTeamObservationCount(team.name);
                const breakdown = getTeamPlayersBreakdown(team.name);
                const nextMatch = getTeamNextMatch(team.name);

                const isHome = nextMatch ? nextMatch.home_team_name === team.name : false;
                const rivalName = nextMatch
                  ? isHome
                    ? nextMatch.away_team_name
                    : nextMatch.home_team_name
                  : null;
                const rivalCrest = nextMatch
                  ? isHome
                    ? nextMatch.away_crest
                    : nextMatch.home_crest
                  : null;

                return (
                  <div
                    key={team.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 flex flex-col justify-between transition-all duration-200 shadow-md hover:shadow-xl group"
                  >
                    {/* Parte Superior: Escudo, Nombre y Club */}
                    <div>
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden shadow-inner p-1 group-hover:scale-105 transition-transform">
                          {team.crest_url ? (
                            <img
                              src={team.crest_url}
                              alt={team.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-lg font-black text-[#ff6600]">
                              {team.name.charAt(0)}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-black text-white line-clamp-2 break-words group-hover:text-sky-300 transition-colors">
                            {team.name}
                          </h3>
                          <p className="text-xs text-slate-400 line-clamp-2 break-words">{team.club || team.name}</p>
                          <div className="flex items-start gap-1.5 text-[11px] text-slate-500 mt-1">
                            <MapPin className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 break-words">
                              {team.city || 'Castelló'}
                              {team.field_name && <> · {team.field_name}</>}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Cuadrícula de Métricas Clave */}
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        {/* 2º Año */}
                        <div className="bg-indigo-950/40 border border-indigo-900/40 rounded-lg p-2.5 text-center">
                          <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">
                            2n Any
                          </span>
                          <span className="text-base font-black text-indigo-200 mt-0.5 block">
                            {breakdown.secondYear}
                          </span>
                          <span className="text-[9px] text-indigo-400/80">jugadors</span>
                        </div>

                        {/* 1er Año */}
                        <div className="bg-emerald-950/40 border border-emerald-900/40 rounded-lg p-2.5 text-center">
                          <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">
                            1r Any
                          </span>
                          <span className="text-base font-black text-emerald-200 mt-0.5 block">
                            {breakdown.firstYear}
                          </span>
                          <span className="text-[9px] text-emerald-400/80">jugadors</span>
                        </div>

                        {/* Veces Observado */}
                        <div
                          className={`rounded-lg p-2.5 text-center border transition-colors ${
                            obsCount > 0
                              ? 'bg-amber-950/40 border-amber-900/50'
                              : 'bg-slate-950/40 border-slate-800'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1">
                            <Eye className="w-3 h-3" /> Observat
                          </span>
                          <span
                            className={`text-base font-black mt-0.5 block ${
                              obsCount > 0 ? 'text-amber-300' : 'text-slate-400'
                            }`}
                          >
                            {obsCount}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {obsCount === 1 ? 'vegada' : 'vegades'}
                          </span>
                        </div>
                      </div>

                      {/* Resumen Próximo Partido */}
                      <div className="mt-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          <span className="flex items-center gap-1 text-sky-300">
                            <Calendar className="w-3 h-3" /> Pròxim Partit
                          </span>
                          {nextMatch && (
                            <span className="text-slate-400">{nextMatch.matchday || 'Jornada'}</span>
                          )}
                        </div>

                        {nextMatch ? (
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2 text-xs">
                              <span className="font-bold text-white flex items-start gap-1.5">
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-black shrink-0 ${
                                    isHome
                                      ? 'bg-sky-500/20 text-sky-300'
                                      : 'bg-orange-500/20 text-orange-300'
                                  }`}
                                >
                                  {isHome ? 'CASA' : 'FORA'}
                                </span>
                                {rivalCrest && (
                                  <img
                                    src={rivalCrest}
                                    alt={rivalName || ''}
                                    className="w-3.5 h-3.5 object-contain inline-block shrink-0"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                )}
                                <span className="line-clamp-2 break-words">vs {rivalName}</span>
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {nextMatch.match_date ? nextMatch.match_date.slice(0, 10) : 'Per definir'}
                                {nextMatch.time ? ` · ${nextMatch.time}` : ''}
                              </span>

                              {/* Botón rápido para añadir a la agenda */}
                              {!isMatchInAgenda(nextMatch.id) ? (
                                <button
                                  onClick={() => addToAgenda(nextMatch)}
                                  className="text-[10px] font-bold text-[#ff6600] hover:text-orange-400 hover:underline flex items-center gap-0.5"
                                >
                                  <Plus className="w-3 h-3" /> Afegir a agenda
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                                  <CheckCircle2 className="w-3 h-3" /> En agenda
                                </span>
                              )}
                            </div>

                            {nextMatch.field_name && (
                              <p className="text-[10px] text-slate-500 flex items-start gap-1">
                                <MapPin className="w-2.5 h-2.5 text-slate-600 shrink-0 mt-0.5" />
                                <span className="line-clamp-2 break-words">{nextMatch.field_name}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">Sense partit programat</p>
                        )}
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedTeamForModal(team)}
                        className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700/80 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5 text-sky-300" />
                        <span>Veure Plantilla ({breakdown.total})</span>
                      </button>

                      <button
                        onClick={() => navigate('/calendario')}
                        title="Veure calendari complet"
                        className="p-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* ── MODAL DETALLE DE PLANTILLA DEL EQUIPO ───────────────────────────── */}
      {selectedTeamForModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center p-1 overflow-hidden shadow-inner">
                  {selectedTeamForModal.crest_url ? (
                    <img
                      src={selectedTeamForModal.crest_url}
                      alt={selectedTeamForModal.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-xl font-black text-[#ff6600]">
                      {selectedTeamForModal.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{selectedTeamForModal.name}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedTeamForModal.club} · {selectedTeamForModal.city || 'Castelló'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTeamForModal(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido / Jugadores del Equipo */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              {(() => {
                const breakdown = getTeamPlayersBreakdown(selectedTeamForModal.name);
                const playersList = breakdown.playersList;

                if (playersList.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      No hi ha jugadors registrats encara per a aquest equip.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                      <span>Total: <strong className="text-white">{playersList.length} jugadors</strong></span>
                      <div className="flex items-center gap-3">
                        <span className="text-indigo-400 font-bold">{breakdown.secondYear} de 2n any</span>
                        <span className="text-emerald-400 font-bold">{breakdown.firstYear} de 1r any</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {playersList.map((player: Player) => (
                        <div
                          key={player.id}
                          onClick={() => {
                            setSelectedTeamForModal(null);
                            navigate(`/jugadores/${player.id}`);
                          }}
                          className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer group transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300 shrink-0 overflow-hidden">
                              {player.photo_url ? (
                                <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span>{player.first_name[0]}{player.last_name[0]}</span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white line-clamp-2 break-words group-hover:text-sky-300">
                                {player.full_name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                {player.position || 'Jugador'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <JerseyBadge number={player.jersey_number} size="xs" variant="kit" color="blue" />
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full inline-block ${
                                player.infantil_year === 'Infantil 2º año'
                                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/50'
                                  : player.infantil_year === 'Infantil 1er año'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {player.infantil_year === 'Infantil 2º año'
                                ? '2n Any'
                                : player.infantil_year === 'Infantil 1er año'
                                ? '1r Any'
                                : 'Infantil'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Historial d'observacions tècniques de l'equip */}
                    {(() => {
                      const obsHistory = getTeamObservations(selectedTeamForModal.name);
                      if (obsHistory.length === 0) return null;

                      return (
                        <div className="mt-6 pt-5 border-t border-slate-800">
                          <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Eye className="w-4 h-4" /> Historial d'Observacions ({obsHistory.length})
                          </h4>
                          <div className="space-y-2">
                            {obsHistory.map((obs) => (
                              <div
                                key={obs.id}
                                className="bg-slate-950/80 border border-amber-900/30 rounded-xl p-3 text-xs"
                              >
                                <div className="flex items-center justify-between font-bold text-slate-200 mb-1">
                                  <span>{obs.home_team_name} vs {obs.away_team_name}</span>
                                  <span className="text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                                    {obs.observed_at ? obs.observed_at.slice(0, 10) : (obs.scheduled_date || obs.created_at.slice(0, 10))}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                  <span>Observat per: <strong className="text-white">{obs.selector_name}</strong></span>
                                  {obs.match?.field_name && <span>· Camp: {obs.match.field_name}</span>}
                                </div>
                                {obs.notes && (
                                  <p className="mt-2 text-xs text-slate-300 bg-slate-900/90 p-2 rounded-lg border border-slate-800 italic">
                                    "{obs.notes}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>

            {/* Pie del Modal */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button
                onClick={() => setSelectedTeamForModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Tancar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
