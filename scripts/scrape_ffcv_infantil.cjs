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
 *   --headless <bool>     Ejecutar en modo headless (por defecto true)
 */

const fs = require('fs');
const path = require('path');

// Intentar cargar playwright desde node_modules local o desde App UD Atzeneta
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  try {
    ({ chromium } = require(path.join(__dirname, '..', '..', 'App UD Atzeneta', 'node_modules', 'playwright')));
  } catch (e2) {
    console.error('❌ Error: Playwright no está instalado. Ejecuta: npm install -D playwright');
    process.exit(1);
  }
}

// Configuración de competiciones solicitadas: Preferente, 1ª Regional y 2ª Regional
const TARGET_TEMPORADA = '22'; // 2026-2027

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
const headless = !args.includes('--no-headless');

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
 * Determina si un jugador es "Infantil 1er año", "Infantil 2º año" o "Desconocido"
 * según el historial de la temporada anterior (2025-2026).
 */
function calculateInfantilYear(history, age) {
  if (history && Array.isArray(history) && history.length > 0) {
    // Filtrar todas las temporadas anteriores a la actual (2026-2027)
    const prevSeasons = history.filter(h => {
      const t = (h.temporada || '').toLowerCase().replace(/\s+/g, '');
      return !t.startsWith('2026-2027') && !t.startsWith('26-27') && !t.startsWith('2026/2027');
    });

    if (prevSeasons.length > 0) {
      const allPrevCategories = prevSeasons.map(h =>
        (h.categoria || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
      );

      // Regla FFCV: Si en la temporada anterior aparece Cadete o Infantil -> es Infantil 2º año
      const hasCadeteOrInfantil = allPrevCategories.some(cat =>
        cat.includes('cadet') || cat.includes('infantil')
      );
      if (hasCadeteOrInfantil) {
        return 'Infantil 2º año';
      }

      // Si en la temporada anterior era Alevín (Aleví) -> es Infantil 1er año
      const hasAlevin = allPrevCategories.some(cat =>
        cat.includes('alevin') || cat.includes('alevi')
      );
      if (hasAlevin) {
        return 'Infantil 1er año';
      }
    }
  }

  // Fallback por edad federativa si está disponible
  if (typeof age === 'number' && !isNaN(age)) {
    if (age >= 13) return 'Infantil 2º año';
    if (age === 12) return 'Infantil 1er año';
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

// Intentar guardar en Supabase si está disponible
async function trySaveToSupabase(matches, teams, players) {
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
          if (!isNaN(num) && num > 0 && num <= 99 && num !== p.age) {
            cleanJersey = num;
          }
        }

        playersMap.set(sourcePlayerId, {
          first_name: firstName,
          last_name: lastName,
          position: p.position || 'Candidato',
          jersey_number: cleanJersey,
          photo_url: p.photo_url || null,
          team_id: teamId,
          city: p.city || 'Castelló',
          province: p.province || 'Castelló',
          status: 'Candidato',
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
    }
  } catch (err) {
    console.warn('   ⚠️ Error conectando con Supabase:', err.message);
  }
}

function getChromiumLaunchOptions(headless) {
  const options = { headless };
  const cacheBase = path.join(process.env.HOME || '/Users/imac', 'Library', 'Caches', 'ms-playwright');
  if (fs.existsSync(cacheBase)) {
    try {
      const entries = fs.readdirSync(cacheBase);
      for (const entry of entries) {
        if (entry.startsWith('chromium-')) {
          const candidate = path.join(cacheBase, entry, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
          if (fs.existsSync(candidate)) {
            options.executablePath = candidate;
            break;
          }
        }
      }
    } catch (e) {}
  }
  return options;
}

async function scrapePlayerWithRetry(page, playerUrl, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.evaluate(url => { window.location.href = url; }, playerUrl);
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 });

      // Si redirige a WordPress, re-establecer sesión
      if (page.url().includes('/wp')) {
        if (attempt < maxRetries) {
          console.warn(`        ⚠️ Intento ${attempt}: Redirección a /wp. Re-estableciendo sesión...`);
          await page.goto('https://ffcv.es/competiciones/#partidos', { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.evaluate(() => {
            try { sessionStorage.setItem('ffcv_entry_ok', '1'); } catch(e) {}
          });
          await page.waitForTimeout(1000);
          continue;
        } else {
          return { profileData: {}, history: [], isWp: true };
        }
      }

      // Esperar dinámicamente a que aparezcan los elementos de la ficha del jugador en el DOM
      await page.waitForSelector('img.player-photo, .stat-card, .player-name, .label, .roster-card-dorsal', { timeout: 6000 }).catch(() => null);
      await page.waitForTimeout(200);

      // Extraer foto, dorsal, edad, posición y estadísticas
      const profileData = await page.evaluate(() => {
        const photoImg = document.querySelector('img.player-photo');
        const photo = photoImg ? photoImg.src : null;

        // Extraer edad de texto: "12 años", "13 años", "12 anys", etc.
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        let age = null;
        while ((node = walker.nextNode())) {
          const m = node.nodeValue.match(/(\d+)\s*años?/i) || node.nodeValue.match(/(\d+)\s*anys?/i);
          if (m) {
            age = parseInt(m[1], 10);
            break;
          }
        }

        // Extraer dorsal específicamente del elemento oficial .roster-card-dorsal
        const dorsalEl = document.querySelector('.roster-card-dorsal, .player-dorsal, .roster-dorsal');
        let dorsal = null;
        if (dorsalEl) {
          const dorsalText = dorsalEl.textContent.trim();
          const dorsalMatch = dorsalText.match(/\b([1-9][0-9]?)\b/);
          if (dorsalMatch) {
            const num = parseInt(dorsalMatch[1], 10);
            if (num >= 1 && num <= 99 && !dorsalText.toLowerCase().includes('año') && !dorsalText.toLowerCase().includes('any') && !dorsalText.toLowerCase().includes('edad')) {
              if (age == null || num !== age) {
                dorsal = num;
              }
            }
          }
        }

        // Extraer posición (ej: <span class="label">Lateral derecho</span>)
        const labelElements = Array.from(document.querySelectorAll('.label, span.label, .posicion, .position, .player-position, [class*="posicion"]'));
        let position = null;
        for (const el of labelElements) {
          const text = el.textContent.trim();
          if (text && text.length > 2 && text.length < 40 && !text.toLowerCase().includes('año') && !text.toLowerCase().includes('any') && !text.toLowerCase().includes('temporada') && !text.toLowerCase().includes('candidato')) {
            position = text.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            break;
          }
        }

        // Extraer estadísticas de las stat-cards
        const stats = {};
        document.querySelectorAll('.stat-card').forEach(card => {
          const val = card.querySelector('.stat-val')?.textContent?.trim();
          const lbl = card.querySelector('.stat-lbl')?.textContent?.trim();
          if (lbl && val !== undefined) stats[lbl] = val;
        });

        return { photo, age, dorsal, stats, position };
      });

      // Clic en pestaña Historial para obtener tabla de trayectorias
      let history = [];
      try {
        const histTab = page.locator('a.match-tab[href="#history"], [href*="history"]').first();
        if (await histTab.isVisible({ timeout: 2000 })) {
          await histTab.click();
          await page.waitForSelector('#history table tbody tr, table tbody tr', { timeout: 3000 }).catch(() => null);
          await page.waitForTimeout(200);

          history = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#history table tbody tr, table tbody tr'));
            return rows.map(r => {
              const cells = r.querySelectorAll('td');
              if (cells.length < 4) return null;
              const temporada = cells[0]?.textContent?.trim();
              const escudo = cells[1]?.querySelector('img')?.src || null;
              const equipo = cells[2]?.textContent?.trim();
              const categoria = cells[3]?.textContent?.trim();
              return {
                temporada,
                escudo_url: escudo && !escudo.includes('escudo_generico') ? escudo : null,
                equipo,
                categoria
              };
            }).filter(h => h && h.temporada && h.equipo);
          });
        }
      } catch (histErr) {}

      // Si obtuvimos foto, edad o historial, o ya es el último intento, devolvemos resultado
      if (profileData.photo || profileData.age != null || history.length > 0 || attempt >= maxRetries) {
        return { profileData, history, isWp: false };
      }

      console.warn(`        ⚠️ Intento ${attempt}: Datos incompletos. Reintentando...`);
      await page.waitForTimeout(600);
    } catch (err) {
      if (attempt >= maxRetries) {
        console.warn(`        ⚠️ Error definitivo jugador: ${err.message.split('\n')[0]}`);
        return { profileData: {}, history: [], isWp: false };
      }
      console.warn(`        ⚠️ Error intento ${attempt}: ${err.message.split('\n')[0]}. Reintentando...`);
      try {
        await page.goto('https://ffcv.es/competiciones/#partidos', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.evaluate(() => {
          try { sessionStorage.setItem('ffcv_entry_ok', '1'); } catch(e) {}
        });
      } catch(e) {}
      await page.waitForTimeout(1000);
    }
  }
  return { profileData: {}, history: [], isWp: false };
}

