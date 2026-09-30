#!/usr/bin/env node
/**
 * Scraping FFCV Infantil - Partidos, Equipos, Campos y Jugadores con Historial
 * 
 * Competiciones:
 *  - Lliga Preferent Infantil (905431907): Grup - 1 (905431908)
 *  - Primera Infantil (905431912): Grup - 1 (905431913), Grup - 2 (905431914)
 *  - Segona Infantil: Grup - 1 a 4 (detección automática cuando se publique)
 * 
 * Uso:
 *   node scripts/scrape_ffcv_infantil.cjs [opciones]
 * 
 * Opciones:
 *   --matches-only        Solo raspar agenda y partidos
 *   --players-only        Solo raspar plantillas, jugadores e historial
 *   --limit-teams <n>     Limitar número de equipos por grupo para pruebas
 *   --limit-players <n>   Limitar número de jugadores por equipo para pruebas
 *
 * Todos los datos se obtienen de la API JSON pública de ffcv.es (la misma que usa
 * su web), sin navegador. La FFCV limita a ~240 peticiones/minuto por IP (HTTP 429
 * con retry_after), así que todas las peticiones pasan por un limitador global.
 */

const fs = require('fs');
const path = require('path');
const { toPhotoUrl } = require('./player_photos.cjs');

// Configuración de competiciones solicitadas: Preferente, 1ª Regional y 2ª Regional
const TARGET_TEMPORADA = '22'; // 2026-2027
const TARGET_SEASON_START_YEAR = 2026;

const TARGET_COMPETITIONS = [
  {
    id: '905431907',
    name: 'Lliga Preferent Infantil',
    groups: [
      { id: '905431908', name: 'Grup - 1' }
    ]
  },
  {
    id: '905431912',
    name: 'Primera Infantil',
    groups: [
      { id: '905431913', name: 'Grup - 1' },
      { id: '905431914', name: 'Grup - 2' }
    ]
  }
];

// Opciones CLI
const args = process.argv.slice(2);
const matchesOnly = args.includes('--matches-only');
const playersOnly = args.includes('--players-only');
const limitTeamsIdx = args.indexOf('--limit-teams');
const limitTeams = limitTeamsIdx !== -1 ? parseInt(args[limitTeamsIdx + 1], 10) : Infinity;
const limitPlayersIdx = args.indexOf('--limit-players');
const limitPlayers = limitPlayersIdx !== -1 ? parseInt(args[limitPlayersIdx + 1], 10) : Infinity;

// ── Cliente HTTP de la API FFCV con límite de peticiones ─────────────────────
const FFCV_API_BASE = 'https://ffcv.es/competiciones/api';
const MIN_REQUEST_INTERVAL_MS = 300; // ~200 peticiones/minuto, por debajo del límite de la FFCV
const FFCV_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://ffcv.es/competiciones/',
  'X-Requested-With': 'XMLHttpRequest'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let nextRequestAt = 0;

async function acquireRequestSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextRequestAt);
  nextRequestAt = slot + MIN_REQUEST_INTERVAL_MS;
  if (slot > now) await sleep(slot - now);
}

/**
 * GET a la API de la FFCV. Devuelve el JSON o null si falla tras los reintentos.
 * Ante un 429 pausa todas las peticiones el tiempo que indique retry_after.
 */
async function ffcvFetch(endpoint, maxRetries = 5) {
  const url = `${FFCV_API_BASE}/${endpoint}`;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await acquireRequestSlot();
    try {
      const res = await fetch(url, { headers: FFCV_HEADERS, signal: AbortSignal.timeout(20000) });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const waitSecs = (parseInt(body.retry_after, 10) || 60) + 2;
        console.warn(`        ⏳ Límite de peticiones FFCV alcanzado. Esperando ${waitSecs}s...`);
        nextRequestAt = Math.max(nextRequestAt, Date.now() + waitSecs * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt >= maxRetries) {
        console.warn(`        ⚠️ Error definitivo en ${endpoint}: ${err.message}`);
        return null;
      }
      await sleep(1000 * attempt);
    }
  }
  return null;
}

/** Ejecuta fn sobre cada elemento con como máximo `concurrency` tareas simultáneas, preservando el orden. */
async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

function formatLogoUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `https://appwebffcv.novanet.es${s}`;
  return `https://appwebffcv.novanet.es/${s}`;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const m = s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function parseTime(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}:00`;
}

/**
 * Comprueba si una categoría corresponde estrictamente a "Alevín 1er. Año" / "Aleví 1r Any"
 */
function isAlevin1erAno(categoria) {
  if (!categoria) return false;
  const cat = categoria.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const isAlevin = cat.includes('alevin') || cat.includes('alevi');
  if (!isAlevin) return false;

  const is1st =
    cat.includes('1er') ||
    cat.includes('1r') ||
    cat.includes('primer') ||
    cat.includes('1.er') ||
    /alevi[n]?\s*(de\s*)?1[ºªer\.]*\s*a[nñ]o/i.test(cat) ||
    /alevi[n]?\s*(de\s*)?1[r\.]*\s*any/i.test(cat);

  const is2nd =
    cat.includes('2o') ||
    cat.includes('2n') ||
    cat.includes('segund') ||
    cat.includes('2º') ||
    cat.includes('2.');

  return is1st && !is2nd;
}

/**
 * Comprueba si una categoría corresponde a "Alevín 2º. Año" o Aleví genérico (no 1er año)
 */
function isAlevin2oAno(categoria) {
  if (!categoria) return false;
  const cat = categoria.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const isAlevin = cat.includes('alevin') || cat.includes('alevi');
  if (!isAlevin) return false;

  const is2nd =
    cat.includes('2o') ||
    cat.includes('2n') ||
    cat.includes('segund') ||
    cat.includes('2º') ||
    cat.includes('2.') ||
    /alevi[n]?\s*(de\s*)?2[ºªo\.]*\s*a[nñ]o/i.test(cat) ||
    /alevi[n]?\s*(de\s*)?2[n\.]*\s*any/i.test(cat);

  const is1st =
    cat.includes('1er') ||
    cat.includes('1r') ||
    cat.includes('primer') ||
    cat.includes('1.er');

  return is2nd || !is1st;
}

/**
 * Determina si un jugador es "Infantil 1er año", "Infantil 2º año" o "Alevín 2º año"
 * según las reglas federativas:
 *
 * 1. Año de nacimiento (norma federativa, temporada 2026-2027):
 *    - 2013 o anterior -> Infantil 2º año
 *    - 2014 -> Infantil 1er año
 *    - 2015 o posterior -> Alevín 2º año
 *    El historial NO manda: su categoría es la del equipo en el que jugó, no la
 *    del jugador (p. ej. un nacido en 2013 que repitió en un Alevín 1er año).
 * 2. Solo si no hay año de nacimiento, por historial:
 *    - 25-26 "Alevín 1er. Año" -> Alevín 2º año
 *    - 25-26 "Alevín 2º. Año" (o Alevín genérico) o 24-25 "Alevín 1er. Año" -> Infantil 1er año
 *    - 25-26 en Infantil o Cadete -> Infantil 2º año
 * 3. Por edad: <= 11 -> Alevín 2º año, 12 -> Infantil 1er año, >= 13 -> Infantil 2º año
 */
function calculateInfantilYear(history, age, birthYear) {
  if (typeof birthYear === 'number' && !isNaN(birthYear)) {
    const infantil2Year = TARGET_SEASON_START_YEAR - 13;
    if (birthYear <= infantil2Year) return 'Infantil 2º año';
    if (birthYear === infantil2Year + 1) return 'Infantil 1er año';
    return 'Alevín 2º año';
  }

  if (history && Array.isArray(history) && history.length > 0) {
    const season2425 = history.find((h) => {
      const t = (h.temporada || '').toLowerCase().replace(/\s+/g, '');
      return t.startsWith('2024-2025') || t.startsWith('24-25') || t.startsWith('2024/2025');
    });

    const season2526 = history.find((h) => {
      const t = (h.temporada || '').toLowerCase().replace(/\s+/g, '');
      return t.startsWith('2025-2026') || t.startsWith('25-26') || t.startsWith('2025/2026');
    });

    // 1. Si en la temporada 2025-2026 era Alevín 1er año -> actualmente es Alevín 2º año
    if (season2526 && isAlevin1erAno(season2526.categoria)) {
      return 'Alevín 2º año';
    }

    // 2. Infantil 1er año:
    // - Si en 25-26 era Alevín 2º año (o Alevín genérico)
    // - O si en 24-25 era Alevín 1er año
    if (season2526 && isAlevin2oAno(season2526.categoria)) {
      return 'Infantil 1er año';
    }
    if (season2425 && isAlevin1erAno(season2425.categoria)) {
      return 'Infantil 1er año';
    }

    // 3. Infantil 2º año:
    // - Si en 25-26 ya militaba en Infantil o Cadete
    if (season2526) {
      const cat2526 = (season2526.categoria || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
      if (cat2526.includes('infantil') || cat2526.includes('cadet')) {
        return 'Infantil 2º año';
      }
    }
  }

  if (typeof age === 'number' && !isNaN(age)) {
    if (age <= 11) return 'Alevín 2º año';
    if (age === 12) return 'Infantil 1er año';
    if (age >= 13) return 'Infantil 2º año';
  }

  return 'Desconocido';
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Parsea el nombre de un jugador según el formato de la FFCV:
 * 1. Si contiene coma (ej: "RUIZ GAMEZ, GERARD"):
 *    - Apellidos = antes de la coma ("RUIZ GAMEZ")
 *    - Nombre = después de la coma ("GERARD")
 * 2. Si NO contiene coma (ej: "FERRAN TRONCHO" o "FERRAN TRONCHO BARRERA"):
 *    - Nombre (first name) = primera palabra ("FERRAN")
 *    - Apellidos (last name) = segunda, tercera y siguientes palabras ("TRONCHO" o "TRONCHO BARRERA")
 */
function parsePlayerName(rawName) {
  if (!rawName) return { firstName: 'Jugador', lastName: '', fullName: 'Jugador' };
  const str = String(rawName).trim();
  if (str.includes(',')) {
    const parts = str.split(',');
    const lastName = parts[0].trim();
    const firstName = parts.slice(1).join(' ').trim();
    const finalFirst = firstName || lastName;
    const finalLast = firstName ? lastName : '';
    const fullName = `${finalFirst} ${finalLast}`.trim();
    return { firstName: finalFirst, lastName: finalLast, fullName };
  } else {
    const words = str.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      return { firstName: str, lastName: '', fullName: str };
    }
    const firstName = words[0];
    const lastName = words.slice(1).join(' ');
    const fullName = `${firstName} ${lastName}`.trim();
    return { firstName, lastName, fullName };
  }
}

// Cargar .env si existe
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

// Polyfill de WebSocket para Node < 22 en @supabase/supabase-js
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

/**
 * Devuelve Map<source_player_id, position> de los jugadores cuya posición ha editado
 * un seleccionador (position_manual = true). La posición alternativa no hace falta
 * protegerla: el scraper nunca la envía, así que el upsert no la toca.
 * Si la columna aún no existe (migración sin aplicar), conserva cualquier posición
 * que no venga del scraper, para no perder ediciones.
 */
async function fetchManualPositions(supabase) {
  const result = new Map();
  const pageSize = 1000;
  let useFallback = false;

  for (let from = 0; ; from += pageSize) {
    let query = supabase.from('players').select(useFallback ? 'source_player_id, position' : 'source_player_id, position, position_manual')
      .eq('source', 'ffcv_scraping')
      .range(from, from + pageSize - 1);
    if (!useFallback) query = query.eq('position_manual', true);

    const { data, error } = await query;
    if (error) {
      if (!useFallback && /position_manual/.test(error.message || '')) {
        console.warn('   ⚠️ Falta la columna players.position_manual (aplica la migración 20260930000008). Se conservan todas las posiciones existentes.');
        useFallback = true;
        from = -pageSize;
        continue;
      }
      throw new Error(`No se pudieron leer las posiciones manuales: ${error.message}`);
    }

    for (const row of data || []) {
      if (!row.source_player_id || !row.position) continue;
      if (useFallback && ['Sense definir', 'Candidato'].includes(row.position)) continue;
      result.set(String(row.source_player_id), row.position);
    }
    if (!data || data.length < pageSize) break;
  }
  return result;
}

/** Lee todas las filas de una tabla paginando de 1000 en 1000. Lanza si hay error. */
async function selectAll(supabase, table, columns, filter = (q) => q) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await filter(supabase.from(table).select(columns)).range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

/**
 * Un jugador está protegido si un seleccionador ha trabajado con él: estado distinto
 * de Candidato, posición/valoración/notas/contacto editados, o vinculado a informes,
 * convocatorias o entrenamientos. Los protegidos nunca se borran.
 */
function isProtectedPlayer(p, linkedIds) {
  const filled = (v) => v != null && String(v).trim() !== '';
  return (
    (filled(p.status) && p.status !== 'Candidato') ||
    p.position_manual === true ||
    filled(p.secondary_position) ||
    (p.rating || 0) > 0 ||
    filled(p.notes) ||
    filled(p.phone) ||
    filled(p.email) ||
    filled(p.guardian_name) ||
    filled(p.guardian_phone) ||
    filled(p.guardian_email) ||
    filled(p.dominant_foot) ||
    linkedIds.has(p.id)
  );
}

/**
 * Jugadores de la BD que ya no aparecen en ninguna plantilla raspada:
 *  - protegidos: se actualizan con su ficha actual de la FFCV (equipo, dorsal, foto,
 *    historial...) sin tocar lo editado; si su equipo no está en nuestras competiciones
 *    quedan marcados como is_stale.
 *  - el resto: se borran.
 * Solo se llama tras una descarga completa y sin errores.
 */
async function reconcileStalePlayers(supabase, scrapedIds, teamNameToId) {
  console.log('\n🧹 Revisando jugadores que ya no están en ninguna plantilla...');
  let dbPlayers;
  const linkedIds = new Set();
  try {
    dbPlayers = await selectAll(
      supabase,
      'players',
      'id, source_player_id, first_name, last_name, status, position_manual, secondary_position, rating, notes, phone, email, guardian_name, guardian_phone, guardian_email, dominant_foot',
      (q) => q.eq('source', 'ffcv_scraping')
    );
    for (const table of ['player_reports', 'callup_players', 'training_attendance']) {
      for (const row of await selectAll(supabase, table, 'player_id')) {
        if (row.player_id) linkedIds.add(row.player_id);
      }
    }
  } catch (err) {
    console.warn(`   ⚠️ No se pudo leer el estado de los jugadores (${err.message}). No se borra ni actualiza nada.`);
    return;
  }

  const stale = dbPlayers.filter((p) => !scrapedIds.has(String(p.source_player_id)));
  if (stale.length === 0) {
    console.log('   ✅ No hay jugadores antiguos.');
    return;
  }
  // Salvaguarda: si "desaparece" más del 30% algo ha ido mal en la descarga
  if (stale.length > dbPlayers.length * 0.3) {
    console.warn(`   ⚠️ ${stale.length} de ${dbPlayers.length} jugadores no aparecen en las plantillas. Parece un error de descarga: no se borra nada.`);
    return;
  }

  const toKeep = stale.filter((p) => isProtectedPlayer(p, linkedIds));
  const toDelete = stale.filter((p) => !isProtectedPlayer(p, linkedIds));

  // Actualizar protegidos con su ficha actual
  let moved = 0;
  let markedStale = 0;
  for (const p of toKeep) {
    const cod = encodeURIComponent(p.source_player_id);
    const temp = encodeURIComponent(TARGET_TEMPORADA);
    const playerApi = await ffcvFetch(`jugadores/jugador_api.php?codigo=${cod}&cod_temporada=${temp}`);
    const historyApi = await ffcvFetch(`jugadores/historial_deportivo.php?cod_licencia=${cod}&cod_temporada=${temp}`);
    const hasProfile = isValidProfile(playerApi);

    const update = { is_stale: true, scraped_at: new Date().toISOString() };
    if (hasProfile) {
      const history = buildHistory(historyApi);
      const age = parseInt(playerApi.edad, 10);
      const teamId = teamNameToId.get(String(playerApi.equipo || '').trim().toLowerCase()) || null;
      Object.assign(update, {
        jersey_number: parseDorsal(playerApi.dorsal_jugador),
        photo_url: toPhotoUrl(playerApi.foto, p.source_player_id),
        age: isNaN(age) ? null : age,
        sports_data: buildStats(playerApi),
        infantil_year: calculateInfantilYear(history, isNaN(age) ? null : age, parseBirthYear(playerApi, historyApi)),
        is_stale: !teamId
      });
      if (history.length > 0) update.history = history;
      if (teamId) update.team_id = teamId;
      const position = normalizePosition(playerApi.posicion_jugador);
      if (!p.position_manual && position) update.position = position;
    }

    const { error } = await supabase.from('players').update(update).eq('id', p.id);
    if (error) {
      console.warn(`   ⚠️ Error actualizando ${p.first_name} ${p.last_name}: ${error.message}`);
      continue;
    }
    if (update.is_stale) markedStale++;
    else moved++;
    console.log(`   🔒 ${p.first_name} ${p.last_name} (protegido) -> ${update.is_stale ? `no vigente${hasProfile ? ` (${playerApi.equipo})` : ''}` : playerApi.equipo}`);
  }

  // Borrar el resto
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 100) {
    const ids = toDelete.slice(i, i + 100).map((p) => p.id);
    const { error } = await supabase.from('players').delete().in('id', ids);
    if (error) console.warn(`   ⚠️ Error borrando jugadores antiguos: ${error.message}`);
    else deleted += ids.length;
  }

  console.log(`   ✅ ${stale.length} jugadores antiguos: ${moved} protegidos actualizados a su equipo actual, ${markedStale} protegidos marcados como no vigentes, ${deleted} borrados.`);
}

// Intentar guardar en Supabase si está disponible
async function trySaveToSupabase(matches, teams, players, { playersComplete = false } = {}) {
  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-supabase')) {
    console.log('ℹ️  Supabase no configurado en .env (se omite la sincronización remota a BD).');
    return;
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    console.log('\n📡 Sincronizando con Supabase...');

    // 1. Upsert Teams (Deduplicados por nombre)
    if (teams && teams.length > 0) {
      const teamsMap = new Map();
      for (const t of teams) {
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
      const chunkSize = 100;
      let tSuccess = 0;
      for (let i = 0; i < dbTeams.length; i += chunkSize) {
        const chunk = dbTeams.slice(i, i + chunkSize);
        const { error: tErr } = await supabase.from('teams').upsert(chunk, { onConflict: 'name' });
        if (tErr) console.warn(`   ⚠️ Error sincronizando lote de equipos (${i}-${i + chunk.length}):`, tErr.message);
        else tSuccess += chunk.length;
      }
      console.log(`   ✅ ${tSuccess}/${dbTeams.length} equipos sincronizados en Supabase.`);
    }

    // 2. Upsert Matches (Deduplicados por source_match_id)
    if (matches && matches.length > 0) {
      const matchesMap = new Map();
      for (const m of matches) {
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
      let mSuccess = 0;
      for (let i = 0; i < dbMatches.length; i += chunkSize) {
        const chunk = dbMatches.slice(i, i + chunkSize);
        const { error: mErr } = await supabase.from('matches').upsert(chunk, { onConflict: 'source,source_match_id' });
        if (mErr) console.warn(`   ⚠️ Error sincronizando lote de partidos (${i}-${i + chunk.length}):`, mErr.message);
        else mSuccess += chunk.length;
      }
      console.log(`   ✅ ${mSuccess}/${dbMatches.length} partidos sincronizados en Supabase.`);
    }

    // 3. Upsert Players (Deduplicados por source_player_id)
    if (players && players.length > 0) {
      const { data: dbTeamsList } = await supabase.from('teams').select('id, name');
      const teamNameToId = new Map();
      if (dbTeamsList) {
        for (const t of dbTeamsList) {
          if (t.name) teamNameToId.set(t.name.trim().toLowerCase(), t.id);
        }
      }

      // Posiciones editadas a mano por un seleccionador: se conservan las de la BD
      const manualPositions = await fetchManualPositions(supabase);
      let preservedCount = 0;

      const playersMap = new Map();
      for (const p of players) {
        const sourcePlayerId = String(p.ffcv_player_id || p.source_player_id || p.id || '');
        if (!sourcePlayerId) continue;

        const { firstName, lastName } = parsePlayerName(p.full_name);
        const teamKey = (p.team || '').trim().toLowerCase();
        const teamId = teamNameToId.get(teamKey) || null;

        let cleanJersey = null;
        if (p.dorsal != null && p.dorsal !== '') {
          const num = parseInt(p.dorsal, 10);
          if (!isNaN(num) && num > 0 && num <= 99) {
            cleanJersey = num;
          }
        }

        let position = p.position || 'Candidato';
        if (manualPositions.has(sourcePlayerId)) {
          position = manualPositions.get(sourcePlayerId);
          preservedCount++;
        }

        playersMap.set(sourcePlayerId, {
          first_name: firstName,
          last_name: lastName,
          position,
          jersey_number: cleanJersey,
          photo_url: toPhotoUrl(p.photo_url, sourcePlayerId),
          team_id: teamId,
          city: p.city || 'Castelló',
          province: p.province || 'Castelló',
          // status no se envía: lo gestionan los seleccionadores (en altas nuevas la BD pone 'Candidato')
          is_stale: false,
          sports_data: p.sports_data || {},
          source: 'ffcv_scraping',
          source_player_id: sourcePlayerId,
          source_url: p.source_url || null,
          infantil_year: p.infantil_year || 'Desconocido',
          age: p.age ? parseInt(p.age, 10) : null,
          history: p.history || [],
          scraped_at: p.scraped_at || new Date().toISOString()
        });
      }
      const dbPlayers = Array.from(playersMap.values());
      const chunkSize = 100;
      let pSuccess = 0;
      for (let i = 0; i < dbPlayers.length; i += chunkSize) {
        const chunk = dbPlayers.slice(i, i + chunkSize);
        const { error: pErr } = await supabase.from('players').upsert(chunk, { onConflict: 'source,source_player_id' });
        if (pErr) console.warn(`   ⚠️ Error sincronizando lote de jugadores (${i}-${i + chunk.length}):`, pErr.message);
        else pSuccess += chunk.length;
      }
      console.log(`   ✅ ${pSuccess}/${dbPlayers.length} jugadores sincronizados en Supabase.`);
      console.log(`   🔒 ${preservedCount} posiciones editadas a mano conservadas.`);

      if (!playersComplete) {
        console.log('   ℹ️  Descarga de plantillas incompleta o limitada: no se revisan jugadores antiguos.');
      } else if (pSuccess < dbPlayers.length) {
        console.warn('   ⚠️ Hubo errores sincronizando jugadores: no se revisan jugadores antiguos.');
      } else {
        await reconcileStalePlayers(supabase, new Set(playersMap.keys()), teamNameToId);
      }
    }
  } catch (err) {
    console.warn('   ⚠️ Error conectando con Supabase:', err.message);
  }
}

// Posiciones de la FFCV -> posiciones canónicas de la app (PLAYER_POSITIONS en src/types/models.ts)
const POSITION_MAP = {
  'portero': 'Portero',
  'portera': 'Portero',
  'portero/a': 'Portero',
  'central': 'Defensa Central',
  'defensa': 'Defensa Central',
  'defensa central': 'Defensa Central',
  'lateral derecho': 'Lateral Derecho',
  'lateral izquierdo': 'Lateral Izquierdo',
  'carrilero derecho': 'Carrilero Derecho',
  'carrilero izquierdo': 'Carrilero Izquierdo',
  'pivote': 'Pivote Defensivo',
  'pivote defensivo': 'Pivote Defensivo',
  'medio centro': 'Mediocentro',
  'mediocentro': 'Mediocentro',
  'medio centro defensivo': 'Pivote Defensivo',
  'medio centro ofensivo': 'Mediapunta',
  'mediapunta': 'Mediapunta',
  'medio derecho': 'Extremo Derecho',
  'medio izquierdo': 'Extremo Izquierdo',
  'extremo derecho': 'Extremo Derecho',
  'extremo izquierdo': 'Extremo Izquierdo',
  'delantero': 'Delantero Centro',
  'delantera': 'Delantero Centro',
  'delantero/a': 'Delantero Centro',
  'delantero centro': 'Delantero Centro',
  'segundo delantero': 'Segundo Delantero'
};

function normalizePosition(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const mapped = POSITION_MAP[text.toLowerCase()];
  if (mapped) return mapped;
  // Posición desconocida: se conserva en formato título
  return text.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function parseDorsal(raw) {
  const num = parseInt(String(raw || '').trim(), 10);
  return !isNaN(num) && num >= 1 && num <= 99 ? num : null;
}

// Estadísticas de la API -> mismas claves que se guardaban antes desde la ficha web
const STAT_KEY_MAP = {
  'Total Goles': 'Goles',
  'Media Goles por partido': 'Media goles/partido',
  'Doble Amarilla': 'Doble amarilla'
};

function buildStats(playerApi) {
  const stats = {};
  for (const item of [...(playerApi.partidos || []), ...(playerApi.tarjetas || [])]) {
    if (!item || !item.nombre) continue;
    const key = STAT_KEY_MAP[item.nombre] || item.nombre;
    stats[key] = key === 'Media goles/partido' ? (parseFloat(item.valor) || 0).toFixed(2) : String(item.valor ?? '0');
  }
  if (playerApi.minutos_totales_jugados != null) stats['Minutos'] = String(playerApi.minutos_totales_jugados);
  return stats;
}

function buildHistory(historyApi) {
  const rows = Array.isArray(historyApi?.datos_historico) && historyApi.datos_historico.length
    ? historyApi.datos_historico
    : (Array.isArray(historyApi?.datos_estadisticos) ? historyApi.datos_estadisticos : []);
  return rows
    .map((h) => {
      const escudo = h.escudo && h.escudo !== '/pnfg//' ? formatLogoUrl(h.escudo) : null;
      return {
        temporada: String(h.temporada || '').trim(),
        escudo_url: escudo,
        equipo: String(h.equipo || h.nombre_equipo || '').trim(),
        categoria: String(h.categoria || '').trim(),
        cod_temporada: parseInt(h.cod_temporada, 10) || 0
      };
    })
    .filter((h) => h.temporada && h.equipo)
    .sort((a, b) => b.cod_temporada - a.cod_temporada)
    .map(({ cod_temporada, ...h }) => h);
}

/** La API responde estado '1' incluso para códigos inexistentes: exigimos que traiga el nombre. */
function isValidProfile(playerApi) {
  return Boolean(playerApi && playerApi.estado === '1' && String(playerApi.nombre_jugador || '').trim());
}

function parseBirthYear(playerApi, historyApi) {
  const fromApi = parseInt(playerApi?.anio_nacimiento, 10);
  if (!isNaN(fromApi)) return fromApi;
  const m = String(historyApi?.fecha_nacimiento || '').match(/(\d{4})$/);
  return m ? parseInt(m[1], 10) : null;
}

/** Obtiene ficha + historial de un jugador y construye su registro. */
async function scrapePlayer({ codJugador, nombreJugador, codEquipo, nombreEquipo, comp, grp }) {
  const playerUrl = `https://ffcv.es/competiciones/jugadores/jugador.php?codigo=${encodeURIComponent(codJugador)}&cod_competicion=${encodeURIComponent(comp.id)}&cod_grupo=${encodeURIComponent(grp.id)}&cod_temporada=${encodeURIComponent(TARGET_TEMPORADA)}`;
  const cod = encodeURIComponent(codJugador);
  const temp = encodeURIComponent(TARGET_TEMPORADA);

  const playerApi = await ffcvFetch(`jugadores/jugador_api.php?codigo=${cod}&cod_temporada=${temp}`);
  const historyApi = await ffcvFetch(`jugadores/historial_deportivo.php?cod_licencia=${cod}&cod_temporada=${temp}`);

  const parsedName = parsePlayerName(nombreJugador);
  const history = buildHistory(historyApi);
  const hasProfile = isValidProfile(playerApi);
  const age = hasProfile ? parseInt(playerApi.edad, 10) : NaN;
  const birthYear = parseBirthYear(playerApi, historyApi);

  return {
    id: `ffcv-p-${codJugador}`,
    ffcv_player_id: codJugador,
    full_name: parsedName.fullName,
    first_name: parsedName.firstName,
    last_name: parsedName.lastName,
    position: (hasProfile && normalizePosition(playerApi.posicion_jugador)) || 'Sense definir',
    dorsal: hasProfile ? parseDorsal(playerApi.dorsal_jugador) : null,
    age: isNaN(age) ? null : age,
    birth_year: birthYear,
    birth_date: parseDate(historyApi?.fecha_nacimiento),
    photo_url: hasProfile ? toPhotoUrl(playerApi.foto, codJugador) : null,
    team: nombreEquipo,
    team_id: `ffcv-team-${codEquipo}`,
    competition: comp.name,
    group: grp.name,
    infantil_year: calculateInfantilYear(history, isNaN(age) ? null : age, birthYear),
    history,
    sports_data: hasProfile ? buildStats(playerApi) : {},
    source_url: playerUrl,
    scraped_at: new Date().toISOString(),
    _incomplete: !hasProfile || !historyApi
  };
}

