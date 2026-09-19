import { useState, useEffect } from 'react';
import type { Player, Team, Match, Callup, TrainingSession, PlayerReport } from '../types/models';
import { supabaseService } from '../services/supabaseService';

// Mocks locales precargados basados en el seed SQL
const INITIAL_TEAMS: Team[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'CD Castellón Sub-16',
    club: 'Club Deportivo Castellón',
    field_name: 'Estadio Castalia / Gaetà Huguet',
    address: 'Carrer de la Penyagolosa, s/n',
    city: 'Castelló de la Plana',
    province: 'Castelló',
    latitude: 39.9958,
    longitude: -0.0401
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Villarreal CF Cadete A',
    club: 'Villarreal CF',
    field_name: 'Ciudad Deportiva José Manuel Llaneza',
    address: 'Camí Miralcamp, s/n',
    city: 'Vila-real',
    province: 'Castelló',
    latitude: 39.9328,
    longitude: -0.1082
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'CD Roda Sub-16',
    club: 'CD Roda',
    field_name: 'Ciutat Esportiva Pamesa Ceràmica',
    address: 'Camí Fondo, s/n',
    city: 'Vila-real',
    province: 'Castelló',
    latitude: 39.9485,
    longitude: -0.0911
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Primer Templo Castelló Sub-16',
    club: 'Primer Templo FC',
    field_name: 'Campo Municipal Chencho',
    address: 'Quadra de la Salera, s/n',
    city: 'Castelló de la Plana',
    province: 'Castelló',
    latitude: 39.9782,
    longitude: -0.0523
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'U.D. Vall de Uxó Cadete',
    club: 'U.D. Vall de Uxó',
    field_name: 'Estadio José Mangriñán',
    address: 'Av. Jaume I, s/n',
    city: 'La Vall d\'Uixó',
    province: 'Castelló',
    latitude: 39.8242,
    longitude: -0.2312
  }
];

const INITIAL_PLAYERS: Player[] = [
  {
    id: 'a1000000-0000-0000-0000-000000000001',
    first_name: 'Pau',
    last_name: 'Ribes Martí',
    full_name: 'Pau Ribes Martí',
    birth_date: '2010-04-12',
    position: 'Portero',
    dominant_foot: 'Diestro',
    team_id: '11111111-1111-1111-1111-111111111111',
    team: INITIAL_TEAMS[0],
    jersey_number: 1,
    status: 'Preseleccionado',
    city: 'Castelló de la Plana',
    province: 'Castelló',
    sports_data: { matches_played: 18, clean_sheets: 7, minutes: 1440 },
    source: 'source_a_scraping',
    source_player_id: 'EXT-P-101'
  },
  {
    id: 'a1000000-0000-0000-0000-000000000002',
    first_name: 'Marc',
    last_name: 'Beltrán Soler',
    full_name: 'Marc Beltrán Soler',
    birth_date: '2010-02-18',
    position: 'Defensa Central',
    dominant_foot: 'Diestro',
    team_id: '11111111-1111-1111-1111-111111111111',
    team: INITIAL_TEAMS[0],
    jersey_number: 4,
    status: 'Seleccionado',
    city: 'Castelló de la Plana',
    province: 'Castelló',
    sports_data: { matches_played: 20, goals: 2, minutes: 1600 },
    source: 'source_a_scraping',
    source_player_id: 'EXT-P-102'
  },
  {
    id: 'a1000000-0000-0000-0000-000000000003',
    first_name: 'Adrià',
    last_name: 'Ferrer Gimeno',
    full_name: 'Adrià Ferrer Gimeno',
    birth_date: '2010-08-05',
    position: 'Lateral Izquierdo',
    dominant_foot: 'Zurdo',
    team_id: '22222222-2222-2222-2222-222222222222',
    team: INITIAL_TEAMS[1],
    jersey_number: 3,
    status: 'Seleccionado',
    city: 'Vila-real',
    province: 'Castelló',
    sports_data: { matches_played: 19, assists: 5, minutes: 1520 },
    source: 'source_a_scraping',
    source_player_id: 'EXT-P-103'
  },
  {
    id: 'a1000000-0000-0000-0000-000000000004',
    first_name: 'Lluc',
    last_name: 'Navarro Fuster',
    full_name: 'Lluc Navarro Fuster',
    birth_date: '2010-01-22',
    position: 'Mediocentro',
    dominant_foot: 'Diestro',
    team_id: '22222222-2222-2222-2222-222222222222',
    team: INITIAL_TEAMS[1],
    jersey_number: 6,
    status: 'Seleccionado',
    city: 'Burriana',
    province: 'Castelló',
    sports_data: { matches_played: 21, goals: 4, assists: 8, minutes: 1650 },
    source: 'source_a_scraping',
    source_player_id: 'EXT-P-104'
  },
  {
    id: 'a1000000-0000-0000-0000-000000000006',
    first_name: 'Arnau',
    last_name: 'Vidal Puig',
    full_name: 'Arnau Vidal Puig',
    birth_date: '2010-06-14',
    position: 'Delantero Centro',
    dominant_foot: 'Diestro',
    team_id: '11111111-1111-1111-1111-111111111111',
    team: INITIAL_TEAMS[0],
    jersey_number: 9,
    status: 'Seleccionado',
    city: 'Benicàssim',
    province: 'Castelló',
    sports_data: { matches_played: 20, goals: 15, assists: 3, minutes: 1580 },
    source: 'source_a_scraping',
    source_player_id: 'EXT-P-106'
  }
];

