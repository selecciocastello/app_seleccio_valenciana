-- Migración: triggers de updated_at y restricción de escrituras públicas

-- 1. updated_at automático en cada UPDATE (incluidos los upserts del scraper).
--    La app usa max(updated_at) como versión para decidir si su caché local sigue valiendo.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.players;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.teams;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.matches;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS players_updated_at_idx ON public.players (updated_at DESC);
CREATE INDEX IF NOT EXISTS teams_updated_at_idx ON public.teams (updated_at DESC);
CREATE INDEX IF NOT EXISTS matches_updated_at_idx ON public.matches (updated_at DESC);

-- 2. Jugadores: la app solo inserta y actualiza. Borrar queda reservado a la
--    service role (scripts), así nadie con la anon key puede vaciar la tabla.
DROP POLICY IF EXISTS "Public write players" ON public.players;
DROP POLICY IF EXISTS "Public insert players" ON public.players;
DROP POLICY IF EXISTS "Public update players" ON public.players;
CREATE POLICY "Public insert players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update players" ON public.players FOR UPDATE USING (true) WITH CHECK (true);

-- 3. Convocatorias, entrenamientos e informes: sin borrado anónimo
DROP POLICY IF EXISTS "Public write callups" ON public.callups;
DROP POLICY IF EXISTS "Public insert callups" ON public.callups;
DROP POLICY IF EXISTS "Public update callups" ON public.callups;
CREATE POLICY "Public insert callups" ON public.callups FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update callups" ON public.callups FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public write trainings" ON public.training_sessions;
DROP POLICY IF EXISTS "Public insert trainings" ON public.training_sessions;
DROP POLICY IF EXISTS "Public update trainings" ON public.training_sessions;
CREATE POLICY "Public insert trainings" ON public.training_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update trainings" ON public.training_sessions FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public write reports" ON public.player_reports;
DROP POLICY IF EXISTS "Public insert reports" ON public.player_reports;
DROP POLICY IF EXISTS "Public update reports" ON public.player_reports;
CREATE POLICY "Public insert reports" ON public.player_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update reports" ON public.player_reports FOR UPDATE USING (true) WITH CHECK (true);

-- La agenda de ojeo mantiene el borrado público porque la app permite quitar partidos de la agenda.
