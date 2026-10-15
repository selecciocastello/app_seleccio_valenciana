/**
 * Partidos observados -> jugadores observados y reconciliación de comentarios por dorsal.
 *
 * 1. Jugadores observados:
 *    Cuando un seleccionador marca un partido de la agenda como 'Observat', pasados MIN_DAYS_AFTER_MATCH
 *    días de jugarse se lee el acta de la FFCV (ficha_partido_ajax.php?cod_partido={codacta}) y se
 *    pasan a 'Observado' los jugadores de los equipos vistos que JUGARON el partido.
 *
 * 2. Reconciliación automática de comentarios por dorsal:
 *    Cuando en la agenda un seleccionador anota un comentario por dorsal (en directo o antes de tener
 *    los datos oficiales del partido):
 *    - Comprueba quién llevaba realmente ese dorsal en el acta oficial de la FFCV.
 *    - REGLA 1 (Coincide): Si en la base de datos ya coincide con ese jugador, se le añade el comentario,
 *      valoración y estado asignados por el seleccionador.
 *    - REGLA 2 (No está en BD): Si ese dorsal/jugador no existe aún en la base de datos (o solo existía una
 *      ficha provisional "Dorsal #X"), se obtiene su ficha completa e historial de la FFCV API y se crea
 *      su ficha en Supabase con los datos del partido y la valoración del seleccionador.
 *    - REGLA 3 (No coincide): Si en la BD el dorsal pertenecía a otro jugador pero en el partido lo llevaba
 *      otro según el acta, se traslada el comentario y valoración al jugador que corresponde por nombre
 *      en el acta, retirándolo del jugador previo erróneo.
 *
 * Uso:
 *   node scripts/process_observed_matches.cjs              procesa los pendientes
 *   node scripts/process_observed_matches.cjs --all        reprocesa todos los observados
 *   node scripts/process_observed_matches.cjs --dry-run    muestra qué haría, sin escribir en BD
 *   node scripts/process_observed_matches.cjs --codacta 26482437 [--teams "Castellón B,Villarreal B"]
 */

const fs = require('fs');
const path = require('path');

if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}
const { createClient } = require('@supabase/supabase-js');
const { ffcvApiGet, closeFfcv } = require('./ffcv_client.cjs');
const { toPhotoUrl } = require('./player_photos.cjs');

const TARGET_TEMPORADA = '22'; // 2026-2027
const TARGET_SEASON_START_YEAR = 2026;

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const testCodacta = argValue('--codacta');
const testTeams = argValue('--teams');
const dryRun = args.includes('--dry-run') || Boolean(testCodacta);
const processAll = args.includes('--all');
const MIN_DAYS_AFTER_MATCH = parseInt(argValue('--min-days') || '2', 10);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Posiciones de la FFCV -> posiciones canónicas de la app
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
  if (!text) return 'Sense definir';
  const mapped = POSITION_MAP[text.toLowerCase()];
  if (mapped) return mapped;
  return text.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

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

function formatLogoUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `https://appwebffcv.novanet.es${s}`;
  return `https://appwebffcv.novanet.es/${s}`;
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

function parseBirthYear(playerApi, historyApi) {
  const fromApi = parseInt(playerApi?.anio_nacimiento, 10);
  if (!isNaN(fromApi)) return fromApi;
  const m = String(historyApi?.fecha_nacimiento || '').match(/(\d{4})$/);
  return m ? parseInt(m[1], 10) : null;
}

function isAlevin1erAno(categoria) {
  if (!categoria) return false;
  const cat = categoria.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const isAlevin = cat.includes('alevin') || cat.includes('alevi');
  if (!isAlevin) return false;
  const is1st = cat.includes('1er') || cat.includes('1r') || cat.includes('primer') || cat.includes('1.er');
  const is2nd = cat.includes('2o') || cat.includes('2n') || cat.includes('segund') || cat.includes('2º') || cat.includes('2.');
  return is1st && !is2nd;
}

function isAlevin2oAno(categoria) {
  if (!categoria) return false;
  const cat = categoria.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const isAlevin = cat.includes('alevin') || cat.includes('alevi');
  if (!isAlevin) return false;
  const is2nd = cat.includes('2o') || cat.includes('2n') || cat.includes('segund') || cat.includes('2º') || cat.includes('2.');
  const is1st = cat.includes('1er') || cat.includes('1r') || cat.includes('primer') || cat.includes('1.er');
  return is2nd || !is1st;
}

