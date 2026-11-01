/**
 * Utilidades comunes de los scrapers de la FFCV (partidos y jugadores).
 *
 *  - scrape_ffcv_matches.cjs: agenda, partidos y campos
 *  - scrape_ffcv_players.cjs: equipos, plantillas, jugadores e historial
 */

const fs = require('fs');
const path = require('path');
const { ffcvApiGet } = require('./ffcv_client.cjs');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

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
  },
  {
    id: '905431645',
    name: 'Segona Infantil Castelló',
    groups: [
      { id: '905431649', name: 'Grup - 1' },
      { id: '905431650', name: 'Grup - 2' },
      { id: '905431651', name: 'Grup - 3' },
      { id: '905431646', name: 'Grup - 4' },
      { id: '905431647', name: 'Grup - 5' },
      { id: '905431648', name: 'Grup - 6' },
      { id: '906280708', name: 'Grup - 7' }
    ]
  }
];

const RETRY_ROUNDS = 3;
const RETRY_PAUSE_MS = 20000;

// ── Cliente HTTP de la API FFCV con límite de peticiones ─────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET a la API de la FFCV. Devuelve el JSON o null si falla tras los reintentos.
 * El límite de peticiones y los 429 los gestiona ffcv_client.cjs.
 */
async function ffcvFetch(endpoint, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await ffcvApiGet(endpoint);
      // Los 429 ya los ha esperado y reintentado ffcv_client.cjs: insistir solo alarga el bloqueo
      if (res.status === 429) return null;
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      return res.data;
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

// ── Cola de reintentos ───────────────────────────────────────────────────────
// Lo que falla durante la descarga se apunta aquí y se vuelve a procesar al final.
// retry() devuelve true si ha ido bien; giveUp() se llama si sigue fallando tras todas las rondas.
let deferred = [];

function defer(label, retry, giveUp = () => {}) {
  deferred.push({ label, retry, giveUp });
}

/** Reintenta lo apuntado (las tareas pueden apuntar más). Devuelve las etiquetas que siguen fallando. */
async function runDeferred() {
  for (let round = 1; round <= RETRY_ROUNDS && deferred.length > 0; round++) {
    const tasks = deferred;
    deferred = [];
    console.log(`\n🔁 Reintento ${round}/${RETRY_ROUNDS}: ${tasks.length} tarea(s) que habían fallado. Esperando ${RETRY_PAUSE_MS * round / 1000}s...`);
    await sleep(RETRY_PAUSE_MS * round);
    for (const task of tasks) {
      let ok = false;
      try {
        ok = await task.retry();
      } catch (err) {
        console.warn(`     ⚠️ ${task.label}: ${err.message}`);
      }
      console.log(`     ${ok ? '✅' : '⚠️'} ${task.label}${ok ? '' : ': sigue fallando'}`);
      if (!ok) deferred.push(task);
    }
  }
  const failed = deferred;
  deferred = [];
  for (const task of failed) task.giveUp();
  return failed.map((t) => t.label);
}

/** Fecha de hoy (YYYY-MM-DD) en hora peninsular. */
function todayInSpain() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

/** Devuelve la fecha base (YYYY-MM-DD) más N días. */
function datePlusDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** JSON con las claves ordenadas, para comparar valores jsonb de la BD con los nuevos. */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** "4 - 1" -> [4, 1]; null si el partido no tiene resultado. */
function parseResult(resultado) {
  const m = String(resultado || '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
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

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
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

/** Cliente de Supabase con la service role, o null si no está configurado. */
function getSupabase() {
  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-supabase')) return null;
  const { createClient } = require('@supabase/supabase-js');
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

function readJsonArray(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function readJsonObject(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  DATA_DIR,
  TARGET_TEMPORADA,
  TARGET_SEASON_START_YEAR,
  TARGET_COMPETITIONS,
  RETRY_ROUNDS,
  RETRY_PAUSE_MS,
  sleep,
  ffcvFetch,
  mapWithConcurrency,
  defer,
  runDeferred,
  todayInSpain,
  datePlusDays,
  stableStringify,
  parseResult,
  formatLogoUrl,
  parseDate,
  parseTime,
  ensureDir,
  loadEnv,
  selectAll,
  getSupabase,
  readJsonArray,
  readJsonObject
};
