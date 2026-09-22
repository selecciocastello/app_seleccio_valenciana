-- Migración: Añadir campos de contacto (teléfono, email, tutor) y notas a la tabla de jugadores
-- Fecha: 2026-09-22

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Índice para búsqueda por posición
CREATE INDEX IF NOT EXISTS idx_players_position ON public.players(position);
