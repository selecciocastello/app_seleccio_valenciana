-- Migración: Políticas de acceso para la app
-- Permite lectura y escritura sin exigir sesión previa de Auth

-- 1. LECTURA (SELECT)
DROP POLICY IF EXISTS "Authenticated read players" ON public.players;
DROP POLICY IF EXISTS "Public read players" ON public.players;
CREATE POLICY "Public read players" ON public.players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated read teams" ON public.teams;
DROP POLICY IF EXISTS "Public read teams" ON public.teams;
CREATE POLICY "Public read teams" ON public.teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated read matches" ON public.matches;
DROP POLICY IF EXISTS "Public read matches" ON public.matches;
CREATE POLICY "Public read matches" ON public.matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated read callups" ON public.callups;
DROP POLICY IF EXISTS "Public read callups" ON public.callups;
CREATE POLICY "Public read callups" ON public.callups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated read training" ON public.training_sessions;
DROP POLICY IF EXISTS "Public read trainings" ON public.training_sessions;
CREATE POLICY "Public read trainings" ON public.training_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated read reports" ON public.player_reports;
DROP POLICY IF EXISTS "Public read reports" ON public.player_reports;
CREATE POLICY "Public read reports" ON public.player_reports FOR SELECT USING (true);

-- 2. ESCRITURA (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Authenticated update players" ON public.players;
DROP POLICY IF EXISTS "Public write players" ON public.players;
CREATE POLICY "Public write players" ON public.players FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated write callups" ON public.callups;
DROP POLICY IF EXISTS "Public write callups" ON public.callups;
CREATE POLICY "Public write callups" ON public.callups FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated write training" ON public.training_sessions;
DROP POLICY IF EXISTS "Public write trainings" ON public.training_sessions;
CREATE POLICY "Public write trainings" ON public.training_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated write reports" ON public.player_reports;
DROP POLICY IF EXISTS "Public write reports" ON public.player_reports;
CREATE POLICY "Public write reports" ON public.player_reports FOR ALL USING (true) WITH CHECK (true);
