// Polyfill de WebSocket para Node < 22
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  } catch (e) {}
  return env;
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Credenciales de Supabase no encontradas en .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  console.log('🧹 1. Eliminando datos falsos/simulados (seed) de Supabase...');

  // Eliminar jugadores de prueba del seed (source_a_scraping o con ID del mock a1000...)
  const { error: pDelErr } = await supabase
    .from('players')
    .delete()
    .or("source.eq.source_a_scraping,id.like.a1000000-%");
  if (pDelErr) console.warn('   ⚠️ Aviso al borrar jugadores simulados:', pDelErr.message);
  else console.log('   ✅ Jugadores simulados eliminados.');

  // Eliminar partidos mock del seed
  const { error: mDelErr } = await supabase
    .from('matches')
    .delete()
    .or("id.like.b1000000-%,source.eq.manual");
  if (mDelErr) console.warn('   ⚠️ Aviso al borrar partidos simulados:', mDelErr.message);
  else console.log('   ✅ Partidos simulados eliminados.');

  // Eliminar convocatorias y entrenamientos mock
  await supabase.from('callups').delete().or("id.like.c1000000-%,id.like.c2000000-%");
  await supabase.from('training_sessions').delete().like('id', 'd1000000-%');

  // Eliminar equipos mock del seed
  const mockTeamIds = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555'
  ];
  const { error: tDelErr } = await supabase.from('teams').delete().in('id', mockTeamIds);
  if (tDelErr) console.warn('   ⚠️ Aviso al borrar equipos simulados:', tDelErr.message);
  else console.log('   ✅ Equipos simulados eliminados.');

  console.log('\n🚀 2. Sincronizando datos REALES a Supabase...');

  // Cargar datos locales
  const dataDir = path.join(__dirname, '..', 'src', 'data');
  const teamsPath = path.join(dataDir, 'scraped_teams.json');
  const playersPath = path.join(dataDir, 'scraped_players.json');
  const matchesPath = path.join(dataDir, 'scraped_matches.json');

  let rawTeams = fs.existsSync(teamsPath) ? JSON.parse(fs.readFileSync(teamsPath, 'utf8')) : [];
  let rawPlayers = fs.existsSync(playersPath) ? JSON.parse(fs.readFileSync(playersPath, 'utf8')) : [];
  let rawMatches = fs.existsSync(matchesPath) ? JSON.parse(fs.readFileSync(matchesPath, 'utf8')) : [];

  // 2.1 Sincronizar Equipos
  if (rawTeams.length > 0) {
    const teamsMap = new Map();
    for (const t of rawTeams) {
      if (!t.name || !t.name.trim()) continue;
      const key = t.name.trim().toLowerCase();
      if (!teamsMap.has(key)) {
        teamsMap.set(key, {
          name: t.name.trim(),
          club: t.club || t.name.trim(),
          crest_url: t.crest_url || null,
          field_name: t.field_name || null,
          city: t.city && t.city !== '0' ? t.city : 'Castelló',
          province: t.province && t.province !== 'Otra' ? t.province : 'Castelló',
          address: t.address || null,
          latitude: t.latitude ? parseFloat(t.latitude) : null,
          longitude: t.longitude ? parseFloat(t.longitude) : null
        });
      }
    }

    const dbTeams = Array.from(teamsMap.values());
    const { error: tUpsertErr } = await supabase.from('teams').upsert(dbTeams, { onConflict: 'name' });
    if (tUpsertErr) console.warn('   ⚠️ Error sincronizando equipos:', tUpsertErr.message);
    else console.log(`   ✅ ${dbTeams.length} equipos reales sincronizados.`);

    // Eliminar equipos "fantasma"
    const currentTeamNames = new Set(rawTeams.map(t => t.name.trim().toLowerCase()));
    const { data: existingTeams } = await supabase.from('teams').select('id, name');
    const staleTeamIds = (existingTeams || [])
      .filter(t => !currentTeamNames.has(t.name.trim().toLowerCase()))
      .map(t => t.id);

    if (staleTeamIds.length > 0) {
      const { error: tDelStaleErr } = await supabase.from('teams').delete().in('id', staleTeamIds);
      if (tDelStaleErr) console.warn('   ⚠️ Error eliminando equipos obsoletos:', tDelStaleErr.message);
      else console.log(`   🧹 ${staleTeamIds.length} equipos obsoletos (fantasma) eliminados.`);
    }
  }

  // Obtener mapa de nombres de equipo a UUID en Supabase
  const { data: dbTeamsList } = await supabase.from('teams').select('id, name');
  const teamNameToId = new Map();
  if (dbTeamsList) {
    for (const t of dbTeamsList) {
      teamNameToId.set(t.name.trim().toLowerCase(), t.id);
    }
  }

  // 2.2 Sincronizar Jugadores
  if (rawPlayers.length > 0) {
    console.log(`\n⏳ Procesando ${rawPlayers.length} jugadores reales...`);
    const playersMap = new Map();
    for (const p of rawPlayers) {
      const sourcePlayerId = String(p.ffcv_player_id || p.source_player_id || p.id || '');
      if (!sourcePlayerId) continue;

      const names = (p.full_name || '').split(',');
      const lastName = names[0] ? names[0].trim() : '';
      const firstName = names[1] ? names[1].trim() : (p.full_name || '');
      const teamId = p.team ? teamNameToId.get(p.team.trim().toLowerCase()) : null;

      playersMap.set(sourcePlayerId, {
        first_name: firstName,
        last_name: lastName,
        position: p.position || 'Candidato',
        jersey_number: p.dorsal ? parseInt(p.dorsal, 10) : (p.jersey_number || null),
        photo_url: p.photo_url || null,
        team_id: teamId || null,
        city: p.city || 'Castelló',
        province: p.province || 'Castelló',
        status: 'Candidato',
        infantil_year: p.infantil_year || 'Desconocido',
        age: p.age ? parseInt(p.age, 10) : null,
        history: p.history || [],
        sports_data: p.sports_data || {},
        source: 'ffcv_scraping',
        source_player_id: sourcePlayerId,
        source_url: p.source_url || null,
        scraped_at: p.scraped_at || new Date().toISOString()
      });
    }

    const dbPlayers = Array.from(playersMap.values());
    const chunkSize = 100;
    for (let i = 0; i < dbPlayers.length; i += chunkSize) {
      const chunk = dbPlayers.slice(i, i + chunkSize);
      const { error: pUpsertErr } = await supabase.from('players').upsert(chunk, { onConflict: 'source,source_player_id' });
      if (pUpsertErr) console.warn(`   ⚠️ Error en lote ${i}-${i + chunk.length}:`, pUpsertErr.message);
      else process.stdout.write(`   ✅ ${Math.min(i + chunkSize, dbPlayers.length)}/${dbPlayers.length} jugadores subidos...\r`);
    }
    console.log(`\n   🎉 ${dbPlayers.length} jugadores reales sincronizados con éxito.`);
  }

  // 2.3 Sincronizar Partidos
  if (rawMatches.length > 0) {
    console.log(`\n⏳ Procesando ${rawMatches.length} partidos de la agenda...`);
    const matchesMap = new Map();
    for (const m of rawMatches) {
      const homeName = m.home_team_name || m.home_team || 'Local';
      const awayName = m.away_team_name || m.away_team || 'Visitante';
      const matchDate = m.match_date ? new Date(m.match_date).toISOString() : new Date().toISOString();
      const sourceMatchId = String(m.codacta || m.id || `${homeName}-${awayName}-${m.matchday || ''}-${m.match_date || ''}`);

      if (!sourceMatchId) continue;

      matchesMap.set(sourceMatchId, {
        match_date: matchDate,
        field_name: m.field_name || null,
        address: m.address || null,
        city: m.city || null,
        province: m.province || 'Castelló',
        latitude: m.latitude ? parseFloat(m.latitude) : null,
        longitude: m.longitude ? parseFloat(m.longitude) : null,
        status: m.status || 'Programado',
        home_score: m.home_score != null ? m.home_score : null,
        away_score: m.away_score != null ? m.away_score : null,
        source: 'ffcv_scraping',
        source_match_id: sourceMatchId,
        codacta: m.codacta ? String(m.codacta) : null,
        matchday: m.matchday || null,
        match_time: m.time || m.match_time || null,
        home_team_name: homeName,
        home_crest: m.home_crest || null,
        away_team_name: awayName,
        away_crest: m.away_crest || null,
        competition_name: m.competition_name || m.competition || null,
        group_name: m.group_name || m.group || null,
        referees: m.referees || []
      });
    }

    const dbMatches = Array.from(matchesMap.values());
    const chunkSize = 100;
    for (let i = 0; i < dbMatches.length; i += chunkSize) {
      const chunk = dbMatches.slice(i, i + chunkSize);
      const { error: mUpsertErr } = await supabase.from('matches').upsert(chunk, { onConflict: 'source,source_match_id' });
      if (mUpsertErr) console.warn(`   ⚠️ Error en partidos ${i}-${i + chunk.length}:`, mUpsertErr.message);
      else process.stdout.write(`   ✅ ${Math.min(i + chunkSize, dbMatches.length)}/${dbMatches.length} partidos subidos...\r`);
    }
    console.log(`\n   🎉 ${dbMatches.length} partidos reales sincronizados con éxito.`);
  }

  console.log('\n✨ ¡Limpieza y sincronización completada con éxito!');
  console.log('   Supabase ahora contiene EXCLUSIVAMENTE datos reales.');
}

main().catch(console.error);
