-- Migración: Restricciones únicas para scraping recurrente
-- Permite upsert automático de equipos, jugadores y partidos sin duplicados

DO $$ 
BEGIN
  -- Unique para Equipos por nombre
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_name_key'
  ) THEN
    ALTER TABLE public.teams ADD CONSTRAINT teams_name_key UNIQUE (name);
  END IF;

  -- Unique para Jugadores por origen e ID de origen (FFCV)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_source_source_player_id_key'
  ) THEN
    ALTER TABLE public.players ADD CONSTRAINT players_source_source_player_id_key UNIQUE (source, source_player_id);
  END IF;

  -- Unique para Partidos por origen e ID de partido
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matches_source_source_match_id_key'
  ) THEN
    ALTER TABLE public.matches ADD CONSTRAINT matches_source_source_match_id_key UNIQUE (source, source_match_id);
  END IF;
END $$;
