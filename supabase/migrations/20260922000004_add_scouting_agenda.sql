-- Migración: Tabla para la agenda de seleccionadores y seguimiento de partidos observados
-- Fecha: 2026-09-22

CREATE TABLE IF NOT EXISTS public.scouting_agenda (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id VARCHAR(255) NOT NULL,
  selector_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  selector_name VARCHAR(255) NOT NULL,
  status VARCHAR(30) DEFAULT 'Planificat', -- Planificat, Observat
  scheduled_date TIMESTAMPTZ,
  observed_at TIMESTAMPTZ,
  home_team_name VARCHAR(255),
  away_team_name VARCHAR(255),
  observed_teams JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  standout_players JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS y permitir acceso a la app
ALTER TABLE public.scouting_agenda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read agenda" ON public.scouting_agenda;
CREATE POLICY "Public read agenda" ON public.scouting_agenda FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public write agenda" ON public.scouting_agenda;
CREATE POLICY "Public write agenda" ON public.scouting_agenda FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_scouting_agenda_match ON public.scouting_agenda(match_id);
CREATE INDEX IF NOT EXISTS idx_scouting_agenda_status ON public.scouting_agenda(status);
