import { useState, useEffect, useCallback } from 'react';
import type { Player, Team, Match, Callup, TrainingSession, PlayerReport, ScoutingAgendaItem } from '../types/models';
import { supabaseService } from '../services/supabaseService';
import { calculateInfantilYear } from '../utils/infantilYear';
import { cacheGet, cacheSet } from '../utils/dataCache';
import { isSameSelector } from '../utils/agenda';
import scrapedPlayersData from '../data/scraped_players.json';
import scrapedTeamsData from '../data/scraped_teams.json';
import scrapedMatchesData from '../data/scraped_matches.json';

const scrapedPlayersLookup = new Map<string, any>();
(scrapedPlayersData as any[]).forEach((sp) => {
  if (sp.ffcv_player_id) scrapedPlayersLookup.set(String(sp.ffcv_player_id), sp);
  if (sp.source_player_id) scrapedPlayersLookup.set(String(sp.source_player_id), sp);
  if (sp.id) scrapedPlayersLookup.set(String(sp.id), sp);
  if (sp.full_name) scrapedPlayersLookup.set(sp.full_name.trim().toLowerCase(), sp);
});

const scrapedTeamsLookup = new Map<string, any>();
(scrapedTeamsData as any[]).forEach((st) => {
  if (st.id) scrapedTeamsLookup.set(String(st.id), st);
  if (st.ffcv_cod) scrapedTeamsLookup.set(String(st.ffcv_cod), st);
  if (st.name) scrapedTeamsLookup.set(st.name.trim().toLowerCase(), st);
});

const scrapedMatchesLookup = new Map<string, any>();
(scrapedMatchesData as any[]).forEach((sm) => {
  if (sm.id) scrapedMatchesLookup.set(String(sm.id), sm);
  if (sm.codacta) scrapedMatchesLookup.set(String(sm.codacta), sm);
  if (sm.home_team && sm.away_team) {
    const key = `${sm.home_team.trim().toLowerCase()} vs ${sm.away_team.trim().toLowerCase()}`;
    scrapedMatchesLookup.set(key, sm);
  }
});

const INITIAL_TRAININGS: TrainingSession[] = [];
const INITIAL_REPORTS: PlayerReport[] = [];

interface HeavyData {
  players: Player[];
  teams: Team[];
  matches: Match[];
}

interface HeavyCache extends HeavyData {
  version: string | null;
  savedAt: number;
}

const HEAVY_CACHE_KEY = 'heavy_data_v6'; // v6: inferencia automática de categorías oficiales por calendario de partidos
// Aunque la versión no cambie, se refresca como mucho una vez al día
const HEAVY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function parsePlayerName(rawName?: string) {
  if (!rawName) return { firstName: 'Jugador', lastName: '', fullName: 'Jugador' };
  const str = String(rawName).trim();
  if (str.includes(',')) {
    const parts = str.split(',');
    const lastName = parts[0].trim();
    const firstName = parts.slice(1).join(' ').trim();
    const finalFirst = firstName || lastName;
    const finalLast = firstName ? lastName : '';
    const fullName = `${finalFirst} ${finalLast}`.trim();
    return { firstName: finalFirst, lastName: finalLast, fullName };
  } else {
    const words = str.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      return { firstName: str, lastName: '', fullName: str };
    }
    const firstName = words[0];
    const lastName = words.slice(1).join(' ');
    const fullName = `${firstName} ${lastName}`.trim();
    return { firstName, lastName, fullName };
  }
}

