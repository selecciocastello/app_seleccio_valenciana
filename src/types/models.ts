export type RoleName = 'admin' | 'seleccionador';

export interface Role {
  id: string;
  name: RoleName;
  description?: string;
  created_at?: string;
}

export interface Profile {
  id: string;
  email: string;
  password?: string;
  full_name: string;
  role_id?: string;
  role?: Role;
  category_assigned?: string;
  avatar_url?: string;
  is_active: boolean;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AppSettings {
  appName: string;
  season: string;
  allowPublicRegistration: boolean;
  maintenanceMode: boolean;
  categories: string[];
}


export type PlayerStatus = 
  | 'Candidato'
  | 'Observado'
  | 'Preseleccionado'
  | 'Seleccionado'
  | 'No seleccionado'
  | 'Lesionado'
  | 'Inactivo';

export interface SportsData {
  Convocados?: string | number;
  Titular?: string | number;
  Suplente?: string | number;
  Jugados?: string | number;
  Goles?: string | number;
  'Media goles/partido'?: string | number;
  Amarillas?: string | number;
  'Doble amarilla'?: string | number;
  Rojas?: string | number;
  'Tarjeta verde'?: string | number;
  matches_played?: number;
  goals?: number;
  assists?: number;
  minutes?: number;
  yellow_cards?: number;
  red_cards?: number;
  [key: string]: unknown;
}

export interface Team {
  id: string;
  name: string;
  club: string;
  category_id?: string;
  competition?: string;
  group?: string;
  crest_url?: string;
  field_name?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Season {
  id: string;
  name: string;
  is_current: boolean;
}

export type InfantilYear = 'Infantil 1er año' | 'Infantil 2º año' | 'Desconocido';

export interface PlayerHistoryItem {
  temporada: string;
  escudo_url?: string | null;
  equipo: string;
  categoria: string;
}

export const PLAYER_POSITIONS = [
  'Portero',
  'Lateral Derecho',
  'Lateral Izquierdo',
  'Defensa Central',
  'Carrilero Derecho',
  'Carrilero Izquierdo',
  'Pivote Defensivo',
  'Mediocentro',
  'Mediapunta',
  'Extremo Derecho',
  'Extremo Izquierdo',
  'Delantero Centro',
  'Segundo Delantero',
  'Polivalente'
] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number] | string;

export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  birth_date?: string;
  category_id?: string;
  category?: Category;
  position?: PlayerPosition;
  dominant_foot?: 'Diestro' | 'Zurdo' | 'Ambidextro';
  team_id?: string;
  team?: Team;
  jersey_number?: number;
  photo_url?: string;
  city?: string;
  province?: string;
  status: PlayerStatus;
  sports_data: SportsData;
  notes?: string;

  // Contacto del jugador y familia/tutores
  phone?: string;
  email?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  
  // Categorización de edad infantil e historial
  infantil_year?: InfantilYear;
  age?: number;
  history?: PlayerHistoryItem[];

  // Scraping metadata
  source: string;
  source_player_id?: string;
  source_url?: string;
  scraped_at?: string;
  is_manual_override?: boolean;
  is_stale?: boolean;

  created_at?: string;
  updated_at?: string;
}

export type MatchStatus = 'Programado' | 'En Curso' | 'Finalizado' | 'Suspendido';

export interface Match {
  id: string;
  home_team_id: string;
  home_team_name?: string;
  home_team?: Team;
  home_crest?: string;
  away_team_id: string;
  away_team_name?: string;
  away_team?: Team;
  away_crest?: string;
  competition_id?: string;
  competition_name?: string;
  group_name?: string;
  category_id?: string;
  matchday?: string;
  match_date: string;
  time?: string;
  home_position?: string;
  home_points?: string | number;
  away_position?: string;
  away_points?: string | number;
  field_name?: string;
  field_code?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  surface?: string;
  latitude?: number;
  longitude?: number;
  status: MatchStatus;
  home_score?: number;
  away_score?: number;
  referees?: string[];
  source?: string;
  source_match_id?: string;
  codacta?: string;
  created_at?: string;
  updated_at?: string;
}

export type CallupStatus = 'Borrador' | 'Planificada' | 'Realizada' | 'Cancelada';
export type CallupAttendanceStatus = 'Convocado' | 'Confirmado' | 'Asistió' | 'No asistió' | 'Justificado' | 'Lesionado';

export interface Callup {
  id: string;
  title: string;
  category_id?: string;
  season_id?: string;
  date: string;
  location?: string;
  address?: string;
  selector_id?: string;
  selector?: Profile;
  status: CallupStatus;
  notes?: string;
  callup_players?: CallupPlayer[];
  created_at?: string;
  updated_at?: string;
}

export interface CallupPlayer {
  id: string;
  callup_id: string;
  player_id: string;
  player?: Player;
  status: CallupAttendanceStatus;
  attendance: boolean;
  notes?: string;
  created_at?: string;
}

export interface TrainingSession {
  id: string;
  title: string;
  category_id?: string;
  season_id?: string;
  start_time: string;
  end_time: string;
  location?: string;
  field_name?: string;
  selector_id?: string;
  selector?: Profile;
  objective?: string;
  description?: string;
  notes?: string;
  exercises?: TrainingExercise[];
  attendance?: TrainingAttendance[];
  created_at?: string;
  updated_at?: string;
}

export interface TrainingExercise {
  id: string;
  title: string;
  duration_minutes?: number;
  player_count?: number;
  space_dimensions?: string;
  objective?: string;
  description?: string;
  equipment?: string;
  notes?: string;
}

export interface TrainingAttendance {
  id: string;
  session_id: string;
  player_id: string;
  player?: Player;
  status: CallupAttendanceStatus;
  attended: boolean;
  notes?: string;
}

export interface PlayerReport {
  id: string;
  player_id: string;
  player?: Player;
  selector_id?: string;
  selector?: Profile;
  callup_id?: string;
  training_session_id?: string;
  report_date: string;
  technical_summary?: string;
  tactical_summary?: string;
  physical_summary?: string;
  psychological_summary?: string;
  general_notes?: string;
  recommendation?: string;
  scores: Record<string, number>; // e.g. { TECNICA: 8, TACTICA: 7, FISICA: 9, ACTITUD: 10 }
  created_at?: string;
  updated_at?: string;
}

export interface ScrapingJob {
  id: string;
  source: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  records_processed: number;
  players_created: number;
  players_updated: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

export interface ScrapingLog {
  id: string;
  job_id: string;
  log_level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user?: Profile;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface ScoutingAgendaItem {
  id: string;
  match_id: string;
  match?: Match;
  selector_id?: string;
  selector_name: string;
  status: 'Planificat' | 'Observat';
  scheduled_date?: string;
  observed_at?: string;
  home_team_name: string;
  away_team_name: string;
  observed_teams: string[];
  notes?: string;
  standout_players?: string[];
  created_at: string;
  updated_at?: string;
}

