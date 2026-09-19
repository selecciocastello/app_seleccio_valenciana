import { supabase, isSupabaseConfigured } from '../config/supabaseClient';
import type { Player, Team, Callup, TrainingSession, PlayerReport } from '../types/models';

export const supabaseService = {
  isConfigured: isSupabaseConfigured,

  // --- PLAYERS ---
  async fetchPlayers(): Promise<Player[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*, team:teams(*)');

      if (error) {
        console.warn('Error en fetchPlayers de Supabase:', error.message);
        return [];
      }
      return (data as Player[]) || [];
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
        sports_data: player.sports_data || {},
        source: player.source || 'manual',
        city: player.city,
        province: player.province
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
        console.error('Error al actualizar jugador en Supabase:', error.message);
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
      const { data, error } = await supabase.from('teams').select('*');
      if (error) return [];
      return (data as Team[]) || [];
    } catch {
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
  }
};
