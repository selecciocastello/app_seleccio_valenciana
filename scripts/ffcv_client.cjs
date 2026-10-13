/**
 * Cliente de la API de la FFCV a través de un navegador (Playwright).
 *
 * La API de ffcv.es exige la sesión y el token (X-FFCV-Page-Token) que genera su web al
 * cargarse, así que se abre https://ffcv.es/competiciones/ en Chromium y las peticiones
 * a la API se hacen desde dentro de esa página. Si la sesión caduca (403) se recarga la
 * página y se reintenta.
 *
 * Todas las peticiones pasan por un limitador global y, ante un 429, se pausan todas el
 * tiempo que indique retry_after antes de reintentar. Los 5xx ("upstream temporalmente
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
const MIN_REQUEST_INTERVAL_MS = 500; // ~120 peticiones/minuto
const MAX_RATE_LIMIT_RETRIES = 5;
const MAX_SERVER_ERROR_RETRIES = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let nextRequestAt = 0;

async function acquireRequestSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextRequestAt);
  nextRequestAt = slot + MIN_REQUEST_INTERVAL_MS;
  if (slot > now) await sleep(slot - now);
}

let browser = null;
let page = null;
let pageToken = null;
let sessionGen = 0;
let opening = null;

async function openSession() {
  if (!browser) browser = await chromium.launch();
  if (page) await page.close().catch(() => {});
  page = await browser.newPage();
  pageToken = null;
  page.on('request', (req) => {
    const token = req.headers()['x-ffcv-page-token'];
    if (token) pageToken = token;
  });
  await page.goto(FFCV_HOME, { waitUntil: 'networkidle', timeout: 60000 });
  sessionGen++;
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
  if (gen === sessionGen) opening = null;
  await ensureSession();
}

async function rawGet(endpoint) {
  await ensureSession();
  await acquireRequestSlot();
  const gen = sessionGen;
  const res = await page.evaluate(async ({ url, token, timeout }) => {
    const headers = { 'X-Requested-With': 'XMLHttpRequest' };
    if (token) headers['X-FFCV-Page-Token'] = token;
    const r = await fetch(url, { headers, credentials: 'include', signal: AbortSignal.timeout(timeout) });
    return { status: r.status, text: await r.text() };
  }, { url: `/competiciones/api/${endpoint}`, token: pageToken, timeout: REQUEST_TIMEOUT_MS });
  return { ...res, gen };
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
  while (true) {
    res = await rawGet(endpoint);
    data = null;
    try { data = JSON.parse(res.text); } catch (e) {}

    if (res.status === 403 && !sessionReset) {
      sessionReset = true;
      await resetSession(res.gen);
      continue;
    }
    if (res.status === 429 && rateLimited < MAX_RATE_LIMIT_RETRIES) {
      rateLimited++;
      const waitSecs = (parseInt(data?.retry_after, 10) || 60) + 2;
      if (Date.now() + waitSecs * 1000 > nextRequestAt) {
        console.warn(`        ⏳ Límite de peticiones FFCV alcanzado. Esperando ${waitSecs}s...`);
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
