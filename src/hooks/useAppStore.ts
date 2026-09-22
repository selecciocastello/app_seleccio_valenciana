import { useState, useEffect, useCallback } from 'react';
import type { Player, Team, Match, Callup, TrainingSession, PlayerReport, ScoutingAgendaItem } from '../types/models';
import { supabaseService } from '../services/supabaseService';
import { calculateInfantilYear } from '../utils/infantilYear';
import scrapedMatchesData from '../data/scraped_matches.json';
import scrapedPlayersData from '../data/scraped_players.json';
import scrapedTeamsData from '../data/scraped_teams.json';

const INITIAL_CALLUPS: Callup[] = [];
const INITIAL_TRAININGS: TrainingSession[] = [];
const INITIAL_REPORTS: PlayerReport[] = [];

const PARSED_SCRAPED_TEAMS: Team[] = (scrapedTeamsData as any[]).map((t) => ({
  id: t.id || `team_${t.ffcv_cod}`,
  name: t.name,
  club: t.club || t.name,
  competition: t.competition || 'Lliga Preferent Infantil',
  group: t.group || 'Grup - 1',
  crest_url: t.crest_url,
  field_name: t.field_name,
  city: t.city && t.city !== '0' ? t.city : 'Castelló',
  province: t.province && t.province !== 'Otra' ? t.province : 'Castelló',
  address: t.address
}));

const ALL_INITIAL_TEAMS: Team[] = PARSED_SCRAPED_TEAMS;

const PARSED_SCRAPED_PLAYERS: Player[] = (scrapedPlayersData as any[]).map((p) => {
  const parts = (p.full_name || '').split(',');
  const lastName = parts[0] ? parts[0].trim() : '';
  const firstName = parts[1] ? parts[1].trim() : (p.full_name || '');
  const calculatedYear = calculateInfantilYear(p.history, p.age, p.infantil_year);
  return {
    id: p.id || `player_${p.ffcv_player_id}`,
    first_name: firstName,
    last_name: lastName,
    full_name: p.full_name,
    team_id: p.team_id,
    team: {
      id: p.team_id,
      name: p.team,
      club: p.team,
      city: 'Castelló'
    },
    jersey_number: p.dorsal || undefined,
    age: p.age,
    photo_url: p.photo_url,
    infantil_year: calculatedYear,
    history: p.history || [],
    sports_data: p.sports_data || {},
    status: 'Candidato',
    source: 'ffcv_scraping',
    source_player_id: String(p.ffcv_player_id || ''),
    source_url: p.source_url,
    scraped_at: p.scraped_at
  };
});

const ALL_INITIAL_PLAYERS: Player[] = PARSED_SCRAPED_PLAYERS;

const PARSED_SCRAPED_MATCHES: Match[] = (scrapedMatchesData as any[]).map((m) => ({
  id: m.id,
  home_team_id: m.home_team_id,
  home_team_name: m.home_team_name || m.home_team,
  home_crest: m.home_crest,
  home_position: m.home_position,
  home_points: m.home_points,
  away_team_id: m.away_team_id,
  away_team_name: m.away_team_name || m.away_team,
  away_crest: m.away_crest,
  away_position: m.away_position,
  away_points: m.away_points,
  competition_name: m.competition_name || m.competition,
  group_name: m.group_name || m.group,
  matchday: m.matchday,
  match_date: m.match_date ? `${m.match_date}T${m.time || '09:00:00'}Z` : new Date().toISOString(),
  time: m.time,
  field_name: m.field_name,
  field_code: m.field_code,
  address: m.address,
  city: m.city,
  province: m.province,
  postal_code: m.postal_code,
  surface: m.surface,
  latitude: m.latitude,
  longitude: m.longitude,
  status: (m.status as any) || 'Programado',
  home_score: m.home_score,
  away_score: m.away_score,
  referees: m.referees || [],
  codacta: m.codacta,
  source: 'ffcv_scraping'
}));

const ALL_INITIAL_MATCHES: Match[] = PARSED_SCRAPED_MATCHES;

