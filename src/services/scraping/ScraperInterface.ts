

export interface PlayerScrapedData {
  externalId: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  position?: string;
  dominantFoot?: 'Diestro' | 'Zurdo' | 'Ambidextro';
  teamName?: string;
  clubName?: string;
  jerseyNumber?: number;
  photoUrl?: string;
  city?: string;
  sourceUrl: string;
  sportsData?: Record<string, unknown>;
}

export interface TeamScrapedData {
  externalId: string;
  name: string;
  club: string;
  fieldName?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface MatchScrapedData {
  externalId: string;
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  matchDate: string;
  fieldName?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  homeScore?: number;
  awayScore?: number;
}

export interface ScrapingSyncResult {
  jobId: string;
  source: string;
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  errors: string[];
}

export interface ScraperService {
  readonly sourceName: string;
  
  /**
   * Conecta con la fuente externa (futura web a configurar) y extrae listado de jugadores candidatos
   */
  fetchPlayers(): Promise<PlayerScrapedData[]>;
  
  /**
   * Extrae los equipos actualizados de la competición
   */
  fetchTeams(): Promise<TeamScrapedData[]>;

  /**
   * Extrae el calendario de partidos de la categoría
   */
  fetchMatches(): Promise<MatchScrapedData[]>;

  /**
   * Ejecuta el flujo completo de sincronización mapeando datos a Supabase/Modelos locales
   */
  executeSync(): Promise<ScrapingSyncResult>;
}
