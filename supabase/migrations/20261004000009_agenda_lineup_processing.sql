-- Migración: Procesado del acta de los partidos observados
-- Fecha: 2026-10-04
--
-- scripts/process_observed_matches.cjs revisa los partidos de la agenda marcados como
-- 'Observat' dos días después de jugarse, lee el acta de la FFCV y pasa a 'Observado'
-- a los jugadores de los equipos vistos que jugaron (titulares o suplentes que entraron).
-- Cada partido se procesa una sola vez, para no volver a cambiar un estado que un
-- seleccionador haya editado después.

ALTER TABLE public.scouting_agenda
  ADD COLUMN IF NOT EXISTS lineup_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS played_player_ids JSONB;

CREATE INDEX IF NOT EXISTS idx_scouting_agenda_pending_lineup
  ON public.scouting_agenda(status)
  WHERE lineup_processed_at IS NULL;
