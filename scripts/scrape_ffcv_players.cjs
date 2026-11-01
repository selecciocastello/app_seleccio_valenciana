#!/usr/bin/env node
/**
 * Scraping FFCV Infantil - JUGADORES (equipos, plantillas, fichas e historial)
 *
 * Competiciones: ver TARGET_COMPETITIONS en ffcv_common.cjs.
 * Los partidos van aparte, en scrape_ffcv_matches.cjs.
 *
 * Uso:
 *   node scripts/scrape_ffcv_players.cjs [opciones]
 *
 * Opciones:
 *   --limit-teams <n>     Limitar número de equipos por grupo para pruebas
 *   --limit-players <n>   Limitar número de jugadores por equipo para pruebas
 *   --all-players         Volver a descargar la ficha de todos los jugadores (sin rotación)
 *   --rotation            Plantillas por turnos: en cada ejecución solo se procesan los siguientes
 *                         equipos de la rueda (ver "Rotación de equipos" más abajo)
 *   --teams-per-run <n>   Equipos por ejecución en modo --rotation (por defecto 25)
 *
 * Descarga incremental:
 *  - Jugadores: los nuevos se descargan completos (ficha + historial); de los que ya
 *    existen solo se pide la ficha (equipo, dorsal, foto, estadísticas) y en Supabase
 *    solo se escriben los que han cambiado. Los que ya no están en ninguna plantilla se borran.
 *    Para no saturar a la FFCV, la ficha de un jugador ya conocido que sigue en el mismo
 *    equipo y ya tiene foto se pide cada PLAYER_REFRESH_WEEKS semanas (por turnos: cada semana toca a una
 *    parte de los jugadores); el resto de semanas se reutiliza lo que hay en scraped_players.json.
 *  - Todo lo que falla (grupo, equipo o jugador) se apunta y se reintenta al
 *    final de la descarga.
 *
 * Rotación de equipos (--rotation, workflow de lunes a viernes):
 *  - Todos los equipos de las competiciones forman una lista fija (competición, grupo y código
 *    de equipo). Cada ejecución procesa los siguientes --teams-per-run equipos desde donde se
 *    quedó la anterior y, al llegar al final, vuelve a empezar (nuevo ciclo).
 *  - El punto de la rueda se guarda en src/data/scrape_rotation.json. Los equipos que fallan
 *    (o con jugadores que no se han podido descargar) quedan pendientes y van primero al día siguiente.
 *  - Los equipos que no tocan conservan sus datos de scraped_players.json / scraped_teams.json.
 *  - Los jugadores antiguos solo se revisan/borran al cerrar un ciclo completo sin pendientes.
 */

const fs = require('fs');
const path = require('path');
const { toPhotoUrl } = require('./player_photos.cjs');
const { closeFfcv } = require('./ffcv_client.cjs');
const {
  DATA_DIR, TARGET_TEMPORADA, TARGET_SEASON_START_YEAR, TARGET_COMPETITIONS, RETRY_ROUNDS, RETRY_PAUSE_MS,
  sleep, ffcvFetch, mapWithConcurrency, defer, runDeferred, todayInSpain, stableStringify,
  formatLogoUrl, parseDate, ensureDir, selectAll, getSupabase, readJsonArray, readJsonObject
} = require('./ffcv_common.cjs');

// Opciones CLI
const args = process.argv.slice(2);
const limitTeamsIdx = args.indexOf('--limit-teams');
const limitTeams = limitTeamsIdx !== -1 ? parseInt(args[limitTeamsIdx + 1], 10) : Infinity;
const limitPlayersIdx = args.indexOf('--limit-players');
const limitPlayers = limitPlayersIdx !== -1 ? parseInt(args[limitPlayersIdx + 1], 10) : Infinity;
const refreshAllPlayers = args.includes('--all-players');
const rotation = args.includes('--rotation');
const teamsPerRunIdx = args.indexOf('--teams-per-run');
const TEAMS_PER_RUN = teamsPerRunIdx !== -1 ? Math.max(1, parseInt(args[teamsPerRunIdx + 1], 10) || 25) : 25;
const ROTATION_FILE = 'scrape_rotation.json';

// Cada cuántas semanas se vuelve a pedir la ficha de un jugador ya conocido
const PLAYER_REFRESH_WEEKS = 2;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;


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