const INITIAL_MATCHES: Match[] = [
  {
    id: 'b1000000-0000-0000-0000-000000000001',
    home_team_id: INITIAL_TEAMS[0].id,
    home_team: INITIAL_TEAMS[0],
    away_team_id: INITIAL_TEAMS[1].id,
    away_team: INITIAL_TEAMS[1],
    match_date: new Date(Date.now() + 86400000 * 2).toISOString(),
    field_name: 'Gaetà Huguet',
    address: 'Carrer de la Penyagolosa',
    city: 'Castelló de la Plana',
    latitude: 39.9958,
    longitude: -0.0401,
    status: 'Programado'
  },
  {
    id: 'b1000000-0000-0000-0000-000000000002',
    home_team_id: INITIAL_TEAMS[2].id,
    home_team: INITIAL_TEAMS[2],
    away_team_id: INITIAL_TEAMS[3].id,
    away_team: INITIAL_TEAMS[3],
    match_date: new Date(Date.now() + 86400000 * 5).toISOString(),
    field_name: 'Ciutat Esportiva Pamesa Ceràmica',
    address: 'Camí Fondo',
    city: 'Vila-real',
    latitude: 39.9485,
    longitude: -0.0911,
    status: 'Programado'
  }
];

const INITIAL_CALLUPS: Callup[] = [
  {
    id: 'c1000000-0000-0000-0000-000000000001',
    title: 'I Convocatòria Selecció Castelló Sub-16',
    date: new Date(Date.now() + 86400000 * 4).toISOString(),
    location: 'Instal·lacions Chencho',
    address: 'Quadra de la Salera, Castelló',
    status: 'Planificada',
    notes: 'Convocatòria oficial de preparació per al Campionat Autonòmic.',
    callup_players: INITIAL_PLAYERS.map((p) => ({
      id: `cp_${p.id}`,
      callup_id: 'c1000000-0000-0000-0000-000000000001',
      player_id: p.id,
      player: p,
      status: 'Confirmado',
      attendance: true
    }))
  }
];

const INITIAL_TRAININGS: TrainingSession[] = [
  {
    id: 'd1000000-0000-0000-0000-000000000001',
    title: 'Entrenament Preparatori Fase Regional',
    start_time: new Date(Date.now() + 86400000 * 3).toISOString(),
    end_time: new Date(Date.now() + 86400000 * 3 + 7200000).toISOString(),
    location: 'Gaetà Huguet',
    field_name: 'Camp 1 Gespa Natural',
    objective: 'Pressió alta i eixida de pilota des de porteria',
    description: 'Entrenament específic d\'automatismes tàctics.',
    attendance: INITIAL_PLAYERS.map((p) => ({
      id: `ta_${p.id}`,
      session_id: 'd1000000-0000-0000-0000-000000000001',
      player_id: p.id,
      player: p,
      status: 'Asistió',
      attended: true
    }))
  }
];

const INITIAL_REPORTS: PlayerReport[] = [
  {
    id: 'r1000000-0000-0000-0000-000000000001',
    player_id: INITIAL_PLAYERS[0].id,
    player: INITIAL_PLAYERS[0],
    report_date: new Date().toISOString().split('T')[0],
    technical_summary: 'Excel·lent joc amb els peus i seguretat en pilotes altes.',
    tactical_summary: 'Bona organització de la línia defensiva.',
    physical_summary: 'Àgil, potència de salt destacada.',
    psychological_summary: 'Lideratge positiu i molta concentració.',
    recommendation: 'Preseleccionable',
    scores: { TECNICA: 8, TACTICA: 8, FISICA: 9, ACTITUD: 9 }
  }
];

export function useAppStore() {
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [teams, setTeams] = useState<Team[]>(INITIAL_TEAMS);
  const [matches] = useState<Match[]>(INITIAL_MATCHES);
  const [callups, setCallups] = useState<Callup[]>(INITIAL_CALLUPS);
  const [trainings, setTrainings] = useState<TrainingSession[]>(INITIAL_TRAININGS);
  const [reports, setReports] = useState<PlayerReport[]>(INITIAL_REPORTS);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);

  useEffect(() => {
    if (supabaseService.isConfigured()) {
      setIsSupabaseConnected(true);

      // Cargar datos reales desde Supabase si la conexión está activa
      supabaseService.fetchPlayers().then((dbPlayers) => {
        if (dbPlayers.length > 0) setPlayers(dbPlayers);
      });

      supabaseService.fetchTeams().then((dbTeams) => {
        if (dbTeams.length > 0) setTeams(dbTeams);
      });

      supabaseService.fetchCallups().then((dbCallups) => {
        if (dbCallups.length > 0) setCallups(dbCallups);
      });

      supabaseService.fetchTrainings().then((dbTrainings) => {
        if (dbTrainings.length > 0) setTrainings(dbTrainings);
      });

      supabaseService.fetchReports().then((dbReports) => {
        if (dbReports.length > 0) setReports(dbReports);
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

    setPlayers((prev) => [created, ...prev]);

    if (supabaseService.isConfigured()) {
      const dbSaved = await supabaseService.savePlayer(created);
      if (dbSaved) {
        setPlayers((prev) => prev.map((p) => (p.id === created.id ? dbSaved : p)));
      }
    }

    return created;
  };

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p))
    );

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
    setCallups((prev) => [created, ...prev]);
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
    setTrainings((prev) => [created, ...prev]);
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
    setReports((prev) => [created, ...prev]);
    return created;
  };

  return {
    players,
    teams,
    matches,
    callups,
    trainings,
    reports,
    addPlayer,
    updatePlayer,
    createCallup,
    createTraining,
    createReport
  };
}