// --- ESTADO GLOBAL COMPARTIDO EN MEMORIA (Singleton para evitar saltos o re-fetches al cambiar de página) ---
let memoryPlayers: Player[] = ALL_INITIAL_PLAYERS;
let memoryTeams: Team[] = ALL_INITIAL_TEAMS;
let memoryMatches: Match[] = ALL_INITIAL_MATCHES;
let memoryCallups: Callup[] = INITIAL_CALLUPS;
let memoryTrainings: TrainingSession[] = INITIAL_TRAININGS;
let memoryReports: PlayerReport[] = INITIAL_REPORTS;
let isDataLoadedFromDb = false;

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

export function useAppStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const rerender = () => setTick((prev) => prev + 1);
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  const [agenda, setAgenda] = useState<ScoutingAgendaItem[]>(() => {
    try {
      const saved = localStorage.getItem('scouting_agenda');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(isDataLoadedFromDb);

  useEffect(() => {
    try {
      localStorage.setItem('scouting_agenda', JSON.stringify(agenda));
    } catch {}
  }, [agenda]);

  useEffect(() => {
    if (supabaseService.isConfigured() && !isDataLoadedFromDb) {
      isDataLoadedFromDb = true;
      setIsSupabaseConnected(true);

      // Cargar datos reales desde Supabase una sola vez al iniciar la sesión
      Promise.all([
        supabaseService.fetchPlayers(),
        supabaseService.fetchTeams(),
        supabaseService.fetchMatches(),
        supabaseService.fetchCallups(),
        supabaseService.fetchTrainings(),
        supabaseService.fetchReports(),
        supabaseService.fetchAgenda()
      ]).then(([dbPlayers, dbTeams, dbMatches, dbCallups, dbTrainings, dbReports, dbAgenda]) => {
        if (dbPlayers.length > 0) memoryPlayers = dbPlayers;
        if (dbTeams.length > 0) memoryTeams = dbTeams;
        if (dbMatches.length > 0) memoryMatches = dbMatches;
        if (dbCallups.length > 0) memoryCallups = dbCallups;
        if (dbTrainings.length > 0) memoryTrainings = dbTrainings;
        if (dbReports.length > 0) memoryReports = dbReports;

        if (dbAgenda.length > 0) {
          setAgenda((prev) => {
            const merged = [...dbAgenda];
            for (const localItem of prev) {
              if (!merged.some((m) => m.id === localItem.id || m.match_id === localItem.match_id)) {
                merged.push(localItem);
              }
            }
            return merged;
          });
        }

        notify();
      });
    }
  }, []);

  const addPlayer = async (newPlayer: Partial<Player>) => {
    const created: Player = {
      id: `p_${Date.now()}`,
      first_name: newPlayer.first_name || '',
      last_name: newPlayer.last_name || '',
      full_name: `${newPlayer.first_name || ''} ${newPlayer.last_name || ''}`.trim(),
      position: newPlayer.position || 'Mediocentro',
      status: newPlayer.status || 'Candidato',
      sports_data: newPlayer.sports_data || {},
      source: 'manual',
      is_manual_override: true,
      ...newPlayer
    };

    memoryPlayers = [created, ...memoryPlayers];
    notify();

    if (supabaseService.isConfigured()) {
      const dbSaved = await supabaseService.savePlayer(created);
      if (dbSaved) {
        memoryPlayers = memoryPlayers.map((p) => (p.id === created.id ? dbSaved : p));
        notify();
      }
    }

    return created;
  };

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    memoryPlayers = memoryPlayers.map((p) =>
      p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
    );
    notify();

    if (supabaseService.isConfigured()) {
      supabaseService.updatePlayer(id, updates);
    }
  };

  const createCallup = (data: Partial<Callup>) => {
    const created: Callup = {
      id: `c_${Date.now()}`,
      title: data.title || 'Nova Convocatòria',
      date: data.date || new Date().toISOString(),
      status: 'Borrador',
      callup_players: [],
      ...data
    };
    memoryCallups = [created, ...memoryCallups];
    notify();
    return created;
  };

  const createTraining = (data: Partial<TrainingSession>) => {
    const created: TrainingSession = {
      id: `t_${Date.now()}`,
      title: data.title || 'Nou Entrenament',
      start_time: data.start_time || new Date().toISOString(),
      end_time: data.end_time || new Date().toISOString(),
      ...data
    };
    memoryTrainings = [created, ...memoryTrainings];
    notify();
    return created;
  };

  const createReport = (data: Partial<PlayerReport>) => {
    const created: PlayerReport = {
      id: `r_${Date.now()}`,
      player_id: data.player_id!,
      report_date: new Date().toISOString().split('T')[0],
      scores: data.scores || { TECNICA: 7, TACTICA: 7, FISICA: 7, ACTITUD: 8 },
      ...data
    };
    memoryReports = [created, ...memoryReports];
    notify();
    return created;
  };

  // --- AGENDA & OBSERVACIONES ---
  const addToAgenda = (match: Match, selectorName?: string) => {
    const existing = agenda.find((a) => a.match_id === match.id);
    if (existing) return existing;

    const newItem: ScoutingAgendaItem = {
      id: `ag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      match_id: match.id,
      match,
      selector_name: selectorName || 'Seleccionador',
      status: 'Planificat',
      scheduled_date: match.match_date,
      home_team_name: match.home_team_name || 'Local',
      away_team_name: match.away_team_name || 'Visitante',
      observed_teams: [match.home_team_name || '', match.away_team_name || ''].filter(Boolean),
      created_at: new Date().toISOString()
    };

    setAgenda((prev) => [newItem, ...prev]);

    if (supabaseService.isConfigured()) {
      supabaseService.saveAgendaItem(newItem);
    }
    return newItem;
  };

  const removeFromAgenda = (agendaIdOrMatchId: string) => {
    setAgenda((prev) => prev.filter((a) => a.id !== agendaIdOrMatchId && a.match_id !== agendaIdOrMatchId));
    if (supabaseService.isConfigured()) {
      supabaseService.deleteAgendaItem(agendaIdOrMatchId);
    }
  };

  const markMatchAsObserved = (
    agendaIdOrMatchId: string,
    details?: {
      observedTeams?: string[];
      notes?: string;
      standoutPlayers?: string[];
      observedAt?: string;
    }
  ) => {
    setAgenda((prev) =>
      prev.map((item) => {
        if (item.id === agendaIdOrMatchId || item.match_id === agendaIdOrMatchId) {
          const updated: ScoutingAgendaItem = {
            ...item,
            status: 'Observat',
            observed_at: details?.observedAt || new Date().toISOString(),
            notes: details?.notes !== undefined ? details.notes : item.notes,
            observed_teams: details?.observedTeams || item.observed_teams,
            standout_players: details?.standoutPlayers || item.standout_players || [],
            updated_at: new Date().toISOString()
          };
          if (supabaseService.isConfigured()) {
            supabaseService.saveAgendaItem(updated);
          }
          return updated;
        }
        return item;
      })
    );
  };

  // Veces que un equipo ha sido observado
  const getTeamObservationCount = useCallback((teamName: string): number => {
    if (!teamName) return 0;
    const cleanTarget = teamName.trim().toLowerCase();
    return agenda.filter((a) => {
      if (a.status !== 'Observat') return false;
      const matchHome = (a.home_team_name || '').trim().toLowerCase();
      const matchAway = (a.away_team_name || '').trim().toLowerCase();
      if (a.observed_teams && a.observed_teams.length > 0) {
        return a.observed_teams.some((ot) => ot.trim().toLowerCase() === cleanTarget);
      }
      return matchHome === cleanTarget || matchAway === cleanTarget;
    }).length;
  }, [agenda]);

  // Lista de observaciones de un equipo
  const getTeamObservations = useCallback((teamName: string): ScoutingAgendaItem[] => {
    if (!teamName) return [];
    const cleanTarget = teamName.trim().toLowerCase();
    return agenda.filter((a) => {
      if (a.status !== 'Observat') return false;
      const matchHome = (a.home_team_name || '').trim().toLowerCase();
      const matchAway = (a.away_team_name || '').trim().toLowerCase();
      if (a.observed_teams && a.observed_teams.length > 0) {
        return a.observed_teams.some((ot) => ot.trim().toLowerCase() === cleanTarget);
      }
      return matchHome === cleanTarget || matchAway === cleanTarget;
    });
  }, [agenda]);

  // Desglose de jugadores por año infantil (2º año / 1er año)
  const getTeamPlayersBreakdown = useCallback((teamNameOrId: string) => {
    if (!teamNameOrId) return { secondYear: 0, firstYear: 0, unknown: 0, total: 0, playersList: [] };
    const normalize = (s?: string) =>
      (s || '')
        .toLowerCase()
        .replace(/['"´`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const targetNorm = normalize(teamNameOrId);

    // IMPORTANTE: Buscar equipo SOLO por id de equipo o nombre exacto de equipo (con la letra 'A'/'B'/'C').
    // NUNCA por t.club para evitar confundir equipos distintos del mismo club (p.ej. Primer Toque C.F. 'B' vs 'C').
    const targetTeam = memoryTeams.find(
      (t: Team) => t.id === teamNameOrId || normalize(t.name) === targetNorm
    );

    const targetTeamId = targetTeam ? targetTeam.id : teamNameOrId;
    const targetNameNorm = targetTeam ? normalize(targetTeam.name) : targetNorm;

    const teamPlayers: Player[] = memoryPlayers.filter((p: Player) => {
      // 1. Coincidencia por team_id exacto (UUID o identificador FFCV)
      if (p.team_id && (p.team_id === targetTeamId || p.team_id === teamNameOrId)) {
        return true;
      }
      if (p.team?.id && (p.team.id === targetTeamId || p.team.id === teamNameOrId)) {
        return true;
      }
      // 2. Coincidencia por nombre exacto normalizado de equipo (preservando la letra 'A'/'B'/'C')
      const pTeamName = normalize(p.team?.name);
      if (pTeamName && (pTeamName === targetNorm || pTeamName === targetNameNorm)) {
        return true;
      }
      // 3. Coincidencia en historial con equipo actual de la temporada 2026-2027
      if (p.history && p.history.length > 0) {
        const cur = p.history.find((h: any) => h.temporada === '2026-2027' || h.temporada === '2026/2027');
        if (cur?.equipo) {
          const histNorm = normalize(cur.equipo);
          if (histNorm === targetNorm || histNorm === targetNameNorm) {
            return true;
          }
        }
      }
      return false;
    });

    const secondYear = teamPlayers.filter((p: Player) => p.infantil_year === 'Infantil 2º año').length;
    const firstYear = teamPlayers.filter((p: Player) => p.infantil_year === 'Infantil 1er año').length;
    const unknown = teamPlayers.filter((p: Player) => !p.infantil_year || p.infantil_year === 'Desconocido').length;

    return {
      secondYear,
      firstYear,
      unknown,
      total: teamPlayers.length,
      playersList: teamPlayers
    };
  }, []);

  // Próximo partido de un equipo
  const getTeamNextMatch = useCallback((teamName: string): Match | null => {
    if (!teamName) return null;
    const cleanTarget = teamName.trim().toLowerCase();
    const now = new Date().toISOString();

    const teamMatches = memoryMatches.filter((m) => {
      const h = (m.home_team_name || '').trim().toLowerCase();
      const a = (m.away_team_name || '').trim().toLowerCase();
      return h === cleanTarget || a === cleanTarget;
    });

    // Próximo partido programado en el futuro
    const upcoming = teamMatches
      .filter((m) => (m.status === 'Programado' || !m.home_score) && m.match_date >= now.slice(0, 10))
      .sort((a, b) => (a.match_date > b.match_date ? 1 : -1));

    if (upcoming.length > 0) return upcoming[0];

    // Si no hay posterior a hoy, el primero programado en la lista
    const scheduled = teamMatches.filter((m) => m.status === 'Programado');
    return scheduled.length > 0 ? scheduled[0] : null;
  }, []);

  return {
    players: memoryPlayers,
    teams: memoryTeams,
    matches: memoryMatches,
    callups: memoryCallups,
    trainings: memoryTrainings,
    reports: memoryReports,
    agenda,
    isSupabaseConnected,
    addPlayer,
    updatePlayer,
    createCallup,
    createTraining,
    createReport,
    addToAgenda,
    removeFromAgenda,
    markMatchAsObserved,
    getTeamObservationCount,
    getTeamObservations,
    getTeamPlayersBreakdown,
    getTeamNextMatch
  };
}
