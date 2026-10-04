/**
 * Partidos observados -> jugadores observados.
 *
 * Cuando un seleccionador marca un partido de la agenda como 'Observat', dos días después
 * de jugarse se lee el acta de la FFCV (ficha_partido_ajax.php?cod_partido={codacta}) y se
 * pasan a 'Observado' los jugadores de los equipos vistos que JUGARON el partido: titulares
 * y suplentes que entraron. Los convocados que no salieron no cuentan.
 *
 * Solo se promociona a quien está como 'Candidato': nunca se baja ni se cambia un estado
 * puesto por un seleccionador (Interesante, Preseleccionado...). Cada partido se procesa
 * una sola vez (scouting_agenda.lineup_processed_at).
 *
 * Uso:
 *   node scripts/process_observed_matches.cjs              procesa los pendientes
 *   node scripts/process_observed_matches.cjs --dry-run    muestra qué haría, sin escribir
 *   node scripts/process_observed_matches.cjs --codacta 26482437 [--teams "Equipo A,Equipo B"]
 *                                                          prueba un acta concreta (nunca escribe)
 */

const fs = require('fs');
const path = require('path');

if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}
const { createClient } = require('@supabase/supabase-js');

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const testCodacta = argValue('--codacta');
const testTeams = argValue('--teams');
const dryRun = args.includes('--dry-run') || Boolean(testCodacta);
const MIN_DAYS_AFTER_MATCH = parseInt(argValue('--min-days') || '2', 10);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FFCV_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://ffcv.es/competiciones/',
  'X-Requested-With': 'XMLHttpRequest'
};

function loadEnv() {
  const env = {};
  try {
    const content = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  } catch (e) {}
  return env;
}

const normalizeName = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

