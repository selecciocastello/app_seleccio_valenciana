-- Migración inicial para Selecció Valenciana Castelló Futbol

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tablas de Configuración Global y Roles
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.roles (name, description) VALUES
  ('admin', 'Administrador total de la plataforma'),
  ('seleccionador', 'Seleccionador técnico de Castelló')
ON CONFLICT (name) DO NOTHING;

-- Perfiles de usuario (conectado con auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role_id UUID REFERENCES public.roles(id),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Temporadas y Categorías
CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL, -- e.g. "2025/2026"
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL, -- e.g. "Sub-12", "Sub-14", "Sub-16"
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.seasons (name, is_current) VALUES ('2025/2026', true) ON CONFLICT DO NOTHING;
INSERT INTO public.categories (name) VALUES ('Sub-12'), ('Sub-14'), ('Sub-16'), ('Sub-18') ON CONFLICT DO NOTHING;

-- Equipos
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  club VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  crest_url TEXT,
  field_name VARCHAR(255),
  address TEXT,
  city VARCHAR(100) DEFAULT 'Castelló de la Plana',
  province VARCHAR(100) DEFAULT 'Castelló',
  country VARCHAR(100) DEFAULT 'España',
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competiciones
CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  season_id UUID REFERENCES public.seasons(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jugadores
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(255) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  birth_date DATE,
  category_id UUID REFERENCES public.categories(id),
  position VARCHAR(50), -- Portero, Defensa Central, Lateral Izquierdo, Mediocentro, Delantero, etc.
  dominant_foot VARCHAR(20), -- Diestro, Zurdo, Ambidextro
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  jersey_number INT,
  photo_url TEXT,
  city VARCHAR(100),
  province VARCHAR(100) DEFAULT 'Castelló',
  status VARCHAR(30) DEFAULT 'Candidato', -- Candidato, Observado, Preseleccionado, Seleccionado, No seleccionado, Lesionado, Inactivo
  sports_data JSONB DEFAULT '{}'::jsonb, -- Goles, minutos, partidos jugados, tarjetas, etc.
  notes TEXT,
  
  -- Scraping / Sincronización Metadata
  source VARCHAR(100) DEFAULT 'manual', -- e.g. 'manual', 'source_a_scraping'
  source_player_id VARCHAR(255),
  source_url TEXT,
  scraped_at TIMESTAMPTZ,
  is_manual_override BOOLEAN DEFAULT FALSE,
  is_stale BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_source ON public.players(source, source_player_id) WHERE source_player_id IS NOT NULL;

-- Partidos
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  home_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  away_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id),
  match_date TIMESTAMPTZ NOT NULL,
  field_name VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(100) DEFAULT 'Castelló',
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  status VARCHAR(30) DEFAULT 'Programado', -- Programado, En Curso, Finalizado, Suspendido
  home_score INT,
  away_score INT,
  source VARCHAR(100) DEFAULT 'manual',
  source_match_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convocatorias
CREATE TABLE IF NOT EXISTS public.callups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  season_id UUID REFERENCES public.seasons(id),
  date TIMESTAMPTZ NOT NULL,
  location VARCHAR(255),
  address TEXT,
  selector_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'Borrador', -- Borrador, Planificada, Realizada, Cancelada
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convocatoria - Jugadores (Relación N a N)
CREATE TABLE IF NOT EXISTS public.callup_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  callup_id UUID REFERENCES public.callups(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'Convocado', -- Convocado, Confirmado, Asistió, No asistió, Justificado, Lesionado
  attendance BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(callup_id, player_id)
);

-- Sesiones de Entrenamiento
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  season_id UUID REFERENCES public.seasons(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location VARCHAR(255),
  field_name VARCHAR(255),
  selector_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  objective TEXT,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ejercicios de Entrenamiento
CREATE TABLE IF NOT EXISTS public.training_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  duration_minutes INT DEFAULT 15,
  player_count INT,
  space_dimensions VARCHAR(100),
  objective TEXT,
  description TEXT,
  equipment TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entrenamiento <-> Ejercicios
CREATE TABLE IF NOT EXISTS public.training_session_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES public.training_exercises(id) ON DELETE CASCADE,
  order_index INT DEFAULT 0,
  specific_notes TEXT
);

-- Asistencia a Entrenamiento
CREATE TABLE IF NOT EXISTS public.training_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'Convocado', -- Asistió, No asistió, Justificado, Lesionado
  attended BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);

