import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  ShieldAlert,
  Dumbbell,
  MapPin,
  Search,
  Trophy,
  Navigation,
  X,
  Users,
  Info
} from 'lucide-react';
import clsx from 'clsx';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../hooks/useAppStore';
import type { Match } from '../../types/models';

export const CalendarView: React.FC = () => {
  const navigate = useNavigate();
  const { callups, trainings, matches, players } = useAppStore();

  const [activeMainTab, setActiveMainTab] = useState<'matches' | 'events'>('matches');
  const [selectedComp, setSelectedComp] = useState<string>('all');
  const [selectedJornada, setSelectedJornada] = useState<string>('Jornada 1');
  const [search, setSearch] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  // Competiciones únicas disponibles en los partidos
  const competitionsList = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      if (m.competition_name && m.group_name) {
        set.add(`${m.competition_name} - ${m.group_name}`);
      }
    });
    return Array.from(set);
  }, [matches]);

  // Lista de jornadas disponibles ordenadas numéricamente
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

  // Filtrado de partidos
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const compKey = `${m.competition_name} - ${m.group_name}`;
      const matchesComp = selectedComp === 'all' || compKey === selectedComp;
      const matchesJornada = selectedJornada === 'all' || m.matchday === selectedJornada;
      const matchesSearch =
        !search ||
        (m.home_team_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.away_team_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.field_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.city || '').toLowerCase().includes(search.toLowerCase());

      return matchesComp && matchesJornada && matchesSearch;
    });
  }, [matches, selectedComp, selectedJornada, search]);

  // Jugadores asociados a los equipos del partido seleccionado
  const matchRosters = useMemo(() => {
    if (!selectedMatch) return { homePlayers: [], awayPlayers: [] };

    const homeNorm = (selectedMatch.home_team_name || '').toLowerCase().trim();
    const awayNorm = (selectedMatch.away_team_name || '').toLowerCase().trim();

    const homePlayers = players.filter((p) => {
      if (selectedMatch.home_team_id && p.team_id === selectedMatch.home_team_id) return true;
      const pTeam = (p.team?.name || '').toLowerCase().trim();
      return pTeam && (pTeam === homeNorm || homeNorm.includes(pTeam) || pTeam.includes(homeNorm));
    });

    const awayPlayers = players.filter((p) => {
      if (selectedMatch.away_team_id && p.team_id === selectedMatch.away_team_id) return true;
      const pTeam = (p.team?.name || '').toLowerCase().trim();
      return pTeam && (pTeam === awayNorm || awayNorm.includes(pTeam) || pTeam.includes(awayNorm));
    });

    return { homePlayers, awayPlayers };
  }, [selectedMatch, players]);

  // Formato amigable de fecha (ej: sábado, 26 de septiembre de 2026)
  const formatMatchDate = (dateStr?: string) => {
    if (!dateStr) return 'Data per confirmar';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', {
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
            <span>Agenda i Calendari de Partits</span>
            <span className="bg-[#ff6600]/20 text-[#ff6600] border border-[#ff6600]/40 text-xs px-2.5 py-0.5 rounded-full font-bold">
              FFCV Oficial
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Partits oficials de futbol infantil (Preferent i Primera Infantil), instal·lacions, àrbitres i geolocalització GPS
          </p>
        </div>

        {/* Tab Selector Principal */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveMainTab('matches')}
            className={clsx(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
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
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
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
          {/* Barra de Filtros */}
          <Card className="p-4 bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Buscador */}
              <div className="relative md:col-span-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cercar equip, camp o localitat..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Filtro Competición / Grupo */}
              <select
                value={selectedComp}
                onChange={(e) => setSelectedComp(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-sky-500"
              >
                <option value="all">Totes les Competicions i Grups</option>
                {competitionsList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Filtro Jornada */}
              <select
                value={selectedJornada}
                onChange={(e) => setSelectedJornada(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-sky-500"
              >
                <option value="all">Totes les Jornades (1 a 30)</option>
                {jornadasList.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>

              {/* Contador Informativo */}
              <div className="flex items-center justify-end text-xs font-bold text-slate-400 pr-2">
                <span>{filteredMatches.length} partits trobats</span>
              </div>
            </div>
          </Card>

          {/* Grid de Tarjetas de Partidos (Diseño Exacto FFCV Solicitado) */}
          {filteredMatches.length === 0 ? (
            <Card className="p-12 text-center text-slate-400 space-y-2 border border-slate-800">
              <Trophy className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-bold">No s'han trobat partits amb els filtres seleccionats.</p>
              <p className="text-xs text-slate-500">Prova de canviar de jornada o cercar un altre equip.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMatches.map((m) => (
                <div key={m.id} className="flex flex-col space-y-1.5">
                  {/* Etiqueta superior del partido: Competición y Jornada */}
                  <div className="flex items-center justify-between px-2 text-[11px] text-slate-400 font-bold">
                    <span className="flex items-center gap-1.5 text-sky-400">
                      <Trophy className="w-3 h-3" />
                      <span>{m.competition_name} • {m.group_name}</span>
                    </span>
                    <span className="bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                      {m.matchday || 'Partit'}
                    </span>
                  </div>

                  {/* Tarjeta de Partido interactiva (Estructura match-card solicitada) */}
                  <div
                    className="match-card group"
                    data-codacta={m.codacta}
                    data-codlocal={m.home_team_id}
                    data-codvisit={m.away_team_id}
                    data-local={m.home_team_name}
                    data-visitante={m.away_team_name}
                    data-el={m.home_crest}
                    data-ev={m.away_crest}
                    data-jugado={m.status === 'Finalizado' ? '1' : '0'}
                    onClick={() => setSelectedMatch(m)}
                  >
                    {/* Lado Izquierdo: Equipos y Escudos */}
                    <div className="match-left">
                      {/* Fila Equipo Local */}
                      <div className="team-row">
                        <img
                          className="team-logo lazy-logo"
                          src={m.home_crest || 'https://appwebffcv.novanet.es/pnfg/usr/local/projects/weblogic/repository/AS400/02/DOCS/201211/14/12043583.jpg'}
                          alt={m.home_team_name || 'Local'}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="truncate" title={m.home_team_name}>{m.home_team_name}</span>
                        {m.home_position && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20 ml-auto shrink-0 hidden sm:inline-block">
                            Posició {m.home_position} · {m.home_points ?? 0} pts
                          </span>
                        )}
                      </div>

                      {/* Fila Equipo Visitante */}
                      <div className="team-row">
                        <img
                          className="team-logo lazy-logo"
                          src={m.away_crest || 'https://appwebffcv.novanet.es/pnfg/usr/local/projects/weblogic/repository/AS400/02/DOCS/201306/21/12080863.jpg'}
                          alt={m.away_team_name || 'Visitante'}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="truncate" title={m.away_team_name}>{m.away_team_name}</span>
                        {m.away_position && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20 ml-auto shrink-0 hidden sm:inline-block">
                            Posició {m.away_position} · {m.away_points ?? 0} pts
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Divisor Central */}
                    <div className="match-divider"></div>

                    {/* Lado Derecho: Horario / Resultado y Botón Ver Detalles */}
                    <div className="match-right">
                      {m.status === 'Finalizado' && m.home_score != null && m.away_score != null ? (
                        <div className="text-base font-black text-white bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-700">
                          {m.home_score} - {m.away_score}
                        </div>
                      ) : (
                        <div className="m-time">
                          {m.time ? m.time.slice(0, 5) : '09:00'}
                        </div>
                      )}

                      <button
                        className="m-btn m-details"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMatch(m);
                        }}
                      >
                        Ver detalles
                      </button>
                    </div>
                  </div>

                  {/* Sub-barra: Campo y Navegación GPS directa */}
                  <div className="flex items-center justify-between px-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="font-semibold text-slate-300 truncate" title={m.field_name}>
                        {m.field_name || 'Camp per determinar'}
                      </span>
                      {m.city && <span className="text-slate-500 truncate">({m.city})</span>}
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
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalle de Partido Solicitado */}
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

            {/* Contenido del Modal */}
            <div className="p-6 space-y-6">
              {/* Marcador Principal y Equipos */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-inner">
                <div className="grid grid-cols-12 items-center gap-4">
                  {/* Local */}
                  <div className="col-span-5 flex flex-col items-center text-center space-y-2">
                    <div className="w-16 h-16 rounded-2xl bg-slate-900/90 border border-slate-800 p-2 flex items-center justify-center shadow-lg">
                      <img
                        src={selectedMatch.home_crest || 'https://appwebffcv.novanet.es/pnfg/usr/local/projects/weblogic/repository/AS400/02/DOCS/201211/14/12043583.jpg'}
                        alt={selectedMatch.home_team_name || 'Local'}
                        className="w-12 h-12 object-contain"
                      />
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">
                      {selectedMatch.home_team_name}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      Local
                    </span>
                  </div>

                  {/* Centro: Marcador / Horario */}
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
                          {selectedMatch.time ? selectedMatch.time.slice(0, 5) : '09:00'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Visitante */}
                  <div className="col-span-5 flex flex-col items-center text-center space-y-2">
                    <div className="w-16 h-16 rounded-2xl bg-slate-900/90 border border-slate-800 p-2 flex items-center justify-center shadow-lg">
                      <img
                        src={selectedMatch.away_crest || 'https://appwebffcv.novanet.es/pnfg/usr/local/projects/weblogic/repository/AS400/02/DOCS/201306/21/12080863.jpg'}
                        alt={selectedMatch.away_team_name || 'Visitant'}
                        className="w-12 h-12 object-contain"
                      />
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">
                      {selectedMatch.away_team_name}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      Visitant
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloque info-datos-wrap (Estructura Solicitada por el Usuario) */}
              <div className="info-datos-wrap bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Info className="w-4 h-4 text-sky-400" />
                  <span>Dades del Partit i Designació CTAFFCV</span>
                </h4>

                {/* info-fecha */}
                <div id="info-fecha" className="flex items-center gap-2.5 text-base font-bold text-white">
                  <span className="material-symbols-outlined text-sky-400 text-xl">calendar_month</span>
                  <span className="capitalize">{formatMatchDate(selectedMatch.match_date)}</span>
                </div>

                {/* info-hora */}
                <div id="info-hora" className="flex items-center gap-2.5 text-sm font-semibold text-slate-300">
                  <span className="material-symbols-outlined text-sky-400 text-xl">schedule</span>
                  <span>{selectedMatch.time ? selectedMatch.time.slice(0, 5) : '09:00'} h</span>
                </div>

                {/* info-pos-puntos */}
                <div id="info-pos-puntos" className="flex flex-wrap gap-2.5 pt-1">
                  <span className="bg-[#002568]/40 border border-[#002568] text-sky-300 rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm">
                    {selectedMatch.home_team_name}: Posició {selectedMatch.home_position || '11º'} · {selectedMatch.home_points ?? 0} pts
                  </span>
                  <span className="bg-[#002568]/40 border border-[#002568] text-sky-300 rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm">
                    {selectedMatch.away_team_name}: Posició {selectedMatch.away_position || '7º'} · {selectedMatch.away_points ?? 0} pts
                  </span>
                </div>

                {/* info-arbitros */}
                <div id="info-arbitros" className="pt-2">
                  {selectedMatch.referees && selectedMatch.referees.length > 0 ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                      <span className="text-[11px] font-black uppercase text-emerald-400 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base">sports</span>
                        Equip Arbitral Designat (CTAFFCV)
                      </span>
                      <div className="space-y-1 pl-1">
                        {selectedMatch.referees.map((ref, i) => (
                          <p key={i} className="text-xs font-bold text-white">
                            {ref}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#f8fbff]/5 border border-slate-800 rounded-2xl p-4 text-slate-400 flex items-center gap-3">
                      <span className="material-symbols-outlined text-3xl text-slate-500">sports</span>
                      <div className="text-xs">
                        <p className="font-bold text-slate-300">El partit encara no ha sigut designat pel CTAFFCV</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">La Federació de Futbol de la Comunitat Valenciana assignarà àrbitre en les pròximes hores.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Instalación, Campo y Coordenadas GPS (info-campo y svg solicitado) */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>Instal·lació Esportiva i Terreny de Joc</span>
                  </h4>
                  {selectedMatch.field_code && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                      Codi FFCV: {selectedMatch.field_code}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Link del campo con estilo exacto */}
                  <a
                    className="campo flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 transition-all text-white font-black text-sm group"
                    id="info-campo"
                    href={selectedMatch.latitude && selectedMatch.longitude
                      ? `https://www.google.com/maps/search/?api=1&query=${selectedMatch.latitude},${selectedMatch.longitude}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((selectedMatch.field_name || '') + ' ' + (selectedMatch.city || ''))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="block group-hover:text-sky-400 transition-colors">
                          {selectedMatch.field_name || 'Camp per determinar'}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 block">
                          {selectedMatch.city ? `${selectedMatch.city} (${selectedMatch.province || 'Castelló'})` : 'Comunitat Valenciana'}
                        </span>
                      </div>
                    </div>

                    {/* SVG exacto de geolocalización pedido por el usuario */}
                    <div className="p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition-colors shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        ></path>
                      </svg>
                    </div>
                  </a>

                  {/* Detalles adicionales de la instalación */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block text-[10px] font-bold uppercase">Adreça</span>
                      <span className="text-slate-300 font-semibold">{selectedMatch.address || 'Sense adreça específica'}</span>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block text-[10px] font-bold uppercase">Superfície</span>
                      <span className="text-slate-300 font-semibold">{selectedMatch.surface || 'Gespa Artificial F-11'}</span>
                    </div>
                  </div>

                  {/* Botón de Navegación GPS directa */}
                  {selectedMatch.latitude && selectedMatch.longitude ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedMatch.latitude},${selectedMatch.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-bold text-xs shadow-md transition-all"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>Obrir Navegació GPS ({selectedMatch.latitude.toFixed(4)}, {selectedMatch.longitude.toFixed(4)})</span>
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Plantillas / Jugadores Disponibles en la Base de Datos */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>Jugadors Seguiment Selecció Valenciana ({matchRosters.homePlayers.length + matchRosters.awayPlayers.length})</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Jugadores Local */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <span className="text-xs font-black text-sky-400 uppercase block truncate">
                      {selectedMatch.home_team_name} ({matchRosters.homePlayers.length})
                    </span>
                    {matchRosters.homePlayers.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Sincronitzant plantilla de l'equip...</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {matchRosters.homePlayers.map((p) => (
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
                              <span className="text-xs font-bold text-white truncate">{p.full_name}</span>
                            </div>
                            <span
                              className={clsx(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded shrink-0",
                                p.infantil_year === 'Infantil 1er año'
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : p.infantil_year === 'Infantil 2º año'
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  : "bg-slate-800 text-slate-400"
                              )}
                            >
                              {p.infantil_year === 'Infantil 1er año' ? '1er any' : p.infantil_year === 'Infantil 2º año' ? '2n any' : 'Desc'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Jugadores Visitante */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <span className="text-xs font-black text-sky-400 uppercase block truncate">
                      {selectedMatch.away_team_name} ({matchRosters.awayPlayers.length})
                    </span>
                    {matchRosters.awayPlayers.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Sincronitzant plantilla de l'equip...</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {matchRosters.awayPlayers.map((p) => (
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
                              <span className="text-xs font-bold text-white truncate">{p.full_name}</span>
                            </div>
                            <span
                              className={clsx(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded shrink-0",
                                p.infantil_year === 'Infantil 1er año'
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : p.infantil_year === 'Infantil 2º año'
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  : "bg-slate-800 text-slate-400"
                              )}
                            >
                              {p.infantil_year === 'Infantil 1er año' ? '1er any' : p.infantil_year === 'Infantil 2º año' ? '2n any' : 'Desc'}
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

      {/* Vista de Convocatòries i Entrenaments de la Selecció */}
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
                className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-blue-400 uppercase">Convocatòria Oficial</span>
                    <h4 className="text-sm font-bold text-white">{c.title}</h4>
                    <p className="text-xs text-slate-400">{c.location}</p>
                  </div>
                </div>
                <div className="text-right">
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
                className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">Entrenament Tàctic</span>
                    <h4 className="text-sm font-bold text-white">{t.title}</h4>
                    <p className="text-xs text-slate-400">{t.location}</p>
                  </div>
                </div>
                <div className="text-right">
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
