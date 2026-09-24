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
  Plus,
  Star,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { JerseyBadge } from '../../components/ui/JerseyBadge';
import { CustomSelect } from '../../components/ui/Select';
import type { Team, Player } from '../../types/models';

export const Teams: React.FC = () => {
  const navigate = useNavigate();
  const {
    teams,
    players,
    agenda,
    addToAgenda,
    updatePlayer,
    getTeamObservationCount,
    getTeamObservations,
    getTeamPlayersBreakdown,
    getTeamNextMatch
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [scoutingFilter, setScoutingFilter] = useState<'all' | 'observed' | 'not_observed' | 'has_preselected'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'preselected_desc' | 'observed_desc' | 'observed_asc' | 'first_year' | 'second_year'>('name');
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

  // Resumen global para las tarjetas superiores (cens real de jugadors de 2n i 1r any, observats i preseleccionats)
  const statsOverview = useMemo(() => {
    const total2nd = players.filter((p) => p.infantil_year === 'Infantil 2º año').length;
    const total1st = players.filter((p) => p.infantil_year === 'Infantil 1er año').length;
    const totalPreselected = players.filter((p) => p.status === 'Preseleccionado').length;
    let observedTeamsCount = 0;

    teams.forEach((t) => {
      if (getTeamObservationCount(t.name) > 0) {
        observedTeamsCount++;
      }
    });

    const observedPercentage = teams.length > 0 ? Math.round((observedTeamsCount / teams.length) * 100) : 0;

    return {
      totalTeams: teams.length,
      total2nd,
      total1st,
      totalPreselected,
      observedTeamsCount,
      observedPercentage
    };
  }, [teams, players, getTeamObservationCount]);

  // Pre-computar estadísticas por equipo para rendimiento de filtrado y ordenación
  const teamsScoutingStats = useMemo(() => {
    const map = new Map<string, { obsCount: number; firstYear: number; secondYear: number; total: number; preselectedCount: number }>();
    
    teams.forEach((t) => {
      const breakdown = getTeamPlayersBreakdown(t.name);
      const obsCount = getTeamObservationCount(t.name);
      const preselectedCount = breakdown.playersList.filter((p) => p.status === 'Preseleccionado').length;
      
      map.set(t.name, {
        obsCount,
        firstYear: breakdown.firstYear,
        secondYear: breakdown.secondYear,
        total: breakdown.total,
        preselectedCount
      });
    });
    
    return map;
  }, [teams, getTeamPlayersBreakdown, getTeamObservationCount]);

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

      const teamStats = teamsScoutingStats.get(t.name) || { obsCount: 0, preselectedCount: 0 };
      let matchesScouting = true;
      if (scoutingFilter === 'observed') {
        matchesScouting = teamStats.obsCount > 0;
      } else if (scoutingFilter === 'not_observed') {
        matchesScouting = teamStats.obsCount === 0;
      } else if (scoutingFilter === 'has_preselected') {
        matchesScouting = teamStats.preselectedCount > 0;
      }

      return matchesSearch && matchesCategory && matchesScouting;
    });

    result.sort((a, b) => {
      const statsA = teamsScoutingStats.get(a.name) || { obsCount: 0, firstYear: 0, secondYear: 0, preselectedCount: 0 };
      const statsB = teamsScoutingStats.get(b.name) || { obsCount: 0, firstYear: 0, secondYear: 0, preselectedCount: 0 };

      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'preselected_desc') {
        if (statsB.preselectedCount !== statsA.preselectedCount) {
          return statsB.preselectedCount - statsA.preselectedCount;
        }
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'observed_desc') {
        if (statsB.obsCount !== statsA.obsCount) {
          return statsB.obsCount - statsA.obsCount;
        }
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'observed_asc') {
        if (statsA.obsCount !== statsB.obsCount) {
          return statsA.obsCount - statsB.obsCount;
        }
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'first_year') {
        if (statsB.firstYear !== statsA.firstYear) {
          return statsB.firstYear - statsA.firstYear;
        }
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'second_year') {
        if (statsB.secondYear !== statsA.secondYear) {
          return statsB.secondYear - statsA.secondYear;
        }
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return result;
  }, [teams, searchTerm, selectedCategory, scoutingFilter, sortBy, teamsScoutingStats]);

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

  // Toggle preselección de jugador
  const handleTogglePreselected = (player: Player, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isPreselected = player.status === 'Preseleccionado';
    updatePlayer(player.id, {
      status: isPreselected ? 'Candidato' : 'Preseleccionado',
    });
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
                Supervisió tècnica per categories, estadístiques de cobertura, cens de jugadors de 1r i 2n any i jugadors preseleccionats.
              </p>
            </div>
          </div>

          {/* Tarjetas de Métricas Rápidas (5 Métricas Clave) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
            {/* Total Equips */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-sky-200 uppercase tracking-wider">Total Equips</span>
                <Shield className="w-4 h-4 text-sky-300" />
              </div>
              <p className="text-2xl font-black text-white mt-1">{statsOverview.totalTeams}</p>
              <p className="text-[10px] text-sky-200/70 mt-0.5">En competicions FFCV</p>
            </div>

            {/* Equips Observats & % Cobertura */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">Equips Observats</span>
                <Eye className="w-4 h-4 text-amber-300" />
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <p className="text-2xl font-black text-white">{statsOverview.observedTeamsCount}</p>
                <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded">
                  {statsOverview.observedPercentage}%
                </span>
              </div>
              <p className="text-[10px] text-amber-200/70 mt-0.5">De cobertura territorial</p>
            </div>

            {/* Jugadors Preseleccionats */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-yellow-200 uppercase tracking-wider">Preseleccionats</span>
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              </div>
              <p className="text-2xl font-black text-yellow-300 mt-1">{statsOverview.totalPreselected}</p>
              <p className="text-[10px] text-yellow-200/70 mt-0.5">Candidats seleccionats</p>
            </div>

            {/* Jugadors 1r Any */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">Jugadors 1r Any</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              </div>
              <p className="text-2xl font-black text-white mt-1">{statsOverview.total1st}</p>
              <p className="text-[10px] text-emerald-200/70 mt-0.5">Infantil 1er any (2014)</p>
            </div>

            {/* Jugadors 2n Any */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Jugadors 2n Any</span>
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/50" />
              </div>
              <p className="text-2xl font-black text-white mt-1">{statsOverview.total2nd}</p>
              <p className="text-[10px] text-indigo-200/70 mt-0.5">Infantil 2n any (2013)</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRA DE BÚSQUEDA Y FILTROS ────────────────────────────────────────── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Input de Búsqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cercar per equip, club, camp o municipi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-[#ff6600] focus:ring-1 focus:ring-[#ff6600]/30 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtros de Categoría y Ordenación */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <CustomSelect
              theme="dark"
              icon={<Filter className="w-4 h-4" />}
              value={selectedCategory}
              onChange={setSelectedCategory}
              searchable={categoriesList.length > 5}
              searchPlaceholder="Cercar categoria..."
              options={[
                { value: 'all', label: `Totes les categories (${teams.length})` },
                ...categoriesList.map((cat) => ({ value: cat, label: cat })),
              ]}
            />

            <CustomSelect
              theme="dark"
              value={sortBy}
              onChange={(val) => setSortBy(val as any)}
              options={[
                { value: 'name', label: 'Ordenar: Nom (A-Z)' },
                { value: 'preselected_desc', label: '⭐ Més preseleccionats primer' },
                { value: 'observed_desc', label: '👁️ Més observats primer' },
                { value: 'observed_asc', label: 'Menys observats primer' },
                { value: 'first_year', label: '🟢 Més jugadors 1r any (2014)' },
                { value: 'second_year', label: '🔵 Més jugadors 2n any (2013)' },
              ]}
            />
          </div>
        </div>

        {/* Filtro rápido de estado de scouting */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-[#ff6600]" /> Filtrar:
          </span>
          <button
            onClick={() => setScoutingFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
              scoutingFilter === 'all'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Tots els equips ({teams.length})
          </button>
          <button
            onClick={() => setScoutingFilter('has_preselected')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              scoutingFilter === 'has_preselected'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'bg-slate-950 text-yellow-300/80 hover:text-yellow-300 hover:bg-slate-800'
            }`}
          >
            <Star className="w-3 h-3 fill-current" />
            Amb preseleccionats
          </button>
          <button
            onClick={() => setScoutingFilter('observed')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              scoutingFilter === 'observed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 text-emerald-400/80 hover:text-emerald-300 hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3 h-3" />
            Observats ({statsOverview.observedTeamsCount})
          </button>
          <button
            onClick={() => setScoutingFilter('not_observed')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
              scoutingFilter === 'not_observed'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Pendents d'observar ({teams.length - statsOverview.observedTeamsCount})
          </button>
        </div>
      </div>

      {/* ── LISTADO DE EQUIPOS ORGANIZADOS POR CATEGORÍA ──────────────────────── */}
      {filteredTeams.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <Shield className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#061338]">No s'han trobat equips</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Revisa el text de cerca o el filtre seleccionat.
          </p>
        </div>
      ) : (
        Array.from(groupedTeams.entries()).map(([categoryTitle, categoryTeams]) => (
          <div key={categoryTitle} className="space-y-3.5">
            {/* Cabecera de Categoría */}
            <div className="flex items-center justify-between border-b border-slate-300/80 pb-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-[#ff6600]" />
                <h2 className="text-base font-black text-[#061338] uppercase tracking-wider">
                  {categoryTitle}
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {categoryTeams.length} {categoryTeams.length === 1 ? 'equip' : 'equips'}
                </span>
              </div>
            </div>

            {/* Rejilla de Tarjetas de Equipos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {categoryTeams.map((team) => {
                const teamStats = teamsScoutingStats.get(team.name) || {
                  obsCount: 0,
                  firstYear: 0,
                  secondYear: 0,
                  total: 0,
                  preselectedCount: 0
                };
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

                      {/* Cuadrícula de Métricas Clave (4 Estadísticas: 2n Any, 1r Any, Preseleccionats, Observat) */}
                      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-4">
                        {/* 2º Año */}
                        <div className="bg-indigo-950/40 border border-indigo-900/40 rounded-lg p-2 text-center">
                          <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider block">
                            2n Any
                          </span>
                          <span className="text-sm font-black text-indigo-200 mt-0.5 block">
                            {teamStats.secondYear}
                          </span>
                          <span className="text-[8px] text-indigo-400/80">2013</span>
                        </div>

                        {/* 1er Año */}
                        <div className="bg-emerald-950/40 border border-emerald-900/40 rounded-lg p-2 text-center">
                          <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider block">
                            1r Any
                          </span>
                          <span className="text-sm font-black text-emerald-200 mt-0.5 block">
                            {teamStats.firstYear}
                          </span>
                          <span className="text-[8px] text-emerald-400/80">2014</span>
                        </div>

                        {/* Preseleccionats */}
                        <div
                          className={`rounded-lg p-2 text-center border transition-colors ${
                            teamStats.preselectedCount > 0
                              ? 'bg-amber-950/50 border-amber-500/40 shadow-sm'
                              : 'bg-slate-950/40 border-slate-800'
                          }`}
                        >
                          <span className="text-[9px] font-bold text-yellow-300 uppercase tracking-wider flex items-center justify-center gap-0.5">
                            <Star className={`w-2.5 h-2.5 ${teamStats.preselectedCount > 0 ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500'}`} />
                            Pre
                          </span>
                          <span
                            className={`text-sm font-black mt-0.5 block ${
                              teamStats.preselectedCount > 0 ? 'text-yellow-300' : 'text-slate-500'
                            }`}
                          >
                            {teamStats.preselectedCount}
                          </span>
                          <span className="text-[8px] text-yellow-400/70">selec</span>
                        </div>

                        {/* Veces Observado */}
                        <div
                          className={`rounded-lg p-2 text-center border transition-colors ${
                            teamStats.obsCount > 0
                              ? 'bg-sky-950/40 border-sky-900/50'
                              : 'bg-slate-950/40 border-slate-800'
                          }`}
                        >
                          <span className="text-[9px] font-bold text-sky-300 uppercase tracking-wider flex items-center justify-center gap-0.5">
                            <Eye className="w-2.5 h-2.5" /> Obs
                          </span>
                          <span
                            className={`text-sm font-black mt-0.5 block ${
                              teamStats.obsCount > 0 ? 'text-sky-300' : 'text-slate-500'
                            }`}
                          >
                            {teamStats.obsCount}
                          </span>
                          <span className="text-[8px] text-slate-400">
                            {teamStats.obsCount === 1 ? 'partit' : 'partits'}
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
                        <span>Veure Plantilla ({teamStats.total})</span>
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
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
                const preselectedInTeam = playersList.filter((p) => p.status === 'Preseleccionado').length;

                if (playersList.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      No hi ha jugadors registrats encara per a aquest equip.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Estadísticas de la plantilla */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pb-3 border-b border-slate-800 bg-slate-950/40 p-3 rounded-xl">
                      <span>Total: <strong className="text-white">{playersList.length} jugadors</strong></span>
                      <div className="flex items-center gap-3">
                        <span className="text-indigo-400 font-bold bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/50">
                          {breakdown.secondYear} de 2n any (2013)
                        </span>
                        <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/50">
                          {breakdown.firstYear} de 1r any (2014)
                        </span>
                        <span className="text-yellow-400 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-900/50 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400" />
                          {preselectedInTeam} preseleccionats
                        </span>
                      </div>
                    </div>

                    {/* Lista de Jugadores */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {playersList.map((player: Player) => {
                        const isPreselected = player.status === 'Preseleccionado';
                        const isFirstYear = player.infantil_year === 'Infantil 1er año';

                        return (
                          <div
                            key={player.id}
                            className={`border rounded-xl p-3 flex flex-col justify-between gap-2.5 transition-all ${
                              isPreselected
                                ? 'bg-amber-950/20 border-amber-500/40'
                                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div
                                onClick={() => {
                                  setSelectedTeamForModal(null);
                                  navigate(`/jugadores/${player.id}`);
                                }}
                                className="flex items-center gap-3 min-w-0 cursor-pointer group flex-1"
                              >
                                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300 shrink-0 overflow-hidden shadow-inner">
                                  {player.photo_url ? (
                                    <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{player.first_name[0]}{player.last_name[0]}</span>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-sky-300">
                                      {player.full_name}
                                    </p>
                                    <ChevronRight className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {player.position || 'Jugador'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <JerseyBadge number={player.jersey_number} size="xs" variant="kit" color="blue" />
                                <span
                                  className={`text-[9px] font-black px-2 py-0.5 rounded-full inline-block ${
                                    isFirstYear
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                                      : 'bg-indigo-950 text-indigo-300 border border-indigo-800/50'
                                  }`}
                                >
                                  {isFirstYear ? '1r Any (2014)' : '2n Any (2013)'}
                                </span>
                              </div>
                            </div>

                            {/* Fila inferior: Botón Preseleccionar y Comentario técnico */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                              <button
                                onClick={(e) => handleTogglePreselected(player, e)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                                  isPreselected
                                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-black shadow-sm'
                                    : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-amber-500/60'
                                }`}
                              >
                                <Star className={`w-3 h-3 ${isPreselected ? 'fill-current' : ''}`} />
                                {isPreselected ? 'Preseleccionat' : 'Preseleccionar'}
                              </button>

                              {player.notes ? (
                                <span className="text-[10px] text-slate-400 italic truncate max-w-[150px]">
                                  "{player.notes}"
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-600">Sense informe</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