function calculateInfantilYear(history, age, birthYear) {
  if (typeof birthYear === 'number' && !isNaN(birthYear)) {
    const infantil2Year = TARGET_SEASON_START_YEAR - 13;
    if (birthYear <= infantil2Year) return 'Infantil 2º año';
    if (birthYear === infantil2Year + 1) return 'Infantil 1er año';
    return 'Alevín 2º año';
  }
  if (history && Array.isArray(history) && history.length > 0) {
    const s2526 = history.find((h) => (h.temporada || '').includes('2025-2026') || (h.temporada || '').includes('25-26'));
    const s2425 = history.find((h) => (h.temporada || '').includes('2024-2025') || (h.temporada || '').includes('24-25'));
    if (s2526 && isAlevin1erAno(s2526.categoria)) return 'Alevín 2º año';
    if (s2526 && isAlevin2oAno(s2526.categoria)) return 'Infantil 1er año';
    if (s2425 && isAlevin1erAno(s2425.categoria)) return 'Infantil 1er año';
    if (s2526 && (s2526.categoria || '').toLowerCase().includes('infantil')) return 'Infantil 2º año';
  }
  if (typeof age === 'number' && !isNaN(age)) {
    if (age <= 11) return 'Alevín 2º año';
    if (age === 12) return 'Infantil 1er año';
    if (age >= 13) return 'Infantil 2º año';
  }
  return 'Desconocido';
}

function buildStats(playerApi) {
  const stats = {};
  for (const item of [...(playerApi?.partidos || []), ...(playerApi?.tarjetas || [])]) {
    if (!item || !item.nombre) continue;
    stats[item.nombre] = String(item.valor ?? '0');
  }
  if (playerApi?.minutos_totales_jugados != null) stats['Minutos'] = String(playerApi.minutos_totales_jugados);
  return stats;
}

