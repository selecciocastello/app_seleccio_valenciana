-- Migración: Soporte para historial de jugadores, año infantil y agenda FFCV
-- Fecha: 2026-09-21

-- Añadir columnas a tabla players si no existen
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS infantil_year VARCHAR(30) DEFAULT 'Desconocido',
  ADD COLUMN IF NOT EXISTS age INT,
  ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb;

-- Añadir columnas a tabla matches si no existen
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS codacta VARCHAR(50),
  ADD COLUMN IF NOT EXISTS matchday VARCHAR(50),
  ADD COLUMN IF NOT EXISTS match_time VARCHAR(20),
  ADD COLUMN IF NOT EXISTS home_team_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS home_crest TEXT,
  ADD COLUMN IF NOT EXISTS away_team_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS away_crest TEXT,
  ADD COLUMN IF NOT EXISTS competition_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS group_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS referees JSONB DEFAULT '[]'::jsonb;

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_players_infantil_year ON public.players(infantil_year);
CREATE INDEX IF NOT EXISTS idx_matches_matchday ON public.matches(matchday);
CREATE INDEX IF NOT EXISTS idx_matches_codacta ON public.matches(codacta);
