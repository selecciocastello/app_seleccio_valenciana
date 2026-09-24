-- Migración: Añadir campos de posición secundaria y valoración por estrellas (1 a 5)
-- Fecha: 2026-09-24

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS secondary_position VARCHAR(100),
  ADD COLUMN IF NOT EXISTS rating SMALLINT DEFAULT 0;

-- Índices para acelerar filtros por valoración y posición secundaria
CREATE INDEX IF NOT EXISTS idx_players_rating ON public.players(rating);
CREATE INDEX IF NOT EXISTS idx_players_secondary_position ON public.players(secondary_position);
