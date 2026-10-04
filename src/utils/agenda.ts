import type { Match, ScoutingAgendaItem } from '../types/models';
import { isTodayOrFuture } from './dateFilters';

// "Víctor Zandalinas" i "Victor Zandalinas" són el mateix seleccionador
export const normalizeSelectorName = (name?: string) =>
  (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export const isSameSelector = (a?: string, b?: string) => normalizeSelectorName(a) === normalizeSelectorName(b);

/** Data (YYYY-MM-DD) i hora (HH:MM, o '' si no se sap) d'un partit. */
export function getMatchDateTime(match?: Match, fallbackDate?: string): { date: string; time: string } {
  const rawDate = match?.match_date || fallbackDate || '';
  const date = rawDate.slice(0, 10);
  const rawTime = match?.match_time || match?.time || '';
  let time = rawTime ? rawTime.slice(0, 5) : '';
  // Les dates de Supabase porten 00:00 i l'hora va a part; les del JSON porten l'hora inclosa
  if (!time && rawDate.length > 10) {
    const fromDate = rawDate.slice(11, 16);
    if (fromDate && fromDate !== '00:00') time = fromDate;
  }
  return { date, time };
}

export const getAgendaDateTime = (item: ScoutingAgendaItem, match?: Match) =>
  getMatchDateTime(match, item.scheduled_date);

/** Busca el partit d'un item: el guardat a l'item, pel seu id o, si no, per equips i data. */
export function resolveAgendaMatch(item: ScoutingAgendaItem, matches: Match[]): Match | undefined {
  if (item.match) return item.match;
  const byId = matches.find((m) => m.id === item.match_id);
  if (byId) return byId;
  const day = (item.scheduled_date || '').slice(0, 10);
  return matches.find(
    (m) =>
      m.home_team_name === item.home_team_name &&
      m.away_team_name === item.away_team_name &&
      (!day || (m.match_date || '').slice(0, 10) === day)
  );
}

/** Un partit es pot agendar si no s'ha jugat ni suspès i és d'avui o posterior. */
export function isMatchSchedulable(match: Match): boolean {
  if (match.status === 'Jugado' || match.status === 'Finalizado' || match.status === 'Suspendido') return false;
  const date = (match.match_date || '').slice(0, 10);
  return !date || isTodayOrFuture(date);
}
