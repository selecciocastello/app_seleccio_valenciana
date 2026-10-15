/**
 * Cliente de la API de la FFCV a través de un navegador (Playwright).
 *
 * La API de ffcv.es exige la sesión y el token (X-FFCV-Page-Token) que genera su web al
 * cargarse, así que se abre https://ffcv.es/competiciones/ en Chromium y las peticiones
 * a la API se hacen desde dentro de esa página. Si la sesión caduca (403) se recarga la
 * página y se reintenta.
 *
 * Todas las peticiones pasan por un limitador global (~20/min con variación aleatoria) y,
 * ante un 429, se pausan todas el tiempo que indique retry_after antes de reintentar.
 * Ante un bloqueo por IP (IP_ABUSE_*) la pausa crece con cada bloqueo seguido y no se
 * recarga la página (eso son más peticiones y alarga el bloqueo); si la IP sigue
 * bloqueada tras IP_BLOCK_MAX_STREAK pausas, se deja de pedir nada a la FFCV en esta
 * ejecución y las peticiones devuelven 429 al momento. La FFCV además limita el total de
 * peticiones por sesión (429 SESSION_RATE_LIMIT): la sesión se renueva cada
 * SESSION_MAX_REQUESTS peticiones y, si aun así se agota, se abre una nueva al momento. Los 5xx ("upstream temporalmente
 * degradado") se reintentan con espera creciente.
 *
 * Uso:
 *   const { ffcvApiGet, closeFfcv } = require('./ffcv_client.cjs');
 *   const { status, data } = await ffcvApiGet('filtros/jornadas_fetch.php?cod_grupo=905431908');
 *   ...
 *   await closeFfcv(); // al terminar, o el proceso no acaba
 */

const { chromium } = require('playwright');

const FFCV_HOME = 'https://ffcv.es/competiciones/';
const REQUEST_TIMEOUT_MS = 30000;
const MIN_REQUEST_INTERVAL_MS = 2500; // + hasta REQUEST_JITTER_MS: ~20 peticiones/minuto
const REQUEST_JITTER_MS = 1500;
// Pausa ante el 1º, 2º, 3º... bloqueo por IP seguido (se reinicia con la primera respuesta buena)
const IP_BLOCK_WAITS_S = [90, 300, 600, 900, 900];
const IP_BLOCK_MAX_STREAK = IP_BLOCK_WAITS_S.length;
const MAX_RATE_LIMIT_RETRIES = 10;
const MAX_SERVER_ERROR_RETRIES = 4;
const MAX_SESSION_RENEWALS = 5;
const SESSION_MAX_REQUESTS = 180;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let nextRequestAt = 0;

async function acquireRequestSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextRequestAt);
  nextRequestAt = slot + MIN_REQUEST_INTERVAL_MS + Math.floor(Math.random() * REQUEST_JITTER_MS);
  if (slot > now) await sleep(slot - now);
}

let browser = null;
let page = null;
let pageToken = null;
let sessionGen = 0;
let opening = null;
let resettingGen = -1;
let sessionRequests = 0;
let ipBlockStreak = 0;
let ipBlockedAt = 0; // cuándo empezó la última pausa por bloqueo de IP
let ipBanned = false;

async function openSession() {
  if (!browser) browser = await chromium.launch();
  if (page) await page.close().catch(() => {});

  // Si hay un bloqueo o límite por IP activo, esperar antes de navegar a la web
  const now = Date.now();
  if (nextRequestAt > now) {
    const waitMs = nextRequestAt - now;
    console.warn(`        ⏳ Esperando ${Math.ceil(waitMs / 1000)}s antes de navegar para nueva sesión FFCV...`);
    await sleep(waitMs);
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      page = await browser.newPage();
      pageToken = null;
      page.on('request', (req) => {
        const token = req.headers()['x-ffcv-page-token'];
        if (token) pageToken = token;
      });

      // Navegación con domcontentloaded + networkidle suave (timeout corto) para evitar bloqueos
      await page.goto(FFCV_HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});

      // Esperar brevemente a que se capture el token si no vino en las peticiones iniciales
      for (let i = 0; i < 20 && !pageToken; i++) {
        await sleep(250);
      }

      sessionRequests = 0;
      sessionGen++;
      return;
    } catch (err) {
      console.warn(`        ⚠️ Intento ${attempt}/3 al abrir sesión en FFCV: ${err.message}`);
      if (page) await page.close().catch(() => {});
      page = null;
      if (attempt === 3) throw err;
      await sleep(4000 * attempt);
    }
  }
}

/** Abre la sesión una sola vez aunque la pidan varias peticiones a la vez. */
async function ensureSession() {
  if (!opening) opening = openSession();
  try {
    await opening;
  } catch (err) {
    opening = null;
    throw err;
  }
}

