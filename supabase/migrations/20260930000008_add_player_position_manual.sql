-- Migración: Marcar posiciones editadas a mano por un seleccionador
-- Fecha: 2026-09-30
--
-- El scraper semanal (scripts/scrape_ffcv_infantil.cjs) no sobrescribe la posición
-- de los jugadores con position_manual = true.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS position_manual BOOLEAN NOT NULL DEFAULT FALSE,
  -- Por si la migración 20260924000007 no se aplicó
  ADD COLUMN IF NOT EXISTS secondary_position VARCHAR(100),
  ADD COLUMN IF NOT EXISTS rating SMALLINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_players_rating ON public.players(rating);
CREATE INDEX IF NOT EXISTS idx_players_secondary_position ON public.players(secondary_position);

-- Backfill: las posiciones canónicas de la app (PLAYER_POSITIONS) o una posición
-- alternativa solo han podido venir de una edición manual, porque el scraper
-- anterior guardaba los nombres de la FFCV ('Portero/a', 'Central', 'Medio Centro'...)
-- o 'Sense definir'.
UPDATE public.players
SET position_manual = TRUE
WHERE source = 'ffcv_scraping'
  AND (
    position IN (
      'Portero', 'Lateral Derecho', 'Lateral Izquierdo', 'Defensa Central',
      'Carrilero Derecho', 'Carrilero Izquierdo', 'Pivote Defensivo', 'Mediocentro',
      'Mediapunta', 'Extremo Derecho', 'Extremo Izquierdo', 'Delantero Centro',
      'Segundo Delantero', 'Polivalente'
    )
    OR COALESCE(secondary_position, '') <> ''
  );
