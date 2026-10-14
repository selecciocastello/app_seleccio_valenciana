-- Migración: Añadir campo dorsal_scouts a la tabla scouting_agenda
-- Fecha: 2026-10-14
--
-- Permite almacenar el registro estructurado de dorsales y notas técnicas anotadas
-- por los seleccionadores en directo durante un partido para su reconciliación
-- automática posterior con el acta oficial de la FFCV.

ALTER TABLE public.scouting_agenda
  ADD COLUMN IF NOT EXISTS dorsal_scouts JSONB DEFAULT '[]'::jsonb;

-- Índice para consultas sobre partidos con anotaciones de dorsal pendientes
CREATE INDEX IF NOT EXISTS idx_scouting_agenda_dorsal_scouts
  ON public.scouting_agenda USING gin (dorsal_scouts);