async function fetchActa(codacta) {
  const endpoint = `partidos/ficha_partido_ajax.php?cod_partido=${encodeURIComponent(codacta)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await ffcvApiGet(endpoint);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      return res.data;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return null;
}

async function fetchPlayerDetail(codJugador) {
  const cod = encodeURIComponent(codJugador);
  const temp = encodeURIComponent(TARGET_TEMPORADA);
  const [playerRes, historyRes] = await Promise.all([
    ffcvApiGet(`jugadores/jugador_api.php?codigo=${cod}&cod_temporada=${temp}`).catch(() => ({ data: null })),
    ffcvApiGet(`jugadores/historial_deportivo.php?cod_licencia=${cod}&cod_temporada=${temp}`).catch(() => ({ data: null }))
  ]);
  return {
    playerApi: playerRes?.data,
    historyApi: historyRes?.data
  };
}

/** Extrae jugadores convocados y jugadores que jugaron (titulares + suplentes que entraron) con sus dorsales. */
function playedBySide(acta) {
  const side = (players, subs) => {
    const entered = new Set((subs || []).map((s) => String(s.codjugador_entra)));
    const list = players || [];
    const parseNum = (d) => {
      const n = parseInt(String(d || '').trim(), 10);
      return !isNaN(n) && n > 0 && n <= 99 ? n : null;
    };
    return {
      called: list.length,
      allPlayers: list.map((p) => ({
        id: String(p.codjugador),
        name: p.nombre_jugador || p.nombre_visible,
        dorsal: parseNum(p.dorsal),
        starter: String(p.titular) === '1',
        played: String(p.titular) === '1' || entered.has(String(p.codjugador)),
        position: p.posicion || p.posicion_campo || null
      })),
      played: list
        .filter((p) => String(p.titular) === '1' || entered.has(String(p.codjugador)))
        .map((p) => ({
          id: String(p.codjugador),
          name: p.nombre_jugador || p.nombre_visible,
          dorsal: parseNum(p.dorsal),
          starter: String(p.titular) === '1'
        }))
    };
  };
  return {
    home: { team: acta.equipo_local, ...side(acta.jugadores_equipo_local, acta.sustituciones_equipo_local) },
    away: { team: acta.equipo_visitante, ...side(acta.jugadores_equipo_visitante, acta.sustituciones_equipo_visitante) }
  };
}

function observedSides(sides, observedTeams) {
  const wanted = (observedTeams || []).map(normalizeName).filter(Boolean);
  if (wanted.length === 0) return [sides.home, sides.away];
  return [sides.home, sides.away].filter((s) => wanted.includes(normalizeName(s.team)));
}

function parseActaDate(fecha) {
  const m = String(fecha || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
}

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

/** Pasa a 'Observado' a los que están como 'Candidato'. */
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
      .or('status.is.null,status.eq.Candidato');
    if (upErr) throw new Error(`actualizando jugadores: ${upErr.message}`);
  }
  return { inDb, promoted: toPromote };
}

// Orden de los estados que puede poner un analista: una valoración por dorsal nunca baja
// a un jugador (si ya estaba Preseleccionado no pasa a Interesante).
const STATUS_RANK = { Candidato: 0, Observado: 1, Interesante: 2, Preseleccionado: 3, Seleccionado: 4 };

function mergedStatus(current, wanted) {
  if (!wanted || !(wanted in STATUS_RANK)) return current === 'Candidato' || !current ? 'Observado' : current;
  if (current && !(current in STATUS_RANK)) return current; // No seleccionado, Lesionado, Inactivo
  return (STATUS_RANK[current] ?? -1) >= STATUS_RANK[wanted] ? current : wanted;
}

function appendNote(notes, line) {
  if (!line) return notes || '';
  if (notes && notes.includes(line)) return notes;
  return [notes && notes.trim(), line].filter(Boolean).join('\n\n');
}

/** El nombre que ha oído el analista coincide si todas sus palabras están en el nombre del acta. */
function nameMatches(actaName, heard) {
  const words = normalizeName(heard).split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return false;
  const actaWords = new Set(normalizeName(actaName).replace(/,/g, ' ').split(/\s+/));
  return words.every((w) => actaWords.has(w));
}

/**
 * Reconciliación de las valoraciones por dorsal de la agenda con el acta oficial del partido.
 *
 * El analista que no conoce al jugador lo valora por dorsal (identified_by 'dorsal'). Aquí se busca
 * en el acta quién llevaba ese dorsal en ese equipo (o, si no aparece, quién tiene el nombre que
 * apuntó) y se le pasan comentario, estrellas, estado y nota de voz:
 *  - Si el jugador ya está en la BD, se le añade a su ficha.
 *  - Si no está, se crea su ficha con los datos de la FFCV y la valoración.
 * Las valoraciones de un jugador elegido de la plantilla (identified_by 'player') ya están en su
 * ficha y no se tocan. Lo ya reconciliado tampoco se vuelve a aplicar.
 *
 * Compatibilidad con valoraciones antiguas: antes se aplicaban al jugador que tenía el dorsal en la
 * plantilla (player_id) o a una ficha provisional "Dorsal #X". Si el acta dice que era otro, se quita
 * el comentario de ese jugador y se borra la ficha provisional.
 *
 * Devuelve true si queda alguna valoración por dorsal sin poder resolver con este acta.
 */
async function reconcileDorsalComments(supabase, item, acta) {
  const scouts = Array.isArray(item.dorsal_scouts) ? item.dorsal_scouts.map((s) => ({ ...s })) : [];
  const pending = scouts.filter((s) => s.identified_by !== 'player' && !s.reconciled && s.dorsal);
  if (pending.length === 0) return;

  console.log(`   🔍 ${pending.length} valoración(es) por dorsal a asignar con el acta...`);
  const sides = playedBySide(acta);
  const matchLabel = `${item.home_team_name} - ${item.away_team_name}`;

  for (const ds of pending) {
    const dorsal = parseInt(ds.dorsal, 10);
    const side = ds.side === 'away' ? sides.away : ds.side === 'home' ? sides.home : observedSides(sides, [ds.team_name])[0];
    const label = `#${dorsal} de ${side?.team || ds.team_name}`;

    let actaPlayer = side?.allPlayers.find((p) => p.dorsal === dorsal) || null;
    if (ds.player_name && side && (!actaPlayer || !nameMatches(actaPlayer.name, ds.player_name))) {
      // El dorsal no está o no cuadra con el nombre que oyó el analista: manda el nombre
      const byName = side.allPlayers.find((p) => nameMatches(p.name, ds.player_name));
      if (byName) actaPlayer = byName;
    }
    if (!actaPlayer) {
      console.log(`      ⚠️ ${label}: no figura en el acta. Se deja sin asignar.`);
      Object.assign(ds, { reconciled: true, reconciled_at: new Date().toISOString(), status_resolution: 'not_in_acta' });
      continue;
    }

    const realCod = String(actaPlayer.id);
    console.log(`      📄 ${label} → ${actaPlayer.name} (${realCod})`);
    const noteLine = ds.comment ? `[${matchLabel}] ${ds.comment}` : '';

    const { data: teamRow } = await supabase.from('teams').select('id').ilike('name', String(side.team || '').trim()).maybeSingle();
    const teamId = teamRow?.id || null;

    let { data: dbPlayer } = await supabase.from('players').select('*').eq('source_player_id', realCod).maybeSingle();
    let resolution = 'coincides';

    if (dbPlayer) {
      const updates = {
        notes: appendNote(dbPlayer.notes, noteLine),
        rating: ds.rating || dbPlayer.rating || null,
        status: mergedStatus(dbPlayer.status, ds.status),
        ...(ds.voice_note ? { sports_data: { ...(dbPlayer.sports_data || {}), voice_note: ds.voice_note } } : {})
      };
      if (ds.player_id && ds.player_id !== dbPlayer.id) resolution = 'reassigned_by_name';
      if (!dryRun) {
        const { error } = await supabase.from('players').update(updates).eq('id', dbPlayer.id);
        if (error) {
          console.warn(`         ⚠️ Error guardando en ${actaPlayer.name}: ${error.message}`);
          continue;
        }
      }
      console.log(`         ✅ Valoración guardada en la ficha de ${dbPlayer.first_name} ${dbPlayer.last_name}.`);
    } else {
      resolution = 'created_from_acta';
      const { playerApi, historyApi } = await fetchPlayerDetail(realCod);
      const parsedName = parsePlayerName(playerApi?.nombre_jugador || actaPlayer.name);
      const history = buildHistory(historyApi);
      const age = playerApi?.edad ? parseInt(playerApi.edad, 10) : NaN;
      const birthYear = parseBirthYear(playerApi, historyApi);
      const newPlayer = {
        first_name: parsedName.firstName,
        last_name: parsedName.lastName,
        position: normalizePosition(playerApi?.posicion_jugador || actaPlayer.position),
        jersey_number: dorsal,
        photo_url: toPhotoUrl(playerApi?.foto, realCod),
        team_id: teamId,
        city: 'Castelló',
        province: 'Castelló',
        status: mergedStatus(null, ds.status || 'Interesante'),
        rating: ds.rating || 3,
        notes: noteLine,
        sports_data: { ...buildStats(playerApi), ...(ds.voice_note ? { voice_note: ds.voice_note } : {}) },
        source: 'ffcv_scraping',
        source_player_id: realCod,
        source_url: `https://ffcv.es/competiciones/jugadores/jugador.php?codigo=${realCod}`,
        infantil_year: calculateInfantilYear(history, isNaN(age) ? null : age, birthYear),
        age: isNaN(age) ? null : age,
        history,
        scraped_at: new Date().toISOString()
      };
      if (!dryRun) {
        const { data: created, error } = await supabase
          .from('players')
          .upsert([newPlayer], { onConflict: 'source,source_player_id' })
          .select('id')
          .single();
        if (error) {
          console.warn(`         ⚠️ Error creando la ficha de ${actaPlayer.name}: ${error.message}`);
          continue;
        }
        dbPlayer = { id: created.id };
      }
      console.log(`         🆕 No estaba en la BD: ficha de ${parsedName.fullName} creada con la valoración.`);
    }

    // Valoraciones antiguas: retirar el comentario del jugador al que se aplicó por error
    if (!dryRun && ds.player_id && ds.player_id !== dbPlayer?.id && UUID_RE.test(ds.player_id)) {
      const { data: wrong } = await supabase.from('players').select('id, first_name, notes').eq('id', ds.player_id).maybeSingle();
      if (wrong && String(wrong.first_name || '').startsWith('Dorsal #')) {
        await supabase.from('players').delete().eq('id', wrong.id);
        console.log('         🧹 Ficha provisional borrada.');
      } else if (wrong && ds.comment && wrong.notes?.includes(ds.comment)) {
        await supabase.from('players').update({ notes: wrong.notes.replace(ds.comment, '').trim() }).eq('id', wrong.id);
        console.log('         🧹 Comentario retirado del jugador que tenía ese dorsal en la plantilla.');
      }
    }

    Object.assign(ds, {
      reconciled: true,
      reconciled_at: new Date().toISOString(),
      reconciled_player_id: dbPlayer?.id || null,
      reconciled_player_name: actaPlayer.name,
      status_resolution: resolution
    });
  }

  if (!dryRun) {
    const { error } = await supabase.from('scouting_agenda').update({ dorsal_scouts: scouts }).eq('id', item.id);
    if (error) throw new Error(`guardando dorsal_scouts: ${error.message}`);
  }
}

