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

// Configuración de competiciones solicitadas
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
function calculateInfantilYear(history) {
  if (!history || !Array.isArray(history) || history.length === 0) {
    return 'Desconocido';
  }

  // Buscar temporada 2025-2026 (anterior a la actual 2026-2027)
  const prevSeason = history.find(h => {
    const t = (h.temporada || '').replace(/\s+/g, '');
    return t.includes('2025-2026') || t.includes('25-26') || t.includes('2025/2026');
  });

  if (!prevSeason || !prevSeason.categoria) {
    return 'Desconocido';
  }

  const cat = prevSeason.categoria.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

  // Si en la 2025-2026 era Alevín 2º año -> actualmente es Infantil 1er año
  if (
    cat.includes('alevin 2') ||
    cat.includes('alevi 2') ||
    cat.includes('alevin 2o') ||
    cat.includes('alevin 2do') ||
    cat.includes('alevin 2.') ||
    cat.includes('alevi 2.')
  ) {
    return 'Infantil 1er año';
  }

  // Si en la 2025-2026 ya competía en categoría Infantil -> actualmente es Infantil 2º año
  if (cat.includes('infantil')) {
    return 'Infantil 2º año';
  }

  // Si en la 2025-2026 era Alevín 1er año (jugador adelantado)
  if (cat.includes('alevin 1') || cat.includes('alevi 1')) {
    return 'Infantil 1er año';
  }

  return 'Desconocido';
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

    // Upsert Teams
    if (teams && teams.length > 0) {
      const dbTeams = teams.map(t => ({
        name: t.name,
        club: t.club || t.name,
        crest_url: t.crest_url,
        field_name: t.field_name,
        city: t.city,
        province: t.province || 'Castelló',
        address: t.address,
        latitude: t.latitude,
        longitude: t.longitude
      }));
      const { error: tErr } = await supabase.from('teams').upsert(dbTeams, { onConflict: 'name' });
      if (tErr) console.warn('   ⚠️ Error sincronizando equipos en Supabase:', tErr.message);
      else console.log(`   ✅ ${teams.length} equipos sincronizados en Supabase.`);
    }

    // Upsert Players
    if (players && players.length > 0) {
      const dbPlayers = players.map(p => {
        const names = (p.full_name || '').split(',');
        const lastName = names[0] ? names[0].trim() : '';
        const firstName = names[1] ? names[1].trim() : (p.full_name || '');
        return {
          first_name: firstName,
          last_name: lastName,
          position: p.position || 'Candidato',
          jersey_number: p.jersey_number,
          photo_url: p.photo_url,
          city: p.city || 'Castelló',
          status: 'Candidato',
          sports_data: p.sports_data || {},
          source: 'ffcv_scraping',
          source_player_id: String(p.ffcv_player_id || ''),
          source_url: p.source_url,
          scraped_at: new Date().toISOString()
        };
      });
      const { error: pErr } = await supabase.from('players').upsert(dbPlayers, { onConflict: 'source,source_player_id' });
      if (pErr) console.warn('   ⚠️ Error sincronizando jugadores en Supabase:', pErr.message);
      else console.log(`   ✅ ${players.length} jugadores sincronizados en Supabase.`);
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

(async () => {
  console.log('=====================================================');
  console.log('⚽ SCRAPER FFCV INFANTIL - PARTIDOS, JUGADORES E HISTORIAL');
  console.log('=====================================================');
  console.log(`Temporada objetivo: 2026-2027 (código ${TARGET_TEMPORADA})`);

  const launchOpts = getChromiumLaunchOptions(headless);
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  const fieldsCache = new Map(); // codcampo -> info campo (coordenadas, dirección, etc.)
  const allMatches = [];
  const allTeams = [];
  const allPlayers = [];

  try {
    console.log('\n🌐 Conectando con FFCV...');
    await page.goto('https://ffcv.es/competiciones/#partidos', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Aceptar cookies
    try {
      const acceptBtn = await page.waitForSelector('button:has-text("Aceptar"), button:has-text("ACEPTAR"), .cc-btn.cc-allow', { timeout: 3000 });
      if (acceptBtn) await acceptBtn.click();
    } catch (e) {}

    // ── 0. Comprobar si Segona Infantil ya está disponible en el selector ──────────
    const availableComps = await page.evaluate(() => {
      const sel = document.getElementById('sel-competicion');
      if (!sel) return [];
      return Array.from(sel.options).map(o => ({ id: o.value, name: o.text.trim() }));
    });

    const segonaComp = availableComps.find(c => {
      const n = c.name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
      return n.includes('segona infantil') || n.includes('segunda infantil') || n.includes('2a infantil');
    });

    const competitionsToScrape = [...TARGET_COMPETITIONS];

    if (segonaComp) {
      console.log(`\n🎉 ¡Detectada Segona Infantil en FFCV! (ID: ${segonaComp.id})`);
      // Obtener los grupos de Segona Infantil
      await page.selectOption('#sel-competicion', segonaComp.id);
      await page.waitForTimeout(2000);
      const segonaGroups = await page.evaluate(() => {
        const sel = document.getElementById('sel-grupo');
        if (!sel) return [];
        return Array.from(sel.options).map(o => ({ id: o.value, name: o.text.trim() }));
      });
      // Filtrar grupos 1 a 4
      const targetSegonaGroups = segonaGroups.filter(g => {
        const m = g.name.match(/\b([1-4])\b/);
        return Boolean(m);
      });
      if (targetSegonaGroups.length > 0) {
        console.log(`   Grupos encontrados: ${targetSegonaGroups.map(g => g.name).join(', ')}`);
        competitionsToScrape.push({
          id: segonaComp.id,
          name: segonaComp.name,
          groups: targetSegonaGroups
        });
      }
    } else {
      console.log('ℹ️  Segona Infantil: aún no tiene calendario publicado en FFCV (se sincronizará automáticamente cuando FFCV lo publique).');
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
                const res = await fetch(`https://ffcv.es/competiciones/api/partidos/resultados_por_grupo_jornada_data.php?cod_grupo=${encodeURIComponent(codGrupo)}&jornada=${encodeURIComponent(codJor)}`);
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

          const equipos = Array.isArray(classifData?.clasificacion)
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

              // Cargar página de la ficha del jugador para extraer foto, edad, estadísticas e historial
              try {
                await page.evaluate(url => { window.location.href = url; }, playerUrl);
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 });
                await page.waitForTimeout(1200);

                // Si redirige a WordPress, no hay ficha pública disponible
                if (page.url().includes('/wp')) {
                  allPlayers.push({
                    id: `ffcv-p-${codJugador}`,
                    ffcv_player_id: codJugador,
                    full_name: nombreJugador,
                    team: nombreEquipo,
                    team_id: `ffcv-team-${codEquipo}`,
                    competition: comp.name,
                    group: grp.name,
                    infantil_year: 'Desconocido',
                    history: [],
                    sports_data: {},
                    source_url: playerUrl
                  });
                  continue;
                }

                // Extraer foto, dorsal, edad y estadísticas
                const profileData = await page.evaluate(() => {
                  const photoImg = document.querySelector('img.player-photo');
                  const photo = photoImg ? photoImg.src : null;

                  // Extraer edad de texto: "12 años", "13 años"
                  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                  let node;
                  let age = null;
                  while ((node = walker.nextNode())) {
                    const m = node.nodeValue.match(/(\d+)\s*años?/i);
                    if (m) {
                      age = parseInt(m[1], 10);
                      break;
                    }
                  }

                  // Extraer dorsal
                  const dorsalEl = document.querySelector('.dorsal, .shirt-num, [class*="dorsal"]');
                  const dorsalMatch = (dorsalEl?.textContent || '').match(/\d+/);
                  const dorsal = dorsalMatch ? parseInt(dorsalMatch[0], 10) : null;

                  // Extraer estadísticas de las stat-cards
                  const stats = {};
                  document.querySelectorAll('.stat-card').forEach(card => {
                    const val = card.querySelector('.stat-val')?.textContent?.trim();
                    const lbl = card.querySelector('.stat-lbl')?.textContent?.trim();
                    if (lbl && val !== undefined) stats[lbl] = val;
                  });

                  return { photo, age, dorsal, stats };
                });

                // Clic en pestaña Historial para obtener tabla de trayectorias
                let history = [];
                try {
                  const histTab = page.locator('a.match-tab[href="#history"], [href*="history"]').first();
                  if (await histTab.isVisible({ timeout: 2000 })) {
                    await histTab.click();
                    await page.waitForTimeout(1000);

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
                } catch (histErr) {
                  // Sin historial disponible
                }

                // Determinar el año infantil
                const infantilYear = calculateInfantilYear(history);

                const playerRecord = {
                  id: `ffcv-p-${codJugador}`,
                  ffcv_player_id: codJugador,
                  full_name: nombreJugador,
                  dorsal: profileData.dorsal,
                  age: profileData.age,
                  photo_url: profileData.photo,
                  team: nombreEquipo,
                  team_id: `ffcv-team-${codEquipo}`,
                  competition: comp.name,
                  group: grp.name,
                  infantil_year: infantilYear,
                  history,
                  sports_data: profileData.stats,
                  source_url: playerUrl,
                  scraped_at: new Date().toISOString()
                };

                allPlayers.push(playerRecord);
                process.stdout.write(`        [${playerCount}/${jugadores.length}] ${nombreJugador} -> ${infantilYear}\n`);
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
