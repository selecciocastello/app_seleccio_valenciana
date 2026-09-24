import { supabase, isSupabaseConfigured } from '../config/supabaseClient';
import type { Player, Team, Match, Callup, TrainingSession, PlayerReport, ScoutingAgendaItem } from '../types/models';
import { calculateInfantilYear } from '../utils/infantilYear';

export const supabaseService = {
  isConfigured: isSupabaseConfigured,

  // Versión de los datos pesados: máximo updated_at de jugadores, equipos y partidos.
  // Son 3 consultas de una fila, así el cliente decide si su caché local sigue valiendo.
  async fetchDataVersion(): Promise<string | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const results = await Promise.all(
        ['players', 'teams', 'matches'].map((table) =>
          supabase.from(table).select('updated_at').order('updated_at', { ascending: false, nullsFirst: false }).limit(1)
        )
      );
      if (results.some((r) => r.error)) return null;
      return results.map((r) => r.data?.[0]?.updated_at ?? '').join('|');
    } catch {
      return null;
    }
  },

  // --- PLAYERS ---
  async fetchPlayers(): Promise<Player[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*, team:teams(*)')
        .order('full_name', { ascending: true })
        .limit(5000);

      if (error) {
        console.warn('Error en fetchPlayers de Supabase:', error.message);
        return [];
      }
      return ((data as Player[]) || []).map((p) => ({
        ...p,
        infantil_year: calculateInfantilYear(p.history, p.age, p.infantil_year)
      }));
    } catch (e) {
      console.warn('Excepción al conectar con Supabase (fetchPlayers):', e);
      return [];
    }
  },

  async savePlayer(player: Partial<Player>): Promise<Player | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const payload = {
        first_name: player.first_name,
        last_name: player.last_name,
        full_name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
        birth_date: player.birth_date,
        position: player.position,
        dominant_foot: player.dominant_foot,
        team_id: player.team_id,
        jersey_number: player.jersey_number,
        status: player.status || 'Candidato',
        infantil_year: player.infantil_year || 'Desconocido',
        age: player.age,
        history: player.history || [],
        sports_data: player.sports_data || {},
        source: player.source || 'manual',
        city: player.city || 'Castelló',
        province: player.province || 'Castelló',
        phone: player.phone,
        email: player.email,
        guardian_name: player.guardian_name,
        guardian_phone: player.guardian_phone,
        guardian_email: player.guardian_email,
        notes: player.notes
      };

      const { data, error } = await supabase
        .from('players')
        .insert([payload])
        .select('*, team:teams(*)')
        .single();

      if (error) {
        console.error('Error al guardar jugador en Supabase:', error.message);
        return null;
      }
      return data as Player;
    } catch (e) {
      console.error('Excepción al guardar jugador en Supabase:', e);
      return null;
    }
  },

  async updatePlayer(id: string, updates: Partial<Player>): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { error } = await supabase
        .from('players')
        .update(updates)
        .eq('id', id);

      if (error) {
        // Si el esquema de Supabase aún no tiene las columnas recién migradas, reintentar guardando el resto
        if (error.message?.includes('schema cache') || error.message?.includes('column')) {
          const sanitized = { ...updates };
          delete (sanitized as any).secondary_position;
          delete (sanitized as any).rating;
          if (Object.keys(sanitized).length > 0) {
            await supabase.from('players').update(sanitized).eq('id', id);
          }
        }
        return false;
      }
      return true;
    } catch (e) {
      console.error('Excepción al actualizar jugador en Supabase:', e);
      return false;
    }
  },

  // --- TEAMS ---
  async fetchTeams(): Promise<Team[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true })
        .limit(1000);
      if (error) return [];
      return (data as Team[]) || [];
    } catch {
      return [];
    }
  },

  // --- MATCHES ---
  async fetchMatches(): Promise<Match[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('match_date', { ascending: true })
        .limit(5000);
      if (error) {
        console.warn('Error en fetchMatches de Supabase:', error.message);
        return [];
      }
      return (data as Match[]) || [];
    } catch (e) {
      console.warn('Excepción al conectar con Supabase (fetchMatches):', e);
      return [];
    }
  },

  // --- CALLUPS ---
  async fetchCallups(): Promise<Callup[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('callups')
        .select('*, callup_players(*, player:players(*))');
      if (error) return [];
      return (data as Callup[]) || [];
    } catch {
      return [];
    }
  },

  async saveCallup(callup: Partial<Callup>): Promise<Callup | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data, error } = await supabase
        .from('callups')
        .insert([{
          title: callup.title,
          date: callup.date,
          location: callup.location,
          address: callup.address,
          status: callup.status || 'Borrador',
          notes: callup.notes
        }])
        .select('*')
        .single();

      if (error) return null;
      return data as Callup;
    } catch {
      return null;
    }
  },

  // --- TRAININGS ---
  async fetchTrainings(): Promise<TrainingSession[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase.from('training_sessions').select('*');
      if (error) return [];
      return (data as TrainingSession[]) || [];
    } catch {
      return [];
    }
  },

  // --- REPORTS ---
  async fetchReports(): Promise<PlayerReport[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('player_reports')
        .select('*, player:players(*)');
      if (error) return [];
      return (data as PlayerReport[]) || [];
    } catch {
      return [];
    }
  },

  // --- SCOUTING AGENDA ---
  async fetchAgenda(): Promise<ScoutingAgendaItem[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase.from('scouting_agenda').select('*');
      if (error) return [];
      return (data as ScoutingAgendaItem[]) || [];
    } catch {
      return [];
    }
  },

  async saveAgendaItem(item: Partial<ScoutingAgendaItem>): Promise<ScoutingAgendaItem | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data, error } = await supabase
        .from('scouting_agenda')
        .upsert([{
          id: item.id,
          match_id: item.match_id,
          selector_id: item.selector_id,
          selector_name: item.selector_name || 'Seleccionador',
          status: item.status || 'Planificat',
          scheduled_date: item.scheduled_date,
          observed_at: item.observed_at,
          home_team_name: item.home_team_name,
          away_team_name: item.away_team_name,
          observed_teams: item.observed_teams || [],
          notes: item.notes,
          standout_players: item.standout_players || [],
          updated_at: new Date().toISOString()
        }])
        .select('*')
        .single();

      if (error) return null;
      return data as ScoutingAgendaItem;
    } catch {
      return null;
    }
  },

  async deleteAgendaItem(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    try {
      const { error } = await supabase.from('scouting_agenda').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }
};
