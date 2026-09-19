import type { ScraperService, PlayerScrapedData, TeamScrapedData, MatchScrapedData, ScrapingSyncResult } from './ScraperInterface';

/**
 * MockScraperService
 * Implementación desacoplada y genérica para pruebas, desarrollo y demos del sistema.
 * Lista para ser sustituida o complementada por scrapers reales (e.g. FFCV o ligas locales).
 */
export class MockScraperService implements ScraperService {
  public readonly sourceName = 'fuente_territorial_castello_mock';

  // AQUÍ ES DONDE POSTERIORMENTE SE CONFIGURARÁ LA URL EXTERNA REAL
  private readonly targetUrl: string = 'https://configuracion-futura-fuente.es/castello-cadete';

  async fetchPlayers(): Promise<PlayerScrapedData[]> {
    // Simulación de respuesta con delay simulando scraping serverless
    await new Promise((resolve) => setTimeout(resolve, 1200));

    return [
      {
        externalId: 'EXT-SCR-201',
        firstName: 'Guillem',
        lastName: 'Pérez Porcar',
        birthDate: '2010-05-14',
        position: 'Mediocentro',
        dominantFoot: 'Diestro',
        teamName: 'CD Castellón Sub-16',
        clubName: 'Club Deportivo Castellón',
        jerseyNumber: 8,
        city: 'Castelló de la Plana',
        sourceUrl: `${this.targetUrl}/players/201`,
        sportsData: { matches_played: 14, goals: 3, assists: 6 }
      },
      {
        externalId: 'EXT-SCR-202',
        firstName: 'Arnau',
        lastName: 'Fandos Beltrán',
        birthDate: '2010-09-28',
        position: 'Lateral Izquierdo',
        dominantFoot: 'Zurdo',
        teamName: 'Villarreal CF Cadete A',
        clubName: 'Villarreal CF',
        jerseyNumber: 3,
        city: 'Vila-real',
        sourceUrl: `${this.targetUrl}/players/202`,
        sportsData: { matches_played: 16, goals: 1, assists: 4 }
      },
      {
        externalId: 'EXT-SCR-203',
        firstName: 'Marc',
        lastName: 'Ribera Nebot',
        birthDate: '2010-02-03',
        position: 'Delantero Centro',
        dominantFoot: 'Diestro',
        teamName: 'CD Roda Sub-16',
        clubName: 'CD Roda',
        jerseyNumber: 9,
        city: 'Burriana',
        sourceUrl: `${this.targetUrl}/players/203`,
        sportsData: { matches_played: 15, goals: 12, assists: 2 }
      }
    ];
  }

  async fetchTeams(): Promise<TeamScrapedData[]> {
    return [
      {
        externalId: 'EXT-T-01',
        name: 'CD Castellón Sub-16',
        club: 'CD Castellón',
        fieldName: 'Estadio Castalia',
        address: 'Carrer de la Penyagolosa, s/n',
        city: 'Castelló de la Plana',
        latitude: 39.9958,
        longitude: -0.0401
      }
    ];
  }

  async fetchMatches(): Promise<MatchScrapedData[]> {
    return [
      {
        externalId: 'EXT-M-501',
        homeTeamExternalId: 'EXT-T-01',
        awayTeamExternalId: 'EXT-T-02',
        matchDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        fieldName: 'Gaetà Huguet',
        city: 'Castelló de la Plana',
        latitude: 39.9958,
        longitude: -0.0401
      }
    ];
  }

  async executeSync(): Promise<ScrapingSyncResult> {
    const players = await this.fetchPlayers();
    
    // Proceso de sync mock
    return {
      jobId: `job_${Date.now()}`,
      source: this.sourceName,
      processedCount: players.length,
      createdCount: 2,
      updatedCount: 1,
      errors: []
    };
  }
}