/**
 * Devuelve Map<source_player_id, position> de los jugadores cuya posición ha editado
 * un seleccionador (position_manual = true). El resto de datos del seleccionador
 * (estado, valoración, posición alternativa, pie, contacto, notas) no hace falta
 * protegerlos: el scraper nunca los envía, así que el upsert no los toca.
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
      if (!row.source_player_id) continue;
      // Sin la columna no sabemos qué es manual: solo se conservan posiciones con valor real
      if (useFallback && (!row.position || ['Sense definir', 'Candidato'].includes(row.position))) continue;
      // Con position_manual se conserva incluso una posición vaciada a propósito ("Sense definir")
      result.set(String(row.source_player_id), row.position || '');
    }
    if (!data || data.length < pageSize) break;
  }
  return result;
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

// Columnas de players que escribe el scraper y se comparan para saber si un jugador ha cambiado
const PLAYER_SYNC_FIELDS = [
  'first_name', 'last_name', 'position', 'jersey_number', 'photo_url', 'team_id', 'city', 'province',
  'is_stale', 'sports_data', 'source_url', 'infantil_year', 'age', 'history'
];

/** Map<source_player_id, fila> de los jugadores del scraper que ya están en la BD, o null si no se pueden leer. */
async function loadDbPlayers(supabase) {
  if (!supabase) return null;
  try {
    const rows = await selectAll(supabase, 'players', ['id', 'source_player_id', ...PLAYER_SYNC_FIELDS].join(', '), (q) => q.eq('source', 'ffcv_scraping'));
    return new Map(rows.filter((r) => r.source_player_id).map((r) => [String(r.source_player_id), r]));
  } catch (err) {
    console.warn(`⚠️ No se han podido leer los jugadores de Supabase (${err.message}). Se descargarán todos completos.`);
    return null;
  }
}

/**
 * Sincroniza con Supabase los equipos y los jugadores nuevos o con algún dato cambiado.
 *  - dbPlayers: jugadores que ya había en la BD (null si no se pudieron leer: se escriben todos)
 *  - keptPlayerIds: jugadores de las plantillas que no se han podido descargar (no se tocan ni se borran)
 */
async function trySaveToSupabase(supabase, teams, players, { playersComplete = false, dbPlayers = null, keptPlayerIds = [] } = {}) {
  if (!supabase) {
    console.log('ℹ️  Supabase no configurado en .env (se omite la sincronización remota a BD).');
    return;
  }

  try {
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

    // 3. Players: altas y cambios (deduplicados por source_player_id)
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

      // Solo se escriben los jugadores nuevos o con algún dato distinto al de la BD
      let created = 0;
      let changed = 0;
      const toWrite = [];
      for (const [sourcePlayerId, row] of playersMap) {
        const current = dbPlayers?.get(sourcePlayerId);
        if (!current) {
          created++;
          toWrite.push(row);
        } else if (PLAYER_SYNC_FIELDS.some((f) => stableStringify(row[f]) !== stableStringify(current[f]))) {
          changed++;
          toWrite.push(row);
        }
      }

      const chunkSize = 100;
      let pSuccess = 0;
      for (let i = 0; i < toWrite.length; i += chunkSize) {
        const chunk = toWrite.slice(i, i + chunkSize);
        const { error: pErr } = await supabase.from('players').upsert(chunk, { onConflict: 'source,source_player_id' });
        if (pErr) console.warn(`   ⚠️ Error sincronizando lote de jugadores (${i}-${i + chunk.length}):`, pErr.message);
        else pSuccess += chunk.length;
      }
      if (dbPlayers) {
        console.log(`   ✅ Jugadores: ${created} nuevos, ${changed} con cambios, ${playersMap.size - created - changed} sin cambios (${pSuccess}/${toWrite.length} escritos).`);
      } else {
        console.log(`   ✅ ${pSuccess}/${toWrite.length} jugadores sincronizados en Supabase.`);
      }
      console.log(`   🔒 ${preservedCount} posiciones editadas a mano conservadas.`);

      if (!playersComplete) {
        console.log('   ℹ️  Descarga de plantillas incompleta o limitada: no se revisan jugadores antiguos.');
      } else if (pSuccess < toWrite.length) {
        console.warn('   ⚠️ Hubo errores sincronizando jugadores: no se revisan jugadores antiguos.');
      } else {
        const rosterIds = new Set([...playersMap.keys(), ...keptPlayerIds.map(String)]);
        await reconcileStalePlayers(supabase, rosterIds, teamNameToId);
      }
    }
  } catch (err) {
    console.warn('   ⚠️ Error conectando con Supabase:', err.message);
  }
}