/** Recarga la sesión, salvo que otra petición ya lo haya hecho desde `gen`. */
async function resetSession(gen) {
  if (gen === sessionGen && resettingGen !== gen) {
    resettingGen = gen;
    opening = null;
  }
  await ensureSession();
}

async function rawGet(endpoint) {
  await ensureSession();
  // Sesión nueva antes de agotar el límite de peticiones por sesión de la FFCV
  if (sessionRequests >= SESSION_MAX_REQUESTS) await resetSession(sessionGen);
  await acquireRequestSlot();
  sessionRequests++;
  const gen = sessionGen;
  const sentAt = Date.now();
  const res = await page.evaluate(async ({ url, token, timeout }) => {
    const headers = { 'X-Requested-With': 'XMLHttpRequest' };
    if (token) headers['X-FFCV-Page-Token'] = token;
    const r = await fetch(url, { headers, credentials: 'include', signal: AbortSignal.timeout(timeout) });
    return { status: r.status, text: await r.text() };
  }, { url: `/competiciones/api/${endpoint}`, token: pageToken, timeout: REQUEST_TIMEOUT_MS });
  return { ...res, gen, sentAt };
}

/**
 * GET a la API. Devuelve { status, data }: data es el JSON, o null si la respuesta no
 * es 200. Lanza si falla la red.
 */
async function ffcvApiGet(endpoint) {
  let res;
  let data = null;
  let rateLimited = 0;
  let serverErrors = 0;
  let sessionReset = false;
  let sessionRenewals = 0;
  while (true) {
    if (ipBanned) return { status: 429, data: null };
    res = await rawGet(endpoint);
    data = null;
    try { data = JSON.parse(res.text); } catch (e) {}

    if (res.status === 403 && !sessionReset) {
      sessionReset = true;
      await resetSession(res.gen);
      continue;
    }
    if (res.status === 429 && data?.reason_code === 'SESSION_RATE_LIMIT' && sessionRenewals < MAX_SESSION_RENEWALS) {
      sessionRenewals++;
      if (res.gen === sessionGen && resettingGen !== res.gen) console.warn('        🔄 Límite de la sesión FFCV agotado. Abriendo una sesión nueva...');
      await resetSession(res.gen);
      continue;
    }
    const isIpAbuse = res.status === 429 && String(data?.reason_code || '').startsWith('IP_ABUSE');
    if (isIpAbuse) {
      // Si la petición salió antes de empezar la pausa actual, el bloqueo ya está contado
      if (res.sentAt >= ipBlockedAt) {
        if (ipBlockStreak >= IP_BLOCK_MAX_STREAK) {
          ipBanned = true;
          console.warn(`        🛑 La FFCV sigue bloqueando la IP tras ${IP_BLOCK_MAX_STREAK} pausas. No se harán más peticiones en esta ejecución.`);
          break;
        }
        const retryAfter = parseInt(data?.retry_after, 10) || 0;
        const waitSecs = Math.max(retryAfter + 5, IP_BLOCK_WAITS_S[ipBlockStreak]);
        ipBlockStreak++;
        ipBlockedAt = Date.now();
        nextRequestAt = Math.max(nextRequestAt, ipBlockedAt + waitSecs * 1000);
        console.warn(`        ⏳ IP bloqueada por la FFCV (${data.reason_code}, ${ipBlockStreak}/${IP_BLOCK_MAX_STREAK}). Pausa de ${waitSecs}s...`);
      }
      // rawGet espera a nextRequestAt; misma sesión, sin recargar la página
      continue;
    }
    if (res.status === 429 && rateLimited < MAX_RATE_LIMIT_RETRIES) {
      rateLimited++;
      const waitSecs = (parseInt(data?.retry_after, 10) || 60) + 3;
      if (Date.now() + waitSecs * 1000 > nextRequestAt) {
        console.warn(`        ⏳ Límite de peticiones FFCV alcanzado (${data?.reason_code || '429'}). Esperando ${waitSecs}s...`);
        nextRequestAt = Date.now() + waitSecs * 1000;
      }
      continue;
    }
    if (res.status >= 500 && serverErrors < MAX_SERVER_ERROR_RETRIES) {
      serverErrors++;
      await sleep(5000 * serverErrors);
      continue;
    }
    break;
  }
  if (res.status === 200) ipBlockStreak = 0;
  if (res.status !== 200) {
    console.warn(`        ⚠️ HTTP ${res.status} en ${endpoint}: ${res.text.slice(0, 200)}`);
  }
  return { status: res.status, data: res.status === 200 ? data : null };
}

async function closeFfcv() {
  if (browser) await browser.close().catch(() => {});
  browser = null;
  page = null;
  opening = null;
}

module.exports = { ffcvApiGet, closeFfcv };