// Datos del último scraping incluidos en el repo. Se cargan bajo demanda (chunk aparte)
// solo si Supabase no está disponible y no hay caché local, para no engordar el bundle.
async function loadBundledData(): Promise<HeavyData> {
  const [teamsModule, playersModule, matchesModule] = await Promise.all([
    import('../data/scraped_teams.json'),
    import('../data/scraped_players.json'),
    import('../data/scraped_matches.json')
  ]);

  const teams: Team[] = (teamsModule.default as any[]).map((t) => ({
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

  const teamsMap = new Map<string, Team>();
  teams.forEach((t) => {
    teamsMap.set(t.id, t);
    teamsMap.set(t.name.trim().toLowerCase(), t);
  });

  const players: Player[] = (playersModule.default as any[]).map((p) => {
    const { firstName, lastName, fullName } = parsePlayerName(p.full_name);
    const parsedBirthYear = typeof p.birth_year === 'number' ? p.birth_year : undefined;
    const calculatedYear = calculateInfantilYear(p.history, p.age, p.infantil_year, parsedBirthYear);
    const matchedTeam = teamsMap.get(p.team_id) || teamsMap.get((p.team || '').trim().toLowerCase());
    return {
      id: p.id || `player_${p.ffcv_player_id}`,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      birth_date: p.birth_date,
      birth_year: parsedBirthYear,
      team_id: matchedTeam?.id || p.team_id,
      team: matchedTeam
        ? {
            id: matchedTeam.id,
            name: matchedTeam.name,
            club: matchedTeam.club || matchedTeam.name,
            crest_url: matchedTeam.crest_url,
            city: matchedTeam.city || 'Castelló'
          }
        : {
            id: p.team_id,
            name: p.team,
            club: p.team,
            city: 'Castelló'
          },
      jersey_number: p.dorsal || undefined,
      position: p.position && p.position !== 'Candidato' ? p.position : undefined,
      phone: p.phone,
      email: p.email,
      guardian_name: p.guardian_name,
      guardian_phone: p.guardian_phone,
      guardian_email: p.guardian_email,
      notes: p.notes,
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

  const matches: Match[] = (matchesModule.default as any[]).map((m) => ({
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

  return { players, teams, matches };
}

const CALLUPS_STORAGE_KEY = 'seleccio_callups_v1';

const isSeedDummyCallup = (c: Callup) =>
  !c || c.id === 'c_default_1' || c.id?.startsWith('c1000000-') || c.id?.startsWith('c2000000-') || c.title?.includes('Sub-16');

const isSeedDummyTraining = (t: TrainingSession) =>
  !t || t.id?.startsWith('d1000000-') || t.title?.includes('Fase Regional');

function loadStoredCallups(): Callup[] {
  try {
    const raw = localStorage.getItem(CALLUPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((c: Callup) => !isSeedDummyCallup(c))
          .map((c: Callup) => ({
            ...c,
            callup_players: (c.callup_players || []).map((cp) => ({
              ...cp,
              player: cp.player || memoryPlayers.find((p) => p.id === cp.player_id)
            }))
          }));
      }
    }
  } catch (e) {
    console.error('Error loading stored callups', e);
  }
  return [];
}

// --- ESTADO GLOBAL COMPARTIDO EN MEMORIA (Singleton para evitar saltos o re-fetches al cambiar de página) ---
let memoryPlayers: Player[] = [];
let memoryTeams: Team[] = [];
let memoryMatches: Match[] = [];
/** Identificador d'una valoració del partit (les antigues no tenen id). */
export function dorsalScoutKey(s: import('../types/models').DorsalScoutItem): string {
  return s.id || `${s.side}-${s.dorsal ?? ''}-${s.player_id ?? ''}`;
}

let memoryCallups: Callup[] = loadStoredCallups();
let memoryTrainings: TrainingSession[] = INITIAL_TRAININGS;
let memoryReports: PlayerReport[] = INITIAL_REPORTS;
const AGENDA_STORAGE_KEY = 'scouting_agenda';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let memoryAgenda: ScoutingAgendaItem[] = loadStoredAgenda();
let isDataLoadedFromDb = false;
let heavyCacheVersion: string | null = null;
let heavyCacheSavedAt = 0;


// La columna id de scouting_agenda es UUID: los ids antiguos 'ag_...' se migran al cargar
function loadStoredAgenda(): ScoutingAgendaItem[] {
  try {
    const raw = localStorage.getItem(AGENDA_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((a: ScoutingAgendaItem) => (UUID_RE.test(a.id) ? a : { ...a, id: crypto.randomUUID() }));
  } catch {
    return [];
  }
}

function setMemoryAgenda(next: ScoutingAgendaItem[]) {
  memoryAgenda = next;
  try {
    localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(memoryAgenda));
  } catch {}
  notify();
}

// Guarda en Supabase y marca el item como sincronizado
function saveAgendaItemToDb(item: ScoutingAgendaItem) {
  if (!supabaseService.isConfigured()) return;
  supabaseService.saveAgendaItem(item).then((saved) => {
    if (!saved) return;
    setMemoryAgenda(memoryAgenda.map((a) => (a.id === item.id ? { ...a, synced: true } : a)));
  });
}

function persistCallups() {
  try {
    localStorage.setItem(CALLUPS_STORAGE_KEY, JSON.stringify(memoryCallups));
  } catch (e) {
    console.error('Error persisting callups', e);
  }
}

// Las ediciones locales se guardan en caché sin alargar el TTL de la descarga original
function persistHeavyCache() {
  cacheSet<HeavyCache>(HEAVY_CACHE_KEY, {
    players: memoryPlayers,
    teams: memoryTeams,
    matches: memoryMatches,
    version: heavyCacheVersion,
    savedAt: heavyCacheSavedAt
  });
}

function applyHeavyData(data: HeavyData) {
  // Construir mapa de frecuencias de competición/grupo por equipo a partir del calendario de partidos
  const teamMatchesMap = new Map<string, Map<string, { count: number; competition: string; group: string }>>();
  if (data.matches && data.matches.length > 0) {
    data.matches.forEach((m) => {
      const comp = m.competition_name;
      const grp = m.group_name;
      if (!comp) return;

      const keysToRegister = [
        m.home_team_id,
        m.away_team_id,
        m.home_team_name ? m.home_team_name.trim().toLowerCase() : undefined,
        m.away_team_name ? m.away_team_name.trim().toLowerCase() : undefined
      ].filter(Boolean) as string[];

      const catKey = `${comp}__${grp || ''}`;

      keysToRegister.forEach((k) => {
        if (!teamMatchesMap.has(k)) teamMatchesMap.set(k, new Map());
        const innerMap = teamMatchesMap.get(k)!;
        const current = innerMap.get(catKey) || { count: 0, competition: comp, group: grp || 'Grup - 1' };
        current.count += 1;
        innerMap.set(catKey, current);
      });
    });
  }

  const resolveTeamCompAndGroup = (t: Team, matchScraped?: any) => {
    // 1. Si el equipo ya trae competición y no es el fallback por defecto 'Lliga Preferent Infantil', o si tiene grupo propio
    if (t.competition && t.competition !== 'Lliga Preferent Infantil') {
      return { competition: t.competition, group: t.group || 'Grup - 1' };
    }

    // 2. Comprobar partidos oficiales disputados por el equipo
    const lookupKeys = [
      t.id,
      t.name ? t.name.trim().toLowerCase() : undefined
    ].filter(Boolean) as string[];

    for (const key of lookupKeys) {
      const matchMap = teamMatchesMap.get(key);
      if (matchMap && matchMap.size > 0) {
        let best = { count: 0, competition: '', group: '' };
        for (const item of matchMap.values()) {
          if (item.count > best.count) {
            best = item;
          }
        }
        if (best.competition) {
          return { competition: best.competition, group: best.group || 'Grup - 1' };
        }
      }
    }

    // 3. Comprobar JSON de scraping si contenía datos
    if (matchScraped?.competition) {
      return { competition: matchScraped.competition, group: matchScraped.group || 'Grup - 1' };
    }

    return {
      competition: t.competition || 'Lliga Preferent Infantil',
      group: t.group || 'Grup - 1'
    };
  };

  if (data.teams.length > 0) {
    memoryTeams = data.teams.map((t) => {
      const match =
        (t.id && scrapedTeamsLookup.get(String(t.id))) ||
        (t.name && scrapedTeamsLookup.get(t.name.trim().toLowerCase()));

      const resolved = resolveTeamCompAndGroup(t, match);
      const crest_url = t.crest_url || match?.crest_url;
      const field_name = t.field_name || match?.field_name;
      const city = t.city && t.city !== '0' ? t.city : match?.city || 'Castelló';
      const province = t.province && t.province !== 'Otra' ? t.province : match?.province || 'Castelló';

      return {
        ...t,
        competition: resolved.competition,
        group: resolved.group,
        crest_url,
        field_name,
        city,
        province
      };
    });
  }

  // Mapa per a associar equips per nom i id
  const teamsMap = new Map<string, Team>();
  memoryTeams.forEach((t) => {
    teamsMap.set(t.id, t);
    teamsMap.set(t.name.trim().toLowerCase(), t);
  });

  if (data.players.length > 0) {
    memoryPlayers = data.players.map((p) => {
      const match =
        (p.source_player_id && scrapedPlayersLookup.get(String(p.source_player_id))) ||
        (p.id && scrapedPlayersLookup.get(String(p.id))) ||
        (p.full_name && scrapedPlayersLookup.get(p.full_name.trim().toLowerCase()));

      const birthYear =
        typeof p.birth_year === 'number' && !isNaN(p.birth_year)
          ? p.birth_year
          : match && typeof match.birth_year === 'number'
            ? match.birth_year
            : p.birth_date
              ? new Date(p.birth_date).getFullYear()
              : undefined;

      const birthDate = p.birth_date || (match && match.birth_date);
      const calculatedYear = calculateInfantilYear(p.history, p.age, p.infantil_year, birthYear);

      const teamId = p.team_id || (p.team && typeof p.team === 'object' ? p.team.id : undefined);
      const teamName = (p.team && typeof p.team === 'object' ? p.team.name : p.team) || '';
      const matchedTeam = (teamId ? teamsMap.get(teamId) : undefined) || (teamName ? teamsMap.get(teamName.trim().toLowerCase()) : undefined);

      return {
        ...p,
        birth_year: birthYear,
        birth_date: birthDate,
        infantil_year: calculatedYear,
        team_id: matchedTeam?.id || p.team_id,
        team: matchedTeam
          ? {
              id: matchedTeam.id,
              name: matchedTeam.name,
              club: matchedTeam.club || matchedTeam.name,
              crest_url: matchedTeam.crest_url,
              city: matchedTeam.city || 'Castelló',
              competition: matchedTeam.competition,
              group: matchedTeam.group
            }
          : p.team
      };
    });
  }

  if (data.matches.length > 0) {
    memoryMatches = data.matches.map((m) => {
      const match =
        (m.id && scrapedMatchesLookup.get(String(m.id))) ||
        (m.home_team_name && m.away_team_name && scrapedMatchesLookup.get(`${m.home_team_name.trim().toLowerCase()} vs ${m.away_team_name.trim().toLowerCase()}`));

      const homeTeam = (m.home_team_id ? teamsMap.get(m.home_team_id) : undefined) || (m.home_team_name ? teamsMap.get(m.home_team_name.trim().toLowerCase()) : undefined);
      const awayTeam = (m.away_team_id ? teamsMap.get(m.away_team_id) : undefined) || (m.away_team_name ? teamsMap.get(m.away_team_name.trim().toLowerCase()) : undefined);

      const competition_name = m.competition_name || match?.competition || homeTeam?.competition || awayTeam?.competition || 'Lliga Preferent Infantil';
      const group_name = m.group_name || match?.group || homeTeam?.group || awayTeam?.group || 'Grup - 1';
      const home_crest = m.home_crest || match?.home_crest || homeTeam?.crest_url;
      const away_crest = m.away_crest || match?.away_crest || awayTeam?.crest_url;

      return {
        ...m,
        competition_name,
        group_name,
        home_crest,
        away_crest
      };
    });
  }
}

// Jugadores, equipos y partidos: caché local -> Supabase solo si hay cambios -> JSON del repo
async function loadHeavyData() {
  const cached = await cacheGet<HeavyCache>(HEAVY_CACHE_KEY);
  if (cached) {
    applyHeavyData(cached);
    heavyCacheVersion = cached.version;
    heavyCacheSavedAt = cached.savedAt;
    notify();
  }

  if (supabaseService.isConfigured()) {
    const version = await supabaseService.fetchDataVersion();
    const cacheIsFresh =
      cached &&
      version !== null &&
      cached.version === version &&
      Date.now() - cached.savedAt < HEAVY_CACHE_TTL_MS;
    if (cacheIsFresh) return;

    const [dbPlayers, dbTeams, dbMatches] = await Promise.all([
      supabaseService.fetchPlayers(),
      supabaseService.fetchTeams(),
      supabaseService.fetchMatches()
    ]);
    if (dbPlayers.length > 0 && dbTeams.length > 0 && dbMatches.length > 0) {
      applyHeavyData({ players: dbPlayers, teams: dbTeams, matches: dbMatches });
      heavyCacheVersion = version;
      heavyCacheSavedAt = Date.now();
      persistHeavyCache();
      notify();
      return;
    }
    applyHeavyData({ players: dbPlayers, teams: dbTeams, matches: dbMatches });
  }

  if (!cached && (memoryPlayers.length === 0 || memoryTeams.length === 0 || memoryMatches.length === 0)) {
    const bundled = await loadBundledData();
    if (memoryPlayers.length === 0) memoryPlayers = bundled.players;
    if (memoryTeams.length === 0) memoryTeams = bundled.teams;
    if (memoryMatches.length === 0) memoryMatches = bundled.matches;
  }
  notify();
}

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

  const agenda = memoryAgenda;
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(isDataLoadedFromDb);

  useEffect(() => {
    if (isDataLoadedFromDb) return;
    isDataLoadedFromDb = true;
    setIsSupabaseConnected(Boolean(supabaseService.isConfigured()));

    loadHeavyData();

    if (supabaseService.isConfigured()) {
      // Datos ligeros y editables: siempre se piden frescos
      Promise.all([
        supabaseService.fetchCallups(),
        supabaseService.fetchTrainings(),
        supabaseService.fetchReports(),
        supabaseService.fetchAgenda()
      ]).then(([dbCallups, dbTrainings, dbReports, dbAgenda]) => {
        if (dbCallups.length > 0) {
          const realCallups = dbCallups.filter((c) => !isSeedDummyCallup(c));
          memoryCallups = realCallups;
          persistCallups();
        }
        if (dbTrainings.length > 0) {
          const realTrainings = dbTrainings.filter((t) => !isSeedDummyTraining(t));
          memoryTrainings = realTrainings;
        }
        if (dbReports.length > 0) memoryReports = dbReports;

        // Supabase manda. Los locales que nunca llegaron a subirse se suben ahora;
        // los ya sincronizados que no están en la BD se borraron desde otro dispositivo.
        const merged: ScoutingAgendaItem[] = dbAgenda.map((a) => ({ ...a, synced: true }));
        for (const localItem of memoryAgenda) {
          const inDb = merged.some(
            (m) =>
              m.id === localItem.id ||
              (m.match_id === localItem.match_id && isSameSelector(m.selector_name, localItem.selector_name))
          );
          if (inDb || localItem.synced) continue;
          merged.push(localItem);
          saveAgendaItemToDb(localItem);
        }
        setMemoryAgenda(merged);

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
    persistHeavyCache();

    return created;
  };

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    const current = memoryPlayers.find((p) => p.id === id);
    const positionEdited =
      ('position' in updates && (updates.position || '') !== (current?.position || '')) ||
      ('secondary_position' in updates && (updates.secondary_position || '') !== (current?.secondary_position || ''));
    if (positionEdited) {
      updates = { ...updates, position_manual: true };
    }

    memoryPlayers = memoryPlayers.map((p) =>
      p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
    );
    notify();
    persistHeavyCache();

    if (supabaseService.isConfigured()) {
      supabaseService.updatePlayer(id, updates);
    }
  };

  const createCallup = (data: Partial<Callup>) => {
    const created: Callup = {
      id: `c_${Date.now()}`,
      title: data.title || 'Nova Convocatòria',
      date: data.date || new Date().toISOString(),
      location: data.location || 'Instal·lacions Esportives Chencho (Castelló)',
      status: data.status || 'Planificada',
      notes: data.notes || '',
      callup_players: data.callup_players || [],
      ...data
    };
    memoryCallups = [created, ...memoryCallups];
    persistCallups();
    notify();
    return created;
  };

  const updateCallup = (id: string, updates: Partial<Callup>) => {
    memoryCallups = memoryCallups.map((c) =>
      c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
    );
    persistCallups();
    notify();
  };

  const addPlayersToCallup = (callupId: string, playerIds: string[]) => {
    const targetCallup = memoryCallups.find((c) => c.id === callupId);
    if (!targetCallup) return { addedCount: 0, totalCount: 0 };

    const existingPlayerIds = new Set(
      (targetCallup.callup_players || []).map((cp) => cp.player_id)
    );

    const newCallupPlayers: any[] = [];
    playerIds.forEach((pid) => {
      if (!existingPlayerIds.has(pid)) {
        const pObj = memoryPlayers.find((p) => p.id === pid);
        if (pObj) {
          newCallupPlayers.push({
            id: `cp_${callupId}_${pid}_${Date.now()}`,
            callup_id: callupId,
            player_id: pid,
            player: pObj,
            status: 'Convocado',
            attendance: true,
            created_at: new Date().toISOString()
          });
        }
      }
    });

    const updatedCallupPlayers = [
      ...(targetCallup.callup_players || []),
      ...newCallupPlayers
    ];

    memoryCallups = memoryCallups.map((c) =>
      c.id === callupId
        ? { ...c, callup_players: updatedCallupPlayers, updated_at: new Date().toISOString() }
        : c
    );

    persistCallups();
    notify();

    return {
      addedCount: newCallupPlayers.length,
      totalCount: updatedCallupPlayers.length
    };
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

  const deleteCallup = (id: string) => {
    memoryCallups = memoryCallups.filter((c) => c.id !== id);
    persistCallups();
    notify();
  };

  const deleteTraining = (id: string) => {
    memoryTrainings = memoryTrainings.filter((t) => t.id !== id);
    notify();
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
    const selector = selectorName || 'Seleccionador';
    const existing = memoryAgenda.find(
      (a) => a.match_id === match.id && isSameSelector(a.selector_name, selector)
    );
    if (existing) return existing;

    const newItem: ScoutingAgendaItem = {
      id: crypto.randomUUID(),
      match_id: match.id,
      match,
      selector_name: selector,
      status: 'Planificat',
      scheduled_date: match.match_date,
      home_team_name: match.home_team_name || 'Local',
      away_team_name: match.away_team_name || 'Visitante',
      observed_teams: [match.home_team_name || '', match.away_team_name || ''].filter(Boolean),
      created_at: new Date().toISOString()
    };

    setMemoryAgenda([newItem, ...memoryAgenda]);
    saveAgendaItemToDb(newItem);
    return newItem;
  };

  const removeFromAgenda = (agendaId: string) => {
    setMemoryAgenda(memoryAgenda.filter((a) => a.id !== agendaId));
    if (supabaseService.isConfigured()) {
      supabaseService.deleteAgendaItem(agendaId);
    }
  };

  const markMatchAsObserved = (
    agendaId: string,
    details?: {
      observedTeams?: string[];
      notes?: string;
      standoutPlayers?: string[];
      observedAt?: string;
    }
  ) => {
    setMemoryAgenda(
      memoryAgenda.map((item) => {
        if (item.id !== agendaId) return item;
        const updated: ScoutingAgendaItem = {
          ...item,
          status: 'Observat',
          observed_at: details?.observedAt || new Date().toISOString(),
          notes: details?.notes !== undefined ? details.notes : item.notes,
          observed_teams: details?.observedTeams || item.observed_teams,
          standout_players: details?.standoutPlayers || item.standout_players || [],
          updated_at: new Date().toISOString()
        };
        saveAgendaItemToDb(updated);
        return updated;
      })
    );
  };

  const addDorsalScoutToAgenda = useCallback(
    (agendaId: string, scout: import('../types/models').DorsalScoutItem) => {
      setMemoryAgenda(
        memoryAgenda.map((item) => {
          if (item.id !== agendaId) return item;
          const prevScouts = item.dorsal_scouts || [];
          // Un jugador triat es valora un cop per partit; per dorsal, un cop per dorsal i equip
          const existingIdx = prevScouts.findIndex((s) =>
            scout.identified_by === 'player'
              ? s.identified_by === 'player' && s.player_id === scout.player_id
              : s.identified_by !== 'player' &&
                s.dorsal === scout.dorsal &&
                s.team_name.trim().toLowerCase() === scout.team_name.trim().toLowerCase()
          );
          let newScouts: import('../types/models').DorsalScoutItem[];
          if (existingIdx !== -1) {
            newScouts = [...prevScouts];
            newScouts[existingIdx] = { ...newScouts[existingIdx], ...scout };
          } else {
            newScouts = [...prevScouts, { id: crypto.randomUUID(), ...scout }];
          }

          const updated: ScoutingAgendaItem = {
            ...item,
            dorsal_scouts: newScouts,
            updated_at: new Date().toISOString()
          };
          saveAgendaItemToDb(updated);
          return updated;
        })
      );
    },
    []
  );

  const removeDorsalScoutFromAgenda = useCallback((agendaId: string, scoutKey: string) => {
    const item = memoryAgenda.find((a) => a.id === agendaId);
    if (!item) return;
    const updated: ScoutingAgendaItem = {
      ...item,
      dorsal_scouts: (item.dorsal_scouts || []).filter((s) => dorsalScoutKey(s) !== scoutKey),
      updated_at: new Date().toISOString()
    };
    setMemoryAgenda(memoryAgenda.map((a) => (a.id === agendaId ? updated : a)));
    saveAgendaItemToDb(updated);
  }, []);

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
    updateCallup,
    deleteCallup,
    addPlayersToCallup,
    createTraining,
    deleteTraining,
    createReport,
    addToAgenda,
    removeFromAgenda,
    markMatchAsObserved,
    addDorsalScoutToAgenda,
    removeDorsalScoutFromAgenda,
    getTeamObservationCount,
    getTeamObservations,
    getTeamPlayersBreakdown,
    getTeamNextMatch
  };
}