async function fetchActa(codacta) {
  const url = `https://ffcv.es/competiciones/api/partidos/ficha_partido_ajax.php?cod_partido=${encodeURIComponent(codacta)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: FFCV_HEADERS, signal: AbortSignal.timeout(30000) });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 60000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return null;
}

/** Jugadores que jugaron (titulares + suplentes que entraron) de cada equipo del acta. */
function playedBySide(acta) {
  const side = (players, subs) => {
    const entered = new Set((subs || []).map((s) => String(s.codjugador_entra)));
    const list = players || [];
    const played = list.filter((p) => String(p.titular) === '1' || entered.has(String(p.codjugador)));
    return {
      called: list.length,
      played: played.map((p) => ({ id: String(p.codjugador), name: p.nombre_jugador || p.nombre_visible, starter: String(p.titular) === '1' }))
    };
  };
  return {
    home: { team: acta.equipo_local, ...side(acta.jugadores_equipo_local, acta.sustituciones_equipo_local) },
    away: { team: acta.equipo_visitante, ...side(acta.jugadores_equipo_visitante, acta.sustituciones_equipo_visitante) }
  };
}

/** Lados del acta que corresponden a los equipos observados (todos si no se indicó ninguno). */
function observedSides(sides, observedTeams) {
  const wanted = (observedTeams || []).map(normalizeName).filter(Boolean);
  if (wanted.length === 0) return [sides.home, sides.away];
  return [sides.home, sides.away].filter((s) => wanted.includes(normalizeName(s.team)));
}

/** "26-09-2026" -> Date (UTC) */
function parseActaDate(fecha) {
  const m = String(fecha || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
}

/** Busca el codacta y la fecha del partido de un item de la agenda. */
async function resolveMatch(supabase, item) {
  const fromLocalId = String(item.match_id || '').match(/ffcv-acta-(\d+)/);
  if (fromLocalId) return { codacta: fromLocalId[1], date: item.scheduled_date };
  if (UUID_RE.test(item.match_id)) {
    const { data } = await supabase
      .from('matches')
      .select('codacta, source_match_id, match_date')
      .eq('id', item.match_id)
      .maybeSingle();
    if (data) return { codacta: data.codacta || data.source_match_id, date: data.match_date || item.scheduled_date };
  }
  return { codacta: null, date: item.scheduled_date };
}

/** Pasa a 'Observado' a los que están como 'Candidato'. Devuelve el detalle por jugador. */
async function promotePlayers(supabase, playedIds) {
  if (playedIds.length === 0) return { inDb: [], promoted: [] };
  const { data, error } = await supabase
    .from('players')
    .select('id, source_player_id, first_name, last_name, status')
    .eq('source', 'ffcv_scraping')
    .in('source_player_id', playedIds);
  if (error) throw new Error(`players: ${error.message}`);

  const inDb = data || [];
  const toPromote = inDb.filter((p) => !p.status || p.status === 'Candidato');
  if (!dryRun && toPromote.length > 0) {
    const { error: upErr } = await supabase
      .from('players')
      .update({ status: 'Observado' })
      .in('id', toPromote.map((p) => p.id))
      .or('status.is.null,status.eq.Candidato'); // por si alguien lo cambió mientras tanto
    if (upErr) throw new Error(`actualizando jugadores: ${upErr.message}`);
  }
  return { inDb, promoted: toPromote };
}

function printSides(sides) {
  for (const s of sides) {
    console.log(`   ⚽ ${s.team}: ${s.called} convocados, ${s.played.length} jugaron`);
    for (const p of s.played) console.log(`      - ${p.name} (${p.id})${p.starter ? '' : ' [entró de suplente]'}`);
  }
}

function printResult(result, playedIds) {
  const notInDb = playedIds.length - result.inDb.length;
  console.log(`   👥 ${result.inDb.length} de ${playedIds.length} están en nuestra base de datos${notInDb ? ` (${notInDb} no están en el censo)` : ''}`);
  for (const p of result.inDb) {
    const changes = result.promoted.includes(p);
    console.log(`      ${changes ? '➡️ ' : '⏸️ '} ${p.first_name} ${p.last_name}: ${p.status || 'Candidato'}${changes ? ' -> Observado' : ' (se mantiene)'}`);
  }
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  if (dryRun) console.log('🧪 Modo prueba: no se escribe nada en la base de datos.\n');

  // Prueba de un acta concreta, sin agenda
  if (testCodacta) {
    const acta = await fetchActa(testCodacta);
    if (!acta || String(acta.estado) !== '1') throw new Error('No se pudo leer el acta');
    console.log(`📄 ${acta.equipo_local} ${acta.goles_local}-${acta.goles_visitante} ${acta.equipo_visitante} (${acta.fecha}) · acta cerrada: ${acta.acta_cerrada === '1' || acta.acta_cerrada === 1 ? 'sí' : 'no'}`);
    const sides = observedSides(playedBySide(acta), testTeams ? testTeams.split(',') : []);
    printSides(sides);
    const playedIds = sides.flatMap((s) => s.played.map((p) => p.id));
    printResult(await promotePlayers(supabase, playedIds), playedIds);
    return;
  }

  const { data: pending, error } = await supabase
    .from('scouting_agenda')
    .select('id, match_id, selector_name, scheduled_date, home_team_name, away_team_name, observed_teams, lineup_processed_at')
    .eq('status', 'Observat')
    .is('lineup_processed_at', null);
  if (error) {
    if (/lineup_processed_at/.test(error.message)) {
      console.error('❌ Falta aplicar la migración supabase/migrations/20261004000009_agenda_lineup_processing.sql');
    } else {
      console.error('❌ Error leyendo la agenda:', error.message);
    }
    process.exit(1);
  }

  console.log(`📋 ${pending.length} partidos observados pendientes de procesar.`);
  const today = new Date();
  let processed = 0;
  let totalPromoted = 0;

  for (const item of pending) {
    const label = `${item.home_team_name} vs ${item.away_team_name} (${item.selector_name})`;
    console.log(`\n🔎 ${label}`);
    try {
      const { codacta, date } = await resolveMatch(supabase, item);
      if (!codacta) {
        console.log('   ⏭️ Sin código de acta todavía. Se reintentará.');
        continue;
      }
      const matchDay = date ? new Date(`${String(date).slice(0, 10)}T00:00:00Z`) : null;
      if (matchDay && (today - matchDay) / 86400000 < MIN_DAYS_AFTER_MATCH) {
        console.log(`   ⏳ Se jugó/juega el ${String(date).slice(0, 10)}: se procesará pasados ${MIN_DAYS_AFTER_MATCH} días.`);
        continue;
      }

      const acta = await fetchActa(codacta);
      if (!acta || String(acta.estado) !== '1') {
        console.log('   ⚠️ No se pudo leer el acta. Se reintentará.');
        continue;
      }
      const actaDay = parseActaDate(acta.fecha);
      if (actaDay && (today - actaDay) / 86400000 < MIN_DAYS_AFTER_MATCH) {
        console.log(`   ⏳ El acta indica fecha ${acta.fecha}: se procesará pasados ${MIN_DAYS_AFTER_MATCH} días.`);
        continue;
      }

      let playedIds = [];
      if (String(acta.suspendido) === '1') {
        console.log('   🚫 Partido suspendido: no se marca a nadie.');
      } else if (String(acta.acta_cerrada) !== '1') {
        console.log('   ⏳ El acta aún no está cerrada. Se reintentará.');
        continue;
      } else {
        const sides = observedSides(playedBySide(acta), item.observed_teams);
        printSides(sides);
        playedIds = sides.flatMap((s) => s.played.map((p) => p.id));
        const result = await promotePlayers(supabase, playedIds);
        printResult(result, playedIds);
        totalPromoted += result.promoted.length;
      }

      if (!dryRun) {
        const { error: agErr } = await supabase
          .from('scouting_agenda')
          .update({ lineup_processed_at: new Date().toISOString(), played_player_ids: playedIds })
          .eq('id', item.id);
        if (agErr) throw new Error(`marcando la agenda: ${agErr.message}`);
      }
      processed++;
    } catch (err) {
      console.warn(`   ⚠️ Error: ${err.message}. Se reintentará.`);
    }
  }

  console.log(`\n✅ ${processed} partidos procesados, ${totalPromoted} jugadores ${dryRun ? 'pasarían' : 'pasados'} a Observado.`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exitCode = 1;
});