/**
 * Sincroniza un único equipo y sus jugadores con Supabase inmediatamente tras rasparlo.
 * Permite guardado progresivo equipo a equipo para que ninguna interrupción pierda datos.
 */
async function syncTeamAndPlayersToSupabase(supabase, teamRecord, teamPlayers, { dbPlayers, manualPositions }) {
  if (!supabase || !teamRecord || !teamRecord.name) return;
  try {
    const teamDbRow = {
      name: teamRecord.name.trim(),
      club: teamRecord.club || teamRecord.name.trim(),
      crest_url: teamRecord.crest_url || null,
      field_name: teamRecord.field_name || null,
      city: teamRecord.city && teamRecord.city !== '0' ? teamRecord.city : 'Castelló',
      province: teamRecord.province && teamRecord.province !== 'Otra' ? teamRecord.province : 'Castelló',
      address: teamRecord.address || null,
      latitude: teamRecord.latitude ? parseFloat(teamRecord.latitude) : null,
      longitude: teamRecord.longitude ? parseFloat(teamRecord.longitude) : null
    };

    const { data: upsertedTeams, error: tErr } = await supabase
      .from('teams')
      .upsert([teamDbRow], { onConflict: 'name' })
      .select('id, name');

    if (tErr) {
      console.warn(`        ⚠️ Error sincronizando equipo ${teamRecord.name} a Supabase:`, tErr.message);
    }

    const teamId = upsertedTeams?.[0]?.id || null;

    if (teamPlayers && teamPlayers.length > 0) {
      const playersMap = new Map();
      for (const p of teamPlayers) {
        const sourcePlayerId = String(p.ffcv_player_id || p.source_player_id || p.id || '');
        if (!sourcePlayerId) continue;

        const { firstName, lastName } = parsePlayerName(p.full_name);

        let cleanJersey = null;
        if (p.dorsal != null && p.dorsal !== '') {
          const num = parseInt(p.dorsal, 10);
          if (!isNaN(num) && num > 0 && num <= 99) {
            cleanJersey = num;
          }
        }

        let position = p.position || 'Candidato';
        if (manualPositions && manualPositions.has(sourcePlayerId)) {
          position = manualPositions.get(sourcePlayerId);
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

      const toWrite = [];
      let newCount = 0;
      let changedCount = 0;
      for (const [sourcePlayerId, row] of playersMap) {
        const current = dbPlayers?.get(sourcePlayerId);
        if (!current) {
          newCount++;
          toWrite.push(row);
        } else if (PLAYER_SYNC_FIELDS.some((f) => stableStringify(row[f]) !== stableStringify(current[f]))) {
          changedCount++;
          toWrite.push(row);
        }
      }

      if (toWrite.length > 0) {
        const chunkSize = 100;
        let pSuccess = 0;
        for (let i = 0; i < toWrite.length; i += chunkSize) {
          const chunk = toWrite.slice(i, i + chunkSize);
          const { error: pErr } = await supabase.from('players').upsert(chunk, { onConflict: 'source,source_player_id' });
          if (pErr) console.warn(`        ⚠️ Error sincronizando lote de jugadores a Supabase:`, pErr.message);
          else pSuccess += chunk.length;
        }
        console.log(`        📡 Supabase: ${pSuccess}/${toWrite.length} jugadores subidos (${newCount} nuevos, ${changedCount} con cambios).`);

        if (dbPlayers) {
          for (const row of toWrite) {
            dbPlayers.set(String(row.source_player_id), row);
          }
        }
      } else {
        console.log(`        📡 Supabase: ${playersMap.size} jugadores al día en Supabase.`);
      }
    }
  } catch (err) {
    console.warn(`        ⚠️ Error en sincronización progresiva del equipo ${teamRecord?.name}:`, err.message);
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

/**
 * Obtiene ficha + historial de un jugador y construye su registro.
 * Si ya lo conocemos (`known`) y tiene historial, solo se pide la ficha: el historial y
 * el año de nacimiento no cambian durante la temporada.
 */
async function scrapePlayer({ codJugador, nombreJugador, codEquipo, nombreEquipo, comp, grp, known }) {
  const playerUrl = `https://ffcv.es/competiciones/jugadores/jugador.php?codigo=${encodeURIComponent(codJugador)}&cod_competicion=${encodeURIComponent(comp.id)}&cod_grupo=${encodeURIComponent(grp.id)}&cod_temporada=${encodeURIComponent(TARGET_TEMPORADA)}`;
  const cod = encodeURIComponent(codJugador);
  const temp = encodeURIComponent(TARGET_TEMPORADA);
  const needsHistory = !known || !Array.isArray(known.history) || known.history.length === 0;

  const playerApi = await ffcvFetch(`jugadores/jugador_api.php?codigo=${cod}&cod_temporada=${temp}`);
  const historyApi = needsHistory
    ? await ffcvFetch(`jugadores/historial_deportivo.php?cod_licencia=${cod}&cod_temporada=${temp}`)
    : null;

  const parsedName = parsePlayerName(nombreJugador);
  const history = needsHistory ? buildHistory(historyApi) : known.history;
  const hasProfile = isValidProfile(playerApi);
  const age = hasProfile ? parseInt(playerApi.edad, 10) : NaN;
  const birthYear = parseBirthYear(playerApi, historyApi) ?? known?.birth_year ?? null;

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
    birth_date: needsHistory ? parseDate(historyApi?.fecha_nacimiento) : (known.birth_date ?? null),
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
    _incomplete: !hasProfile || (needsHistory && !historyApi)
  };
}

(async () => {
  console.log('=====================================================');
  console.log('👥 SCRAPER FFCV INFANTIL - EQUIPOS, JUGADORES E HISTORIAL');
  console.log('=====================================================');
  console.log(`Temporada objetivo: 2026-2027 (código ${TARGET_TEMPORADA})`);
  const startedAt = Date.now();
  const today = todayInSpain();
  console.log(`Fecha del scraping: ${today}`);

  const supabase = getSupabase();
  const teamsByCode = new Map();
  const playersById = new Map();
  const keptPlayerIds = []; // en plantilla pero sin poder descargar: se dejan como están en la BD
  const notUpdated = [];
  // Solo si se recorren todas las plantillas sin fallos se revisan/borran jugadores antiguos
  let playersComplete = limitTeams === Infinity && limitPlayers === Infinity;
  const dataDir = DATA_DIR;
  ensureDir(dataDir);

  // Modo --rotation: jugadores de los equipos procesados en esta ejecución (los únicos que se
  // escriben en Supabase al final), ids de todas las plantillas conocidas (para revisar antiguos)
  // y guardado del punto de la rueda tras los reintentos.
  const touchedPlayerIds = new Set();
  let rosterPlayerIds = null;
  let saveRotationState = null;

  try {
    const competitionsToScrape = [...TARGET_COMPETITIONS];

    // ── 1. EQUIPOS, PLANTILLAS E HISTORIAL ───────────────────────────────────────
    let dbPlayers = null;
    console.log('========================================');

    // Jugadores ya conocidos (BD y JSON anterior): de ellos no hace falta volver a pedir el historial
    dbPlayers = await loadDbPlayers(supabase);
    const manualPositions = supabase ? await fetchManualPositions(supabase) : new Map();
    const knownPlayers = new Map();
    const previousRecords = new Map(); // registro completo del último scraping (JSON)
    for (const p of readJsonArray(path.join(dataDir, 'scraped_players.json'))) {
      if (!p.ffcv_player_id) continue;
      knownPlayers.set(String(p.ffcv_player_id), p);
      previousRecords.set(String(p.ffcv_player_id), p);
    }
    for (const [id, row] of dbPlayers || []) {
      const fromJson = knownPlayers.get(id);
      const history = Array.isArray(row.history) && row.history.length > 0 ? row.history : fromJson?.history;
      knownPlayers.set(id, { ...fromJson, history });
    }
    if (dbPlayers) console.log(`ℹ️  ${dbPlayers.size} jugadores ya en Supabase: de ellos solo se actualizan los datos que cambien.`);

    const logPlayer = (player, isNew, incomplete) => {
      const extra = [
        isNew ? '🆕 nuevo' : null,
        player.dorsal ? `#${player.dorsal}` : null,
        player.position !== 'Sense definir' ? player.position : null,
        incomplete ? '⚠️ datos incompletos' : null
      ].filter(Boolean).join(', ');
      console.log(`        ${player.full_name} -> ${player.infantil_year}${extra ? ` (${extra})` : ''}`);
    };

    // Equipos con algún jugador que no se ha podido descargar (en rotación quedan pendientes)
    const teamsWithFailedPlayers = new Set();

    /**
     * Registro anterior reutilizable sin pedir nada a la FFCV: jugador ya conocido, en el
     * mismo equipo, con foto, descargado hace menos de PLAYER_REFRESH_WEEKS semanas y al que no le
     * toca turno esta semana (el turno sale del código del jugador, así cada semana se
     * refresca una parte distinta de la plantilla).
     */
    const reusableRecord = (id, codEquipo, isNew) => {
      if (refreshAllPlayers || isNew) return null;
      const prev = previousRecords.get(id);
      if (!prev || prev.team_id !== `ffcv-team-${codEquipo}` || !prev.scraped_at) return null;
      if (!Array.isArray(prev.history) || prev.history.length === 0) return null;
      // Sin foto: se pide cada semana por si el club ya la ha subido a la FFCV
      if (!prev.photo_url) return null;
      const age = Date.now() - new Date(prev.scraped_at).getTime();
      if (!(age >= 0 && age < PLAYER_REFRESH_WEEKS * WEEK_MS - 12 * 60 * 60 * 1000)) return null;
      const week = Math.floor(Date.now() / WEEK_MS);
      if ((week + Number(id)) % PLAYER_REFRESH_WEEKS === 0) return null;
      return prev;
    };
    let reusedPlayers = 0;

    const processPlayer = async (ctx) => {
      const id = String(ctx.codJugador);
      const known = knownPlayers.get(id);
      const isNew = !(dbPlayers ? dbPlayers.has(id) : known);

      const prev = reusableRecord(id, ctx.codEquipo, isNew);
      if (prev) {
        playersById.set(id, { ...prev, team: ctx.nombreEquipo, competition: ctx.comp.name, group: ctx.grp.name });
        reusedPlayers++;
        return;
      }
      let lastRecord = null;

      const run = async () => {
        const rec = await scrapePlayer({ ...ctx, known }).catch((err) => {
          console.warn(`        ⚠️ Error en jugador ${ctx.nombreJugador} (${id}): ${err.message}`);
          return null;
        });
        if (!rec) return false;
        const { _incomplete, ...player } = rec;
        lastRecord = player;
        if (_incomplete) return false;
        playersById.set(id, player);
        return true;
      };

      const ok = await run();
      if (lastRecord) logPlayer(lastRecord, isNew, !ok);
      if (ok) return;
      defer(`Jugador ${ctx.nombreJugador} (${id}) de ${ctx.nombreEquipo}`, run, () => {
        // Si ya existía se deja como está; si es nuevo se da de alta con lo que se tenga
        if (!isNew || !lastRecord) keptPlayerIds.push(id);
        else playersById.set(id, lastRecord);
        teamsWithFailedPlayers.add(String(ctx.codEquipo));
      });
    };

    /** Ficha y plantilla de un equipo. false si la FFCV no ha devuelto el equipo. */
    const processTeam = async (comp, grp, eq) => {
      const codEquipo = eq.codequipo;
      const nombreEquipo = eq.nombre;
      const teamDetail = await ffcvFetch(`equipos/ver_equipo.php?codequipo=${encodeURIComponent(codEquipo)}`);
      if (!teamDetail) return false;
      const teamInfo = teamDetail?.j || teamDetail || {};
      const jugadores = Array.isArray(teamInfo.jugadores_equipo) ? teamInfo.jugadores_equipo : [];

      teamsByCode.set(String(codEquipo), {
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
      const newCount = playersToScrape.filter((j) => !(dbPlayers ? dbPlayers.has(String(j.cod_jugador)) : knownPlayers.has(String(j.cod_jugador)))).length;
      console.log(`        Plantilla: ${jugadores.length} jugadores (${newCount} nuevos).`);

      // Jugadores que constaban en este equipo (ejecución anterior) y ya no están en su plantilla
      if (jugadores.length > 0) {
        const rosterIds = new Set(jugadores.map((j) => String(j.cod_jugador)));
        for (const [id, p] of playersById) {
          if (p.team_id === `ffcv-team-${codEquipo}` && !rosterIds.has(id)) playersById.delete(id);
        }
      }
      for (const j of playersToScrape) touchedPlayerIds.add(String(j.cod_jugador));

      const reusedBefore = reusedPlayers;
      await mapWithConcurrency(playersToScrape, 1, (j) =>
        processPlayer({ codJugador: j.cod_jugador, nombreJugador: j.nombre, codEquipo, nombreEquipo, comp, grp })
      );
      if (reusedPlayers > reusedBefore) {
        console.log(`        ♻️ ${reusedPlayers - reusedBefore} jugadores sin cambios de equipo reutilizados (se refrescan por turnos cada ${PLAYER_REFRESH_WEEKS} semanas).`);
      }

      // Guardado progresivo por equipo local (JSON)
      fs.writeFileSync(path.join(dataDir, 'scraped_players.json'), JSON.stringify([...playersById.values()], null, 2), 'utf8');
      fs.writeFileSync(path.join(dataDir, 'scraped_teams.json'), JSON.stringify([...teamsByCode.values()], null, 2), 'utf8');

      // Guardado progresivo a Supabase equipo a equipo inmediatamente
      if (supabase) {
        const teamRecord = teamsByCode.get(String(codEquipo));
        const teamScrapedPlayers = playersToScrape
          .map((j) => playersById.get(String(j.cod_jugador)))
          .filter(Boolean);
        await syncTeamAndPlayersToSupabase(supabase, teamRecord, teamScrapedPlayers, { dbPlayers, manualPositions });
      }
      return true;
    };

    const teamTask = (comp, grp, eq, onGiveUp = () => {}) => {
      const label = `Equipo ${eq.nombre} (${eq.codequipo})`;
      defer(label, () => processTeam(comp, grp, eq), () => {
        playersComplete = false;
        notUpdated.push(label);
        onGiveUp();
      });
    };

    /** Equipos de un grupo según la clasificación, o null si la FFCV no los ha devuelto. */
    const fetchGroupTeams = async (grp) => {
      const classifData = await ffcvFetch(`clasificaciones/clasificaciones_ajax.php?cod_grupo=${encodeURIComponent(grp.id)}&cod_jornada=1`);
      const equipos = Array.isArray(classifData?.clasificacion)
        ? classifData.clasificacion
        : (Array.isArray(classifData?.clasificaciones) ? classifData.clasificaciones : []);
      return equipos.length > 0 ? equipos : null;
    };

    /** Equipos de un grupo (vía clasificación). false si la FFCV no los ha devuelto. */
    const processGroupTeams = async (comp, grp) => {
      const equipos = await fetchGroupTeams(grp);
      if (!equipos) return false;

      console.log(`     ${equipos.length} equipos en el grupo.`);
      const teamsToScrape = equipos.slice(0, limitTeams);
      if (equipos.length > teamsToScrape.length) {
        console.log(`     ⚠️ Límite de equipos aplicado (--limit-teams ${limitTeams})`);
      }

      for (let t = 0; t < teamsToScrape.length; t++) {
        const eq = teamsToScrape[t];
        console.log(`\n     🏃 [${t + 1}/${teamsToScrape.length}] Equipo: ${eq.nombre} (${eq.codequipo})`);
        if (!(await processTeam(comp, grp, eq))) {
          console.log('        ⚠️ Sin respuesta de la FFCV, se reintentará al final');
          teamTask(comp, grp, eq);
        }
      }
      return true;
    };

    /**
     * Modo --rotation: procesa los siguientes TEAMS_PER_RUN equipos de la rueda (primero los
     * pendientes del día anterior). El resto de equipos conserva lo que había en los JSON.
     */
    const runRotation = async () => {
      const rotationPath = path.join(dataDir, ROTATION_FILE);
      const state = readJsonObject(rotationPath) || {};
      const cachedTeams = Array.isArray(state.teams) ? state.teams : [];

      // 1. Lista completa de equipos en orden fijo (competición, grupo, código de equipo)
      console.log('\n🔄 Modo rotación: obteniendo la lista de equipos de todos los grupos...');
      const allTeams = [];
      const seen = new Set();
      let listComplete = true;
      for (const comp of competitionsToScrape) {
        for (const grp of comp.groups) {
          let equipos = await fetchGroupTeams(grp);
          if (!equipos) {
            await sleep(RETRY_PAUSE_MS);
            equipos = await fetchGroupTeams(grp);
          }
          let groupTeams;
          if (equipos) {
            groupTeams = equipos.map((eq) => ({ cod: String(eq.codequipo), name: eq.nombre, url_img: eq.url_img || null }));
          } else {
            // Sin respuesta: se usa la lista guardada del grupo para no descolocar la rueda
            listComplete = false;
            groupTeams = cachedTeams.filter((t) => t.grp_id === grp.id);
            console.warn(`  ⚠️ ${comp.name} ${grp.name}: sin respuesta de la FFCV, se usan los ${groupTeams.length} equipos guardados.`);
          }
          groupTeams.sort((a, b) => Number(a.cod) - Number(b.cod) || a.cod.localeCompare(b.cod));
          for (const t of groupTeams) {
            if (!t.cod || seen.has(t.cod)) continue;
            seen.add(t.cod);
            allTeams.push({ cod: t.cod, name: t.name, url_img: t.url_img || null, comp_id: comp.id, grp_id: grp.id });
          }
        }
      }
      if (allTeams.length === 0) {
        throw new Error('No se ha obtenido ningún equipo de la FFCV (¿acceso bloqueado?).');
      }
      const total = allTeams.length;
      const byCod = new Map(allTeams.map((t) => [t.cod, t]));

      // 2. Datos anteriores de los equipos que siguen en las competiciones
      const teamIds = new Set(allTeams.map((t) => `ffcv-team-${t.cod}`));
      for (const t of readJsonArray(path.join(dataDir, 'scraped_teams.json'))) {
        if (byCod.has(String(t.ffcv_cod))) teamsByCode.set(String(t.ffcv_cod), t);
      }
      for (const p of readJsonArray(path.join(dataDir, 'scraped_players.json'))) {
        if (p.ffcv_player_id && teamIds.has(p.team_id)) playersById.set(String(p.ffcv_player_id), p);
      }

      // 3. Tanda de hoy: pendientes primero y después los siguientes de la rueda
      const start = byCod.has(String(state.next_cod))
        ? allTeams.findIndex((t) => t.cod === String(state.next_cod))
        : (Number.isInteger(state.cursor) && state.cursor >= 0 ? state.cursor % total : 0);
      const pending = [...new Set((state.pending || []).map(String))].filter((c) => byCod.has(c));
      const batch = pending.slice(0, TEAMS_PER_RUN).map((c) => byCod.get(c));
      const carried = pending.slice(batch.length);
      const inBatch = new Set(batch.map((t) => t.cod));
      const fromPending = batch.length;
      let idx = start;
      let advanced = 0;
      let wrapped = false;
      while (batch.length < TEAMS_PER_RUN && advanced < total) {
        const t = allTeams[idx];
        if (!inBatch.has(t.cod)) {
          batch.push(t);
          inBatch.add(t.cod);
        }
        advanced++;
        idx = (idx + 1) % total;
        if (idx === 0) wrapped = true;
      }
      const cycle = Number.isInteger(state.cycle) ? state.cycle : 1;
      const end = start + advanced;
      const range = advanced === 0 ? 'ninguno' : end > total ? `${start + 1}-${total} y 1-${end - total}` : `${start + 1}-${end}`;
      console.log(`   ${total} equipos en total. Ciclo ${cycle}: equipos ${range} de la rueda` +
        `${fromPending ? ` + ${fromPending} pendiente(s) del día anterior` : ''}${carried.length ? ` (${carried.length} pendientes quedan para mañana)` : ''}.`);
      if (wrapped) console.log('   🏁 Esta tanda cierra el ciclo: al terminar se revisan los jugadores antiguos.');

      // Solo al cerrar un ciclo completo, con la lista entera y sin pendientes, se revisan antiguos
      playersComplete = playersComplete && wrapped && listComplete && carried.length === 0;

      // 4. Procesar la tanda
      const compById = new Map(competitionsToScrape.map((c) => [c.id, c]));
      const failedTeams = new Set();
      for (let i = 0; i < batch.length; i++) {
        const t = batch[i];
        const comp = compById.get(t.comp_id);
        const grp = comp.groups.find((g) => g.id === t.grp_id);
        const eq = { codequipo: t.cod, nombre: t.name, url_img: t.url_img };
        console.log(`\n     🏃 [${i + 1}/${batch.length}] ${comp.name} ${grp.name} · Equipo: ${t.name} (${t.cod})`);
        if (!(await processTeam(comp, grp, eq))) {
          console.log('        ⚠️ Sin respuesta de la FFCV, se reintentará al final');
          teamTask(comp, grp, eq, () => failedTeams.add(t.cod));
        }
      }

      rosterPlayerIds = () => [...playersById.keys()];
      // Se llama tras los reintentos: guarda el punto de la rueda y los pendientes
      saveRotationState = () => {
        for (const cod of teamsWithFailedPlayers) if (inBatch.has(cod)) failedTeams.add(cod);
        const nextPending = [...new Set([...carried, ...failedTeams])];
        const nextState = {
          next_cod: allTeams[idx].cod,
          cursor: idx,
          cycle: wrapped ? cycle + 1 : cycle,
          cycle_started_at: wrapped ? today : (state.cycle_started_at || today),
          teams_per_run: TEAMS_PER_RUN,
          total_teams: total,
          pending: nextPending,
          last_run: {
            date: today,
            teams: batch.map((t) => t.cod),
            failed: [...failedTeams],
            closed_cycle: wrapped
          },
          teams: allTeams
        };
        fs.writeFileSync(rotationPath, JSON.stringify(nextState, null, 2), 'utf8');
        console.log(`\n🔄 Rotación guardada: mañana se empieza por ${allTeams[idx].name} (${idx + 1}/${total})` +
          `${nextPending.length ? `, con ${nextPending.length} equipo(s) pendiente(s) delante` : ''}.`);
      };
    };

    if (rotation) {
      await runRotation();
    } else {
      for (const comp of competitionsToScrape) {
        console.log(`\n🏆 ${comp.name} (${comp.id})`);
        for (const grp of comp.groups) {
          console.log(`  🔹 Obteniendo equipos de ${grp.name}...`);
          if (await processGroupTeams(comp, grp)) continue;
          const label = `Equipos ${comp.name} ${grp.name}`;
          console.log('     ⚠️ No se han podido obtener los equipos, se reintentará al final');
          defer(label, () => processGroupTeams(comp, grp), () => {
            playersComplete = false;
            notUpdated.push(label);
          });
        }
      }
    }

    // ── 2. REINTENTO DE LO QUE HA FALLADO ────────────────────────────────────────
    const stillFailed = await runDeferred();
    if (stillFailed.length > 0) {
      console.warn(`\n⚠️ Siguen fallando tras ${RETRY_ROUNDS} reintentos (se mantienen los datos anteriores):`);
      for (const label of stillFailed) console.warn(`   - ${label}`);
    }
    if (saveRotationState) saveRotationState();

    const allTeams = [...teamsByCode.values()];
    const allPlayers = [...playersById.values()];
    // En rotación solo se escriben en Supabase los jugadores de los equipos procesados hoy: los
    // demás vienen del JSON anterior y no deben pisar lo que haya en la BD
    const playersToSync = rotation
      ? [...touchedPlayerIds].map((id) => playersById.get(id)).filter(Boolean)
      : allPlayers;

    // ── 3. GUARDAR RESULTADOS LOCALES (JSON) ─────────────────────────────────────
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
      console.log(`   🔹 Con foto:         ${allPlayers.filter(p => p.photo_url).length}`);
    }

    // ── 4. SINCRONIZACIÓN CON SUPABASE (SI ESTÁ ACTIVO) ──────────────────────────
    if (allTeams.length === 0) {
      throw new Error('No se ha obtenido ningún equipo de la FFCV (¿acceso bloqueado?). No se sincroniza nada.');
    }
    await trySaveToSupabase(supabase, allTeams, playersToSync, {
      playersComplete,
      dbPlayers,
      keptPlayerIds: rosterPlayerIds ? [...keptPlayerIds, ...rosterPlayerIds()] : keptPlayerIds
    });

    if (notUpdated.length > 0) {
      console.warn(`\n⚠️ No actualizados en esta ejecución: ${notUpdated.join('; ')}`);
    }
    console.log(`\n✨ ¡Scraping de jugadores finalizado en ${Math.round((Date.now() - startedAt) / 1000)}s!`);

  } catch (err) {
    console.error('\n❌ Error durante el scraping de jugadores:', err);
    process.exitCode = 1;
  } finally {
    await closeFfcv();
  }
})();