async function fetchActa(codacta) {
  const endpoint = `partidos/ficha_partido_ajax.php?cod_partido=${encodeURIComponent(codacta)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await ffcvApiGet(endpoint);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      return res.data;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return null;
}

async function fetchPlayerDetail(codJugador) {
  const cod = encodeURIComponent(codJugador);
  const temp = encodeURIComponent(TARGET_TEMPORADA);
  const [playerRes, historyRes] = await Promise.all([
    ffcvApiGet(`jugadores/jugador_api.php?codigo=${cod}&cod_temporada=${temp}`).catch(() => ({ data: null })),
    ffcvApiGet(`jugadores/historial_deportivo.php?cod_licencia=${cod}&cod_temporada=${temp}`).catch(() => ({ data: null }))
  ]);
  return {
    playerApi: playerRes?.data,
    historyApi: historyRes?.data
  };
}

/** Extrae jugadores convocados y jugadores que jugaron (titulares + suplentes que entraron) con sus dorsales. */
function playedBySide(acta) {
  const side = (players, subs) => {
    const entered = new Set((subs || []).map((s) => String(s.codjugador_entra)));
    const list = players || [];
    const parseNum = (d) => {
      const n = parseInt(String(d || '').trim(), 10);
      return !isNaN(n) && n > 0 && n <= 99 ? n : null;
    };
    return {
      called: list.length,
      allPlayers: list.map((p) => ({
        id: String(p.codjugador),
        name: p.nombre_jugador || p.nombre_visible,
        dorsal: parseNum(p.dorsal),
        starter: String(p.titular) === '1',
        played: String(p.titular) === '1' || entered.has(String(p.codjugador)),
        position: p.posicion || p.posicion_campo || null
      })),
      played: list
        .filter((p) => String(p.titular) === '1' || entered.has(String(p.codjugador)))
        .map((p) => ({
          id: String(p.codjugador),
          name: p.nombre_jugador || p.nombre_visible,
          dorsal: parseNum(p.dorsal),
          starter: String(p.titular) === '1'
        }))
    };
  };
  return {
    home: { team: acta.equipo_local, ...side(acta.jugadores_equipo_local, acta.sustituciones_equipo_local) },
    away: { team: acta.equipo_visitante, ...side(acta.jugadores_equipo_visitante, acta.sustituciones_equipo_visitante) }
  };
}

function observedSides(sides, observedTeams) {
  const wanted = (observedTeams || []).map(normalizeName).filter(Boolean);
  if (wanted.length === 0) return [sides.home, sides.away];
  return [sides.home, sides.away].filter((s) => wanted.includes(normalizeName(s.team)));
}

function parseActaDate(fecha) {
  const m = String(fecha || '').match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
}

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

/** Pasa a 'Observado' a los que están como 'Candidato'. */
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
      .or('status.is.null,status.eq.Candidato');
    if (upErr) throw new Error(`actualizando jugadores: ${upErr.message}`);
  }
  return { inDb, promoted: toPromote };
}

/**
 * Reconciliación de comentarios por dorsal de la agenda con el acta oficial del partido:
 * 1. Comprueba quién era realmente el dorsal en el acta oficial.
 * 2. REGLA 1: Si en la base de datos coincide, se le añade el comentario y datos añadidos por el seleccionador.
 * 3. REGLA 2: Si ese dorsal no está en la base de datos, obtiene los datos de la FFCV y añade la nueva ficha.
 * 4. REGLA 3: Si no coincide con el dorsal en la BD, reasigna el comentario al jugador que corresponde por nombre en el acta.
 */
async function reconcileDorsalComments(supabase, item, acta) {
  console.log(`\n   🔍 Reconciliación de comentarios por dorsal (Agenda ID: ${item.id})...`);

  // Extraer observaciones por dorsal de:
  // a) item.dorsal_scouts (guardado estructurado de QuickDorsalScouting)
  // b) item.notes (texto libre con mención a dorsales: "Dorsal 10: ...", "#8: ...")
  // c) Jugadores temporales creados en la BD con nombre "Dorsal #X"
  const observations = [];

  if (Array.isArray(item.dorsal_scouts)) {
    for (const ds of item.dorsal_scouts) {
      if (ds.dorsal) {
        observations.push({
          teamName: ds.team_name,
          side: ds.side,
          dorsal: parseInt(ds.dorsal, 10),
          comment: ds.comment || '',
          rating: ds.rating,
          status: ds.status,
          voiceNote: ds.voice_note,
          assignedPlayerId: ds.player_id,
          sourceType: 'structured'
        });
      }
    }
  }

  // Parsear texto libre de item.notes para capturar anotaciones como "Dorsal 10: buen regate" o "#7: muy rápido"
  if (item.notes && typeof item.notes === 'string') {
    const regex = /(?:dorsal|#)\s*(\d+)[\s:.-]+([^\n\r]+)/gi;
    let match;
    while ((match = regex.exec(item.notes)) !== null) {
      const dNum = parseInt(match[1], 10);
      const text = match[2].trim();
      if (!isNaN(dNum) && dNum > 0 && dNum <= 99 && text) {
        // Si no está ya capturado en las observaciones estructuradas
        const already = observations.find((o) => o.dorsal === dNum && o.comment.includes(text));
        if (!already) {
          observations.push({
            teamName: item.home_team_name, // Asociar al equipo observado
            dorsal: dNum,
            comment: text,
            rating: 3,
            status: 'Interesante',
            sourceType: 'text_note'
          });
        }
      }
    }
  }

  // Revisar si se crearon jugadores provisionales ("Dorsal #X") en Supabase para este partido
  const { data: placeholderPlayers } = await supabase
    .from('players')
    .select('id, first_name, last_name, full_name, jersey_number, team_id, notes, rating, status, sports_data')
    .ilike('first_name', 'Dorsal #%');

  if (placeholderPlayers && placeholderPlayers.length > 0) {
    for (const pp of placeholderPlayers) {
      const mDorsal = pp.first_name.match(/#(\d+)/);
      if (mDorsal) {
        const dNum = parseInt(mDorsal[1], 10);
        const existing = observations.find((o) => o.dorsal === dNum);
        if (!existing) {
          observations.push({
            teamName: item.home_team_name,
            dorsal: dNum,
            comment: pp.notes || '',
            rating: pp.rating,
            status: pp.status,
            voiceNote: (pp.sports_data)?.voice_note,
            assignedPlayerId: pp.id,
            sourceType: 'placeholder_player'
          });
        }
      }
    }
  }

  if (observations.length === 0) {
    console.log('      ℹ️  No hay comentarios ni anotaciones de dorsal en este partido.');
    return;
  }

  console.log(`      📋 ${observations.length} anotación(es) de dorsal a verificar con el acta oficial.`);

  const sides = playedBySide(acta);
  const updatedDorsalScouts = [...(item.dorsal_scouts || [])];

  for (const obs of observations) {
    console.log(`\n      👉 Analizando Dorsal #${obs.dorsal} (${obs.comment ? `"${obs.comment.slice(0, 40)}..."` : 'sin texto'}):`);

    // Buscar en qué equipo jugaba este dorsal según el acta
    const targetSides = observedSides(sides, obs.teamName ? [obs.teamName] : item.observed_teams);
    let realActaPlayer = null;
    let matchingSideTeam = null;

    for (const s of targetSides) {
      const found = s.allPlayers.find((p) => p.dorsal === obs.dorsal);
      if (found) {
        realActaPlayer = found;
        matchingSideTeam = s.team;
        break;
      }
    }

    if (!realActaPlayer) {
      console.log(`         ⚠️ El dorsal #${obs.dorsal} no figura en la convocatoria del acta oficial para este partido.`);
      continue;
    }

    const realCod = String(realActaPlayer.id);
    const realName = realActaPlayer.name || '';
    console.log(`         📄 En el acta oficial FFCV el dorsal #${obs.dorsal} era: ${realName} (código ${realCod}, ${matchingSideTeam})`);

    // 1. Obtener id del equipo en la base de datos
    let teamId = null;
    if (matchingSideTeam) {
      const { data: teamRow } = await supabase
        .from('teams')
        .select('id')
        .ilike('name', matchingSideTeam.trim())
        .maybeSingle();
      teamId = teamRow?.id || null;
    }

    // 2. Comprobar si el jugador real ya está en la base de datos
    let { data: realDbPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('source_player_id', realCod)
      .maybeSingle();

    if (!realDbPlayer && realName && teamId) {
      const { data: teamPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId);
      realDbPlayer = (teamPlayers || []).find((p) => normalizeName(p.full_name) === normalizeName(realName));
    }

    // 3. Comprobar qué jugador tenía este dorsal previamente en la BD para este equipo
    let previousDbPlayerWithDorsal = null;
    if (teamId) {
      const { data: rosterDorsal } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .eq('jersey_number', obs.dorsal);
      previousDbPlayerWithDorsal = (rosterDorsal || []).find((p) => !p.first_name.startsWith('Dorsal #'));
    }

    // ── REGLA 1: COINCIDE CON LA BASE DE DATOS ──────────────────────────────
    if (realDbPlayer && (!previousDbPlayerWithDorsal || previousDbPlayerWithDorsal.id === realDbPlayer.id)) {
      console.log(`         ✅ COINCIDE: ${realDbPlayer.first_name} ${realDbPlayer.last_name} ya tenía el dorsal #${obs.dorsal} en la base de datos.`);
      if (!dryRun) {
        const notesArr = [realDbPlayer.notes, obs.comment].filter((n) => n && n.trim());
        const combinedNotes = realDbPlayer.notes?.includes(obs.comment) ? realDbPlayer.notes : notesArr.join('\n\n');
        const updates = {
          notes: combinedNotes,
          rating: obs.rating || realDbPlayer.rating || 3,
          status: obs.status && obs.status !== 'Candidato' ? obs.status : (realDbPlayer.status === 'Candidato' ? 'Observado' : realDbPlayer.status)
        };
        await supabase.from('players').update(updates).eq('id', realDbPlayer.id);
        console.log(`         💾 Comentario y valoración guardados para ${realDbPlayer.full_name}.`);
      }
    }

    // ── REGLA 2: ESE DORSAL NO ESTÁ EN LA BD -> CREAR FICHA CON DATOS FFCV ──
    else if (!realDbPlayer) {
      console.log(`         🆕 NO ESTÁ EN BD: El dorsal #${obs.dorsal} (${realName}) no tiene ficha en la base de datos. Creando ficha completa desde FFCV...`);
      const { playerApi, historyApi } = await fetchPlayerDetail(realCod);
      const parsedName = parsePlayerName(playerApi?.nombre_jugador || realName);
      const history = buildHistory(historyApi);
      const age = playerApi?.edad ? parseInt(playerApi.edad, 10) : NaN;
      const birthYear = parseBirthYear(playerApi, historyApi);
      const infantilYear = calculateInfantilYear(history, isNaN(age) ? null : age, birthYear);
      const pos = normalizePosition(playerApi?.posicion_jugador || realActaPlayer.position);

      const newPlayer = {
        first_name: parsedName.firstName,
        last_name: parsedName.lastName,
        position: pos,
        jersey_number: obs.dorsal,
        photo_url: toPhotoUrl(playerApi?.foto, realCod),
        team_id: teamId,
        city: 'Castelló',
        province: 'Castelló',
        status: obs.status || 'Interesante',
        rating: obs.rating || 3,
        notes: obs.comment || '',
        sports_data: {
          ...(buildStats(playerApi)),
          ...(obs.voiceNote ? { voice_note: obs.voiceNote } : {})
        },
        source: 'ffcv_scraping',
        source_player_id: realCod,
        source_url: `https://ffcv.es/competiciones/jugadores/jugador.php?codigo=${realCod}`,
        infantil_year: infantilYear,
        age: isNaN(age) ? null : age,
        history,
        scraped_at: new Date().toISOString()
      };

      if (!dryRun) {
        const { data: created, error: crErr } = await supabase
          .from('players')
          .upsert([newPlayer], { onConflict: 'source,source_player_id' })
          .select('id')
          .single();
        if (crErr) console.warn(`         ⚠️ Error creando ficha de ${realName}:`, crErr.message);
        else console.log(`         ✨ Ficha de ${parsedName.fullName} creada con éxito en Supabase con los comentarios del seleccionador.`);

        // Eliminar fichas provisionales "Dorsal #X" si existían
        if (obs.assignedPlayerId) {
          await supabase.from('players').delete().eq('id', obs.assignedPlayerId).ilike('first_name', 'Dorsal #%');
        }
        if (teamId) {
          await supabase.from('players').delete().eq('team_id', teamId).ilike('first_name', `Dorsal #${obs.dorsal}%`);
        }
      }
    }

    // ── REGLA 3: NO COINCIDE CON EL DORSAL DE LA BD -> REASIGNAR POR NOMBRE ─
    else if (previousDbPlayerWithDorsal && previousDbPlayerWithDorsal.source_player_id !== realCod) {
      console.log(`         🔄 NO COINCIDE: En la BD el dorsal #${obs.dorsal} era ${previousDbPlayerWithDorsal.first_name} ${previousDbPlayerWithDorsal.last_name}, pero en el partido era ${realName}.`);
      console.log(`         ➡️ Reasignando el comentario y valoración a ${realName} por nombre oficial...`);

      if (!dryRun) {
        // 1. Añadir comentario y valoración al jugador que realmente jugó con ese dorsal
        const notesArr = [realDbPlayer.notes, obs.comment].filter((n) => n && n.trim());
        const combinedNotes = realDbPlayer.notes?.includes(obs.comment) ? realDbPlayer.notes : notesArr.join('\n\n');
        await supabase
          .from('players')
          .update({
            notes: combinedNotes,
            rating: obs.rating || realDbPlayer.rating || 3,
            status: obs.status && obs.status !== 'Candidato' ? obs.status : 'Interesante'
          })
          .eq('id', realDbPlayer.id);

        // 2. Retirar el comentario erróneo del jugador anterior que tenía ese dorsal asignado en la BD
        if (obs.comment && previousDbPlayerWithDorsal.notes?.includes(obs.comment)) {
          let cleaned = previousDbPlayerWithDorsal.notes.replace(obs.comment, '').trim();
          cleaned = cleaned.replace(/\n\s*---\s*\n/g, '\n').trim();
          await supabase.from('players').update({ notes: cleaned }).eq('id', previousDbPlayerWithDorsal.id);
          console.log(`         🧹 Comentario retirado de ${previousDbPlayerWithDorsal.first_name} ${previousDbPlayerWithDorsal.last_name}.`);
        }
      }
    }

    // Actualizar registro en dorsal_scouts para dejar constancia de la reconciliación
    const dsIdx = updatedDorsalScouts.findIndex((s) => s.dorsal === obs.dorsal);
    const recEntry = {
      reconciled: true,
      reconciled_at: new Date().toISOString(),
      reconciled_player_id: realDbPlayer?.id || null,
      reconciled_player_name: realName
    };
    if (dsIdx !== -1) {
      updatedDorsalScouts[dsIdx] = { ...updatedDorsalScouts[dsIdx], ...recEntry };
    } else {
      updatedDorsalScouts.push({
        team_name: obs.teamName,
        side: obs.side || 'home',
        dorsal: obs.dorsal,
        comment: obs.comment,
        rating: obs.rating,
        status: obs.status,
        ...recEntry
      });
    }
  }

  // Guardar en scouting_agenda la lista reconciliada
  if (!dryRun) {
    await supabase
      .from('scouting_agenda')
      .update({ dorsal_scouts: updatedDorsalScouts })
      .eq('id', item.id)
      .catch(() => {});
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
    for (const s of sides) {
      console.log(`   ⚽ ${s.team}: ${s.called} convocados, ${s.played.length} jugaron`);
      for (const p of s.played) console.log(`      - #${p.dorsal || '?'} ${p.name} (${p.id})${p.starter ? '' : ' [entró de suplente]'}`);
    }
    const playedIds = sides.flatMap((s) => s.played.map((p) => p.id));
    const result = await promotePlayers(supabase, playedIds);
    console.log(`   👥 ${result.inDb.length} de ${playedIds.length} jugadores en la BD.`);
    return;
  }

  // Partidos observados sin procesar y cualquier partido con valoraciones por dorsal sin asignar
  // (el analista puede valorar sin marcarlo como 'Observat', o añadir valoraciones después)
  const { data: agendaRows, error } = await supabase.from('scouting_agenda').select('*');
  if (error) {
    console.error('❌ Error leyendo la agenda:', error.message);
    process.exit(1);
  }
  const hasPendingScouts = (a) =>
    (a.dorsal_scouts || []).some((s) => s.identified_by !== 'player' && !s.reconciled && s.dorsal);
  const needsLineup = (a) => a.status === 'Observat' && (processAll || !a.lineup_processed_at);
  const pending = (agendaRows || []).filter((a) => needsLineup(a) || hasPendingScouts(a));

  console.log(`📋 ${pending.length} partidos observados ${processAll ? 'en total' : 'pendientes de procesar'}.`);
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
      if (matchDay && !processAll && (today - matchDay) / 86400000 < MIN_DAYS_AFTER_MATCH) {
        console.log(`   ⏳ Se jugó/juega el ${String(date).slice(0, 10)}: se procesará pasados ${MIN_DAYS_AFTER_MATCH} días.`);
        continue;
      }

      const acta = await fetchActa(codacta);
      if (!acta || String(acta.estado) !== '1') {
        console.log('   ⚠️ No se pudo leer el acta. Se reintentará.');
        continue;
      }
      const actaDay = parseActaDate(acta.fecha);
      if (actaDay && !processAll && (today - actaDay) / 86400000 < MIN_DAYS_AFTER_MATCH) {
        console.log(`   ⏳ El acta indica fecha ${acta.fecha}: se procesará pasados ${MIN_DAYS_AFTER_MATCH} días.`);
        continue;
      }

      let playedIds = item.played_player_ids || [];
      if (String(acta.suspendido) === '1') {
        console.log('   🚫 Partido suspendido: no se marca a nadie.');
      } else if (String(acta.acta_cerrada) !== '1' && !processAll) {
        console.log('   ⏳ El acta aún no está cerrada. Se reintentará.');
        continue;
      } else if (needsLineup(item)) {
        const sides = observedSides(playedBySide(acta), item.observed_teams);
        for (const s of sides) {
          console.log(`   ⚽ ${s.team}: ${s.called} convocados, ${s.played.length} jugaron`);
          for (const p of s.played) console.log(`      - #${p.dorsal || '?'} ${p.name} (${p.id})${p.starter ? '' : ' [entró de suplente]'}`);
        }
        playedIds = sides.flatMap((s) => s.played.map((p) => p.id));
        const result = await promotePlayers(supabase, playedIds);
        console.log(`   👥 ${result.inDb.length} de ${playedIds.length} jugadores en la BD (${result.promoted.length} pasados a Observado).`);
        totalPromoted += result.promoted.length;

      }

      // Valoraciones por dorsal -> jugador que llevaba ese dorsal según el acta
      if (String(acta.suspendido) !== '1') await reconcileDorsalComments(supabase, item, acta);

      if (!dryRun && needsLineup(item)) {
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

main()
  .catch((err) => {
    console.error('❌', err.message);
    process.exitCode = 1;
  })
  .finally(closeFfcv);