(async () => {
  console.log('=====================================================');
  console.log('⚽ SCRAPER FFCV INFANTIL - PARTIDOS, JUGADORES E HISTORIAL');
  console.log('=====================================================');
  console.log(`Temporada objetivo: 2026-2027 (código ${TARGET_TEMPORADA})`);
  const startedAt = Date.now();

  const fieldsCache = new Map(); // codcampo -> info campo (coordenadas, dirección, etc.)
  const allMatches = [];
  const allTeams = [];
  const allPlayers = [];
  // Solo si se recorren todas las plantillas sin fallos se revisan/borran jugadores antiguos
  let playersComplete = !matchesOnly && limitTeams === Infinity && limitPlayers === Infinity;
  const dataDir = path.join(__dirname, '..', 'src', 'data');
  ensureDir(dataDir);

  try {
    // ── 0. Comprobar si Segona Infantil ya está disponible en FFCV ──────────
    console.log('\n🔍 Comprobando disponibilidad de Segona Regional Infantil (Grupos 1 al 4 de Castelló)...');
    let segonaComp = null;
    const compsData = await ffcvFetch(`filtros/competiciones_fetch.php?cod_temporada=${encodeURIComponent(TARGET_TEMPORADA)}`);
    const found = (compsData?.competiciones || []).find(c => {
      const n = (c.nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return (n.includes('segona') || n.includes('segunda') || n.includes('2a') || n.includes('2ª') || n.includes('2 regional')) &&
             n.includes('infantil') && !n.includes('futsal') && !n.includes('platja');
    });
    if (found) {
      const grpData = await ffcvFetch(`filtros/grupos_fetch.php?cod_competicion=${encodeURIComponent(found.codigo)}`);
      const castellonGroups = (grpData?.grupos || []).filter(g => {
        const m = g.nombre.match(/\b([1-4])\b/) || g.nombre.match(/grup[^\d]*([1-4])/i);
        return Boolean(m);
      });
      if (castellonGroups.length > 0) {
        segonaComp = {
          id: String(found.codigo),
          name: found.nombre,
          groups: castellonGroups.map(g => ({ id: String(g.codigo), name: g.nombre }))
        };
      }
    }

    const competitionsToScrape = [...TARGET_COMPETITIONS];

    if (segonaComp && segonaComp.groups.length > 0) {
      console.log(`🎉 ¡Detectada ${segonaComp.name} (${segonaComp.id}) con ${segonaComp.groups.length} grupos de Castelló!`);
      console.log(`   Grupos: ${segonaComp.groups.map(g => g.name).join(', ')}`);
      competitionsToScrape.push(segonaComp);
    } else {
      console.log('ℹ️  Segona Regional Infantil (Grupos 1 al 4 de Castelló):');
      console.log('   La FFCV aún no ha publicado los calendarios. El sistema los revisará automáticamente cada semana y los incorporará en cuanto FFCV los publique.');
    }

    // ── 1. RASPADO DE PARTIDOS / AGENDA ──────────────────────────────────────────
    if (!playersOnly) {
      console.log('\n========================================');
      console.log('📅 EXTRACCIÓN DE PARTIDOS Y AGENDA CON CAMPOS');
      console.log('========================================');

      for (const comp of competitionsToScrape) {
        console.log(`\n🏆 ${comp.name} (${comp.id})`);

        for (const grp of comp.groups) {
          console.log(`  🔹 ${grp.name} (${grp.id})`);

          const jornadasData = await ffcvFetch(`filtros/jornadas_fetch.php?cod_grupo=${encodeURIComponent(grp.id)}`);
          const jornadas = Array.isArray(jornadasData?.jornadas) ? jornadasData.jornadas : [];
          console.log(`     Total jornadas: ${jornadas.length}`);

          for (const jor of jornadas) {
            const codJornada = jor.codjornada || jor.nombre;
            const jornadaNombre = `Jornada ${jor.nombre || codJornada}`;

            const partidosData = await ffcvFetch(`partidos/resultados_por_grupo_jornada_data.php?cod_grupo=${encodeURIComponent(grp.id)}&cod_jornada=${encodeURIComponent(codJornada)}`);
            const partidosList = Array.isArray(partidosData?.partidos) ? partidosData.partidos : [];

            // Ficha detallada de cada partido (árbitros, código de campo, hora confirmada)
            const details = await mapWithConcurrency(partidosList, 3, (p) =>
              p.codacta ? ffcvFetch(`partidos/ficha_partido_ajax.php?cod_partido=${encodeURIComponent(p.codacta)}`) : null
            );

            for (let i = 0; i < partidosList.length; i++) {
              const p = partidosList[i];
              const matchDetail = details[i];
              const codigoCampo = matchDetail?.codigo_campo || null;
              const fieldName = matchDetail?.campo || p.campo || 'Por determinar';

              // Coordenadas de la instalación/campo (con cache)
              if (codigoCampo && !fieldsCache.has(codigoCampo)) {
                const fieldData = await ffcvFetch(`instalaciones/datos_campo.php?Codigo_Campo=${encodeURIComponent(codigoCampo)}`);
                if (fieldData) {
                  fieldsCache.set(codigoCampo, {
                    codigo_campo: codigoCampo,
                    nombre: fieldData.nombre_campo || fieldName,
                    direccion: fieldData.direccion || null,
                    localidad: fieldData.localidad || null,
                    provincia: fieldData.provincia || 'Castelló',
                    codigo_postal: fieldData.codigo_postal || null,
                    superficie: fieldData.superficie_juego || null,
                    latitude: fieldData.latitud ? parseFloat(fieldData.latitud) : null,
                    longitude: fieldData.longitud ? parseFloat(fieldData.longitud) : null,
                  });
                }
              }

              const fieldCoords = codigoCampo ? fieldsCache.get(codigoCampo) : null;
              const fechaPart = parseDate(matchDetail?.fecha || p.fecha);
              const horaPart = parseTime(matchDetail?.hora || p.hora);

              allMatches.push({
                id: `ffcv-acta-${p.codacta || `${p.cod_equipo_local}-${p.cod_equipo_visitante}-${fechaPart}`}`,
                codacta: p.codacta || null,
                competition: comp.name,
                cod_competicion: comp.id,
                group: grp.name,
                cod_grupo: grp.id,
                matchday: jornadaNombre,
                match_date: fechaPart,
                time: horaPart,
                status: p.resultado && p.resultado !== '0' ? 'Jugado' : (p.estado === '5' ? 'Suspendido' : 'Programado'),
                home_team: p.local,
                home_team_id: p.cod_equipo_local,
                home_crest: formatLogoUrl(p.escudo_local || matchDetail?.escudo_local),
                away_team: p.visitante,
                away_team_id: p.cod_equipo_visitante,
                away_crest: formatLogoUrl(p.escudo_visitante || matchDetail?.escudo_visitante),
                home_score: p.goles_local != null && p.goles_local !== '' ? parseInt(p.goles_local, 10) : null,
                away_score: p.goles_visitante != null && p.goles_visitante !== '' ? parseInt(p.goles_visitante, 10) : null,
                field_name: fieldName,
                field_code: codigoCampo,
                address: fieldCoords?.direccion || null,
                city: fieldCoords?.localidad || null,
                province: fieldCoords?.provincia || 'Castelló',
                latitude: fieldCoords?.latitude || null,
                longitude: fieldCoords?.longitude || null,
                referees: Array.isArray(matchDetail?.arbitros_partido) ? matchDetail.arbitros_partido.map(a => a.nombre).filter(Boolean) : []
              });
            }
            console.log(`       ${jornadaNombre}: ${partidosList.length} partidos recogidos`);
          }
          console.log(`     ✅ Grupo ${grp.name} completado.`);
        }
      }
      console.log(`\n🏟️  Total partidos recogidos para la agenda: ${allMatches.length}`);

      // Guardar ya los partidos para no perderlos si la fase de jugadores falla
      if (allMatches.length > 0) {
        fs.writeFileSync(path.join(dataDir, 'scraped_matches.json'), JSON.stringify(allMatches, null, 2), 'utf8');
      }
    }

    // ── 2. RASPADO DE EQUIPOS, JUGADORES E HISTORIAL ─────────────────────────────
    if (!matchesOnly) {
      console.log('\n========================================');
      console.log('👥 EXTRACCIÓN DE EQUIPOS, PLANTILLAS E HISTORIAL');
      console.log('========================================');

      for (const comp of competitionsToScrape) {
        console.log(`\n🏆 ${comp.name} (${comp.id})`);

        for (const grp of comp.groups) {
          console.log(`  🔹 Obteniendo equipos de ${grp.name}...`);

          // Equipos del grupo mediante la clasificación
          const classifData = await ffcvFetch(`clasificaciones/clasificaciones_ajax.php?cod_grupo=${encodeURIComponent(grp.id)}&cod_jornada=1`);
          const equipos = Array.isArray(classifData?.clasificacion)
            ? classifData.clasificacion
            : (Array.isArray(classifData?.clasificaciones) ? classifData.clasificaciones : []);

          console.log(`     ${equipos.length} equipos en el grupo.`);
          if (!classifData || equipos.length === 0) playersComplete = false;
          const teamsToScrape = equipos.slice(0, limitTeams);
          if (equipos.length > teamsToScrape.length) {
            console.log(`     ⚠️ Límite de equipos aplicado (--limit-teams ${limitTeams})`);
          }

          for (let t = 0; t < teamsToScrape.length; t++) {
            const eq = teamsToScrape[t];
            const codEquipo = eq.codequipo;
            const nombreEquipo = eq.nombre;

            console.log(`\n     🏃 [${t + 1}/${teamsToScrape.length}] Equipo: ${nombreEquipo} (${codEquipo})`);

            const teamDetail = await ffcvFetch(`equipos/ver_equipo.php?codequipo=${encodeURIComponent(codEquipo)}`);
            if (!teamDetail) playersComplete = false;
            const teamInfo = teamDetail?.j || teamDetail || {};
            const jugadores = Array.isArray(teamInfo.jugadores_equipo) ? teamInfo.jugadores_equipo : [];

            allTeams.push({
              id: `ffcv-team-${codEquipo}`,
              ffcv_cod: codEquipo,
              name: nombreEquipo,
              club: teamInfo.nombre_club || nombreEquipo,
              crest_url: formatLogoUrl(eq.url_img),
              field_name: teamInfo.campo || null,
              field_code: teamInfo.codigo_campo || null,
              address: teamInfo.domicilio_correspondencia || null,
              city: teamInfo.localidad_correspondencia || 'Castelló',
              province: teamInfo.provincia_correspondencia || 'Castelló',
              web: teamInfo.portal_web || null,
              competition: comp.name,
              cod_competicion: comp.id,
              group: grp.name,
              cod_grupo: grp.id,
              players_count: jugadores.length
            });

            const playersToScrape = jugadores.slice(0, limitPlayers);
            console.log(`        Plantilla: ${jugadores.length} jugadores.`);

            const records = await mapWithConcurrency(playersToScrape, 3, (j) =>
              scrapePlayer({ codJugador: j.cod_jugador, nombreJugador: j.nombre, codEquipo, nombreEquipo, comp, grp })
                .catch((err) => {
                  console.warn(`        ⚠️ Error en jugador ${j.nombre} (${j.cod_jugador}): ${err.message}`);
                  return null;
                })
            );

            records.forEach((rec, idx) => {
              if (!rec) {
                playersComplete = false;
                return;
              }
              const { _incomplete, ...player } = rec;
              allPlayers.push(player);
              const extra = [
                player.dorsal ? `#${player.dorsal}` : null,
                player.position !== 'Sense definir' ? player.position : null,
                _incomplete ? '⚠️ datos incompletos' : null
              ].filter(Boolean).join(', ');
              console.log(`        [${idx + 1}/${playersToScrape.length}] ${player.full_name} -> ${player.infantil_year}${extra ? ` (${extra})` : ''}`);
            });

            // Guardado progresivo por equipo
            fs.writeFileSync(path.join(dataDir, 'scraped_players.json'), JSON.stringify(allPlayers, null, 2), 'utf8');
            fs.writeFileSync(path.join(dataDir, 'scraped_teams.json'), JSON.stringify(allTeams, null, 2), 'utf8');
          }
        }
      }
    }

    // ── 3. GUARDAR RESULTADOS LOCALES (JSON) ─────────────────────────────────────
    if (allMatches.length > 0) {
      const matchesPath = path.join(dataDir, 'scraped_matches.json');
      fs.writeFileSync(matchesPath, JSON.stringify(allMatches, null, 2), 'utf8');
      console.log(`\n💾 Guardados ${allMatches.length} partidos en: ${matchesPath}`);
    }

    if (allTeams.length > 0) {
      const teamsPath = path.join(dataDir, 'scraped_teams.json');
      fs.writeFileSync(teamsPath, JSON.stringify(allTeams, null, 2), 'utf8');
      console.log(`💾 Guardados ${allTeams.length} equipos en: ${teamsPath}`);
    }

    if (allPlayers.length > 0) {
      const playersPath = path.join(dataDir, 'scraped_players.json');
      fs.writeFileSync(playersPath, JSON.stringify(allPlayers, null, 2), 'utf8');
      console.log(`💾 Guardados ${allPlayers.length} jugadores en: ${playersPath}`);

      const countYear = (y) => allPlayers.filter(p => p.infantil_year === y).length;
      console.log('\n📊 Desglose de Clasificación Infantil:');
      console.log(`   🔹 Infantil 1er año: ${countYear('Infantil 1er año')}`);
      console.log(`   🔹 Infantil 2º año:  ${countYear('Infantil 2º año')}`);
      console.log(`   🔹 Alevín 2º año:    ${countYear('Alevín 2º año')}`);
      console.log(`   🔹 Desconocido:      ${countYear('Desconocido')}`);
      console.log(`   🔹 Con dorsal:       ${allPlayers.filter(p => p.dorsal).length}`);
      console.log(`   🔹 Con posición:     ${allPlayers.filter(p => p.position !== 'Sense definir').length}`);
    }

    // ── 4. SINCRONIZACIÓN CON SUPABASE (SI ESTÁ ACTIVO) ──────────────────────────
    await trySaveToSupabase(allMatches, allTeams, allPlayers, { playersComplete });

    console.log(`\n✨ ¡Proceso de scraping finalizado con éxito en ${Math.round((Date.now() - startedAt) / 1000)}s!`);

  } catch (err) {
    console.error('\n❌ Error durante el scraping:', err);
    process.exitCode = 1;
  }
})();