(async () => {
  console.log('=====================================================');
  console.log('⚽ SCRAPER FFCV INFANTIL - PARTIDOS, JUGADORES E HISTORIAL');
  console.log('=====================================================');
  console.log(`Temporada objetivo: 2026-2027 (código ${TARGET_TEMPORADA})`);

  const launchOpts = getChromiumLaunchOptions(headless);
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Referer': 'https://ffcv.es/competiciones/#partidos'
    }
  });
  const page = await context.newPage();

  const fieldsCache = new Map(); // codcampo -> info campo (coordenadas, dirección, etc.)
  const allMatches = [];
  const allTeams = [];
  const allPlayers = [];

  try {
    console.log('\n🌐 Conectando con FFCV...');
    await page.goto('https://ffcv.es/competiciones/#partidos', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      try { sessionStorage.setItem('ffcv_entry_ok', '1'); } catch(e) {}
    });

    // Aceptar cookies
    try {
      const acceptBtn = await page.waitForSelector('button:has-text("Aceptar"), button:has-text("ACEPTAR"), .cc-btn.cc-allow', { timeout: 3000 });
      if (acceptBtn) await acceptBtn.click();
    } catch (e) {}

    // ── 0. Comprobar si Segona Infantil ya está disponible en FFCV ──────────
    console.log('\n🔍 Comprobando disponibilidad de Segona Regional Infantil (Grupos 1 al 4 de Castelló)...');
    let segonaComp = null;
    try {
      const res = await fetch(`https://ffcv.es/competiciones/api/filtros/competiciones_fetch.php?cod_temporada=${encodeURIComponent(TARGET_TEMPORADA)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res.ok) {
        const data = await res.json();
        const found = (data.competiciones || []).find(c => {
          const n = (c.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return (n.includes('segona') || n.includes('segunda') || n.includes('2a') || n.includes('2ª') || n.includes('2 regional')) &&
                 n.includes('infantil') && !n.includes('futsal') && !n.includes('platja');
        });
        if (found) {
          const grpRes = await fetch(`https://ffcv.es/competiciones/api/filtros/grupos_fetch.php?cod_competicion=${encodeURIComponent(found.codigo)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          if (grpRes.ok) {
            const grpData = await grpRes.json();
            const castellonGroups = (grpData.grupos || []).filter(g => {
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
        }
      }
    } catch (e) {
      console.warn('⚠️ No se pudo consultar la API de competiciones FFCV:', e.message);
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

          // Obtener lista de jornadas del grupo
          const jornadasData = await page.evaluate(async (codGrupo) => {
            try {
              const res = await fetch(`https://ffcv.es/competiciones/api/filtros/jornadas_fetch.php?cod_grupo=${encodeURIComponent(codGrupo)}`);
              return await res.json();
            } catch (e) {
              return { error: e.message };
            }
          }, grp.id);

          const jornadas = Array.isArray(jornadasData?.jornadas) ? jornadasData.jornadas : [];
          console.log(`     Total jornadas: ${jornadas.length}`);

          for (const jor of jornadas) {
            const codJornada = jor.codjornada || jor.nombre;
            const jornadaNombre = `Jornada ${jor.nombre || codJornada}`;

            // Obtener partidos de la jornada
            const partidosData = await page.evaluate(async ({ codGrupo, codJor }) => {
              try {
                const res = await fetch(`https://ffcv.es/competiciones/api/partidos/resultados_por_grupo_jornada_data.php?cod_grupo=${encodeURIComponent(codGrupo)}&cod_jornada=${encodeURIComponent(codJor)}`);
                return await res.json();
              } catch (e) {
                return { error: e.message };
              }
            }, { codGrupo: grp.id, codJor: codJornada });

            const partidosList = Array.isArray(partidosData?.partidos) ? partidosData.partidos : [];

            for (const p of partidosList) {
              // Obtener ficha detallada del partido (árbitros, código de campo, hora confirmada)
              let matchDetail = null;
              let fieldCoords = null;

              if (p.codacta) {
                matchDetail = await page.evaluate(async (codActa) => {
                  try {
                    const res = await fetch(`https://ffcv.es/competiciones/api/partidos/ficha_partido_ajax.php?cod_partido=${encodeURIComponent(codActa)}`);
                    return await res.json();
                  } catch (e) {
                    return null;
                  }
                }, p.codacta);
              }

              const codigoCampo = matchDetail?.codigo_campo || null;
              const fieldName = matchDetail?.campo || p.campo || 'Por determinar';

              // Obtener coordenadas de la instalación/campo (usando cache)
              if (codigoCampo && !fieldsCache.has(codigoCampo)) {
                const fieldData = await page.evaluate(async (codCampo) => {
                  try {
                    const res = await fetch(`https://ffcv.es/competiciones/api/instalaciones/datos_campo.php?Codigo_Campo=${encodeURIComponent(codCampo)}`);
                    return await res.json();
                  } catch (e) {
                    return null;
                  }
                }, codigoCampo);

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

              fieldCoords = codigoCampo ? fieldsCache.get(codigoCampo) : null;

              const fechaPart = parseDate(matchDetail?.fecha || p.fecha);
              const horaPart = parseTime(matchDetail?.hora || p.hora);

              const matchRecord = {
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
              };

              allMatches.push(matchRecord);
            }
            process.stdout.write(`       ${jornadaNombre}: ${partidosList.length} partidos recogidos\r`);
          }
          console.log(`\n     ✅ Grupo ${grp.name} completado.`);
        }
      }
      console.log(`\n🏟️  Total partidos recogidos para la agenda: ${allMatches.length}`);
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

          // Obtener equipos del grupo mediante clasificación
          const classifData = await page.evaluate(async (codGrupo) => {
            try {
              const res = await fetch(`https://ffcv.es/competiciones/api/clasificaciones/clasificaciones_ajax.php?cod_grupo=${encodeURIComponent(codGrupo)}&cod_jornada=1`);
              return await res.json();
            } catch (e) {
              return { error: e.message };
            }
          }, grp.id);

          let equipos = Array.isArray(classifData?.clasificacion)
            ? classifData.clasificacion
            : (Array.isArray(classifData?.clasificaciones) ? classifData.clasificaciones : []);

          console.log(`     ${equipos.length} equipos en el grupo.`);

          let teamCount = 0;
          for (const eq of equipos) {
            if (teamCount >= limitTeams) {
              console.log(`     ⚠️ Límite de equipos alcanzado (--limit-teams ${limitTeams})`);
              break;
            }
            teamCount++;

            const codEquipo = eq.codequipo;
            const nombreEquipo = eq.nombre;
            const crestUrl = formatLogoUrl(eq.url_img);

            console.log(`\n     🏃 [${teamCount}/${Math.min(equipos.length, limitTeams)}] Equipo: ${nombreEquipo} (${codEquipo})`);

            // Obtener plantilla y detalles del equipo
            const teamDetail = await page.evaluate(async (cod) => {
              try {
                const res = await fetch(`https://ffcv.es/competiciones/api/equipos/ver_equipo.php?codequipo=${encodeURIComponent(cod)}`);
                return await res.json();
              } catch (e) {
                return null;
              }
            }, codEquipo);

            const teamInfo = teamDetail?.j || teamDetail || {};
            const jugadores = Array.isArray(teamInfo.jugadores_equipo) ? teamInfo.jugadores_equipo : [];

            allTeams.push({
              id: `ffcv-team-${codEquipo}`,
              ffcv_cod: codEquipo,
              name: nombreEquipo,
              club: teamInfo.nombre_club || nombreEquipo,
              crest_url: crestUrl,
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

            console.log(`        Plantilla: ${jugadores.length} jugadores.`);

            let playerCount = 0;
            for (const j of jugadores) {
              if (playerCount >= limitPlayers) {
                console.log(`        ⚠️ Límite de jugadores alcanzado (--limit-players ${limitPlayers})`);
                break;
              }
              playerCount++;

              const codJugador = j.cod_jugador;
              const nombreJugador = j.nombre;
              const playerUrl = `https://ffcv.es/competiciones/jugadores/jugador.php?codigo=${encodeURIComponent(codJugador)}&cod_competicion=${encodeURIComponent(comp.id)}&cod_grupo=${encodeURIComponent(grp.id)}&cod_temporada=${encodeURIComponent(TARGET_TEMPORADA)}`;

              // Cargar página de la ficha del jugador con auto-reintento y esperas dinámicas
              try {
                const { profileData, history, isWp } = await scrapePlayerWithRetry(page, playerUrl, 2);

                const parsedName = parsePlayerName(nombreJugador);

                if (isWp) {
                  allPlayers.push({
                    id: `ffcv-p-${codJugador}`,
                    ffcv_player_id: codJugador,
                    full_name: parsedName.fullName,
                    first_name: parsedName.firstName,
                    last_name: parsedName.lastName,
                    position: 'Sense definir',
                    team: nombreEquipo,
                    team_id: `ffcv-team-${codEquipo}`,
                    competition: comp.name,
                    group: grp.name,
                    infantil_year: 'Desconocido',
                    history: [],
                    sports_data: {},
                    source_url: playerUrl,
                    scraped_at: new Date().toISOString()
                  });
                  process.stdout.write(`        [${playerCount}/${jugadores.length}] ${parsedName.fullName} -> Ficha privada/no disponible\n`);
                  continue;
                }

                // Determinar el año infantil
                const infantilYear = calculateInfantilYear(history, profileData?.age);

                const playerRecord = {
                  id: `ffcv-p-${codJugador}`,
                  ffcv_player_id: codJugador,
                  full_name: parsedName.fullName,
                  first_name: parsedName.firstName,
                  last_name: parsedName.lastName,
                  position: profileData?.position || 'Sense definir',
                  dorsal: profileData?.dorsal || null,
                  age: profileData?.age || null,
                  photo_url: profileData?.photo || null,
                  team: nombreEquipo,
                  team_id: `ffcv-team-${codEquipo}`,
                  competition: comp.name,
                  group: grp.name,
                  infantil_year: infantilYear,
                  history: history || [],
                  sports_data: profileData?.stats || {},
                  source_url: playerUrl,
                  scraped_at: new Date().toISOString()
                };

                allPlayers.push(playerRecord);
                process.stdout.write(`        [${playerCount}/${jugadores.length}] ${parsedName.fullName} -> ${infantilYear}\n`);
              } catch (playerErr) {
                console.warn(`        ⚠️ Error en jugador ${nombreJugador} (${codJugador}): ${playerErr.message.split('\n')[0]}`);
              }
            }

            // Guardado progresivo por equipo para asegurar persistencia inmediata
            try {
              const dataDir = path.join(__dirname, '..', 'src', 'data');
              ensureDir(dataDir);
              fs.writeFileSync(path.join(dataDir, 'scraped_players.json'), JSON.stringify(allPlayers, null, 2), 'utf8');
              fs.writeFileSync(path.join(dataDir, 'scraped_teams.json'), JSON.stringify(allTeams, null, 2), 'utf8');
            } catch (saveErr) {}
          }
        }
      }
    }

    // ── 3. GUARDAR RESULTADOS LOCALES (JSON) ─────────────────────────────────────
    const dataDir = path.join(__dirname, '..', 'src', 'data');
    ensureDir(dataDir);

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

      // Resumen estadístico de año infantil
      const summaryYears = {
        'Infantil 1er año': allPlayers.filter(p => p.infantil_year === 'Infantil 1er año').length,
        'Infantil 2º año': allPlayers.filter(p => p.infantil_year === 'Infantil 2º año').length,
        'Desconocido': allPlayers.filter(p => p.infantil_year === 'Desconocido').length
      };
      console.log('\n📊 Desglose de Clasificación Infantil:');
      console.log(`   🔹 Infantil 1er año: ${summaryYears['Infantil 1er año']}`);
      console.log(`   🔹 Infantil 2º año:  ${summaryYears['Infantil 2º año']}`);
      console.log(`   🔹 Desconocido:      ${summaryYears['Desconocido']}`);
    }

    // ── 4. SINCRONIZACIÓN CON SUPABASE (SI ESTÁ ACTIVO) ──────────────────────────
    await trySaveToSupabase(allMatches, allTeams, allPlayers);

    console.log('\n✨ ¡Proceso de scraping finalizado con éxito!');

  } catch (err) {
    console.error('\n❌ Error durante el scraping:', err);
  } finally {
    await browser.close();
  }
})();