-- Categorías de Criterios de Evaluación para Informes
CREATE TABLE IF NOT EXISTS public.report_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL, -- e.g. 'TECNICA', 'TACTICA', 'FISICA', 'ACTITUD'
  name VARCHAR(100) NOT NULL,
  scale_min INT DEFAULT 1,
  scale_max INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.report_categories (code, name) VALUES
  ('TECNICA', 'Técnica Individual y Control'),
  ('TACTICA', 'Inteligencia Táctica y Posicionamiento'),
  ('FISICA', 'Condición Física y Velocidad'),
  ('ACTITUD', 'Compromiso, Trabajo y Actitud')
ON CONFLICT (code) DO NOTHING;

-- Informes de Jugadores
CREATE TABLE IF NOT EXISTS public.player_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  selector_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  callup_id UUID REFERENCES public.callups(id) ON DELETE SET NULL,
  training_session_id UUID REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  report_date DATE DEFAULT CURRENT_DATE,
  technical_summary TEXT,
  tactical_summary TEXT,
  physical_summary TEXT,
  psychological_summary TEXT,
  general_notes TEXT,
  recommendation TEXT, -- Preseleccionable, En observación, Descartado
  scores JSONB DEFAULT '{}'::jsonb, -- { "TECNICA": 8, "TACTICA": 7, ... }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scraping Jobs & Logs
CREATE TABLE IF NOT EXISTS public.scraping_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(100) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending', -- pending, running, completed, failed
  records_processed INT DEFAULT 0,
  players_created INT DEFAULT 0,
  players_updated INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.scraping_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES public.scraping_jobs(id) ON DELETE CASCADE,
  log_level VARCHAR(20) DEFAULT 'info', -- info, warn, error
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs de Auditoría
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.callups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.callup_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS BÁSICAS
-- Administradores: Acceso Total
-- Usuarios autenticados: Lectura general y edición permitida para seleccionadores en sus entidades

DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
CREATE POLICY "Public profiles read" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins full access profiles" ON public.profiles;
CREATE POLICY "Admins full access profiles" ON public.profiles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  )
);

DROP POLICY IF EXISTS "Authenticated read players" ON public.players;
CREATE POLICY "Authenticated read players" ON public.players FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated update players" ON public.players;
CREATE POLICY "Authenticated update players" ON public.players FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read callups" ON public.callups;
CREATE POLICY "Authenticated read callups" ON public.callups FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated write callups" ON public.callups;
CREATE POLICY "Authenticated write callups" ON public.callups FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read matches" ON public.matches;
CREATE POLICY "Authenticated read matches" ON public.matches FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated write matches" ON public.matches;
CREATE POLICY "Authenticated write matches" ON public.matches FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read teams" ON public.teams;
CREATE POLICY "Authenticated read teams" ON public.teams FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated write teams" ON public.teams;
CREATE POLICY "Authenticated write teams" ON public.teams FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read training" ON public.training_sessions;
CREATE POLICY "Authenticated read training" ON public.training_sessions FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated write training" ON public.training_sessions;
CREATE POLICY "Authenticated write training" ON public.training_sessions FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read reports" ON public.player_reports;
CREATE POLICY "Authenticated read reports" ON public.player_reports FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated write reports" ON public.player_reports;
CREATE POLICY "Authenticated write reports" ON public.player_reports FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins full scraping" ON public.scraping_jobs;
CREATE POLICY "Admins full scraping" ON public.scraping_jobs FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins full logs" ON public.audit_logs;
CREATE POLICY "Admins full logs" ON public.audit_logs FOR ALL USING (auth.role() = 'authenticated');

