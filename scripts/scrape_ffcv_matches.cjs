#!/usr/bin/env node
/**
 * Scraping FFCV Infantil - PARTIDOS (agenda, resultados y campos)
 *
 * Competiciones: ver TARGET_COMPETITIONS en ffcv_common.cjs.
 * Los jugadores y plantillas van aparte, en scrape_ffcv_players.cjs.
 *
 * Uso:
 *   node scripts/scrape_ffcv_matches.cjs [--all-matches]
 *
 * Opciones:
 *   --all-matches   Volver a descargar también las jornadas ya jugadas
 *
 * Descarga incremental: solo se descargan las 3 próximas jornadas pendientes de cada grupo;
 * las ya jugadas (todos sus partidos finalizados y con fecha pasada) y las futuras más
 * lejanas se conservan de src/data/scraped_matches.json. Lo que falla se reintenta al final.
 * En Supabase solo se escriben los partidos descargados en esta ejecución.
 */

const fs = require('fs');
const path = require('path');
const { closeFfcv } = require('./ffcv_client.cjs');
const {
  DATA_DIR, TARGET_COMPETITIONS, ffcvFetch, mapWithConcurrency, defer, runDeferred, RETRY_ROUNDS,
  todayInSpain, datePlusDays, parseResult, formatLogoUrl, parseDate, parseTime, ensureDir,
  getSupabase, readJsonArray
} = require('./ffcv_common.cjs');

const args = process.argv.slice(2);
const refreshAllMatches = args.includes('--all-matches');
const MATCHES_FILE = path.join(DATA_DIR, 'scraped_matches.json');

/** Upsert en Supabase de los partidos descargados en esta ejecución (deduplicados por source_match_id). */
async function syncMatchesToSupabase(supabase, matches) {
  if (!supabase) {
    console.log('ℹ️  Supabase no configurado en .env (se omite la sincronización remota a BD).');
    return;
  }
  console.log('\n📡 Sincronizando partidos con Supabase...');
  try {
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
      console.log(`   ✅ ${mSuccess}/${dbMatches.length} partidos pendientes sincronizados en Supabase.`);
    } else {
      console.log('   ℹ️  No hay partidos nuevos que sincronizar.');
    }
  } catch (err) {
    console.warn('   ⚠️ Error conectando con Supabase:', err.message);
  }
}

(async () => {
  console.log('=====================================================');
  console.log('📅 SCRAPER FFCV INFANTIL - PARTIDOS, AGENDA Y CAMPOS');
  console.log('=====================================================');
  const startedAt = Date.now();
  const today = todayInSpain();
  console.log(`Fecha del scraping: ${today}`);

  const supabase = getSupabase();
  const fieldsCache = new Map(); // codcampo -> info campo (coordenadas, dirección, etc.)
  // Partidos por jornada en orden de descarga: { matches, refreshed } (refreshed = descargados ahora)
  const matchesByJornada = new Map();
  const notUpdated = [];
  ensureDir(DATA_DIR);

  const currentMatches = () => [...matchesByJornada.values()].flatMap((v) => v.matches);

  try {
    // Partidos de la ejecución anterior: las jornadas ya jugadas no se vuelven a pedir y,
    // si la FFCV falla, se conservan en vez de perderlas.
    const previousMatches = readJsonArray(MATCHES_FILE);
    const prevByJornada = new Map();
    for (const m of previousMatches) {
      const key = `${m.cod_grupo}|${m.matchday}`;
      if (!prevByJornada.has(key)) prevByJornada.set(key, []);
      prevByJornada.get(key).push(m);
    }
    // Jugado = con resultado y fecha anterior a hoy. Los aplazados/suspendidos se siguen actualizando.
    const isPlayed = (m) => ['Jugado', 'Finalizado'].includes(m.status) && m.match_date && m.match_date < today;
    let keptJornadas = 0;
    let refreshedJornadas = 0;

    /** Partidos de una jornada, o null si la FFCV no ha respondido. */
    const scrapeJornada = async (comp, grp, codJornada, jornadaNombre) => {
      const partidosData = await ffcvFetch(`partidos/resultados_por_grupo_jornada_data.php?cod_grupo=${encodeURIComponent(grp.id)}&cod_jornada=${encodeURIComponent(codJornada)}`);
      if (!partidosData) return null;
      const partidosList = Array.isArray(partidosData.partidos) ? partidosData.partidos : [];
      const jornadaMatches = [];

      // Ficha detallada de cada partido (árbitros, código de campo, hora confirmada)
      // Solo llamamos a ficha_partido_ajax si el partido ya se ha jugado (para tener el acta/árbitros completos)
      // o si es inminente (a menos de 7 días). Para partidos futuros lejanos, los datos de resultados_por_grupo_jornada_data son suficientes.
      const prevMatchesMap = new Map((prevByJornada.get(`${grp.id}|${jornadaNombre}`) || []).map((m) => [m.codacta, m]));

      const details = await mapWithConcurrency(partidosList, 2, (p) => {
        if (!p.codacta) return null;
        const fechaPart = parseDate(p.fecha);
        const isNearOrPlayed = p.estado === '1' || Boolean(parseResult(p.resultado)) || (fechaPart && fechaPart <= datePlusDays(today, 7));
        if (isNearOrPlayed) {
          return ffcvFetch(`partidos/ficha_partido_ajax.php?cod_partido=${encodeURIComponent(p.codacta)}`);
        }
        // Usar datos previos si existían
        const prevMatch = prevMatchesMap.get(p.codacta);
        if (prevMatch) {
          return {
            codigo_campo: prevMatch.field_code,
            campo: prevMatch.field_name,
            fecha: prevMatch.match_date,
            hora: prevMatch.time,
            arbitros_partido: (prevMatch.referees || []).map((r) => ({ nombre: r }))
          };
        }
        return null;
      });

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
        const score = parseResult(p.resultado);

        jornadaMatches.push({
          id: `ffcv-acta-${p.codacta || `${p.cod_equipo_local}-${p.cod_equipo_visitante}-${fechaPart}`}`,
          codacta: p.codacta || null,
          competition: comp.name,
          cod_competicion: comp.id,
          group: grp.name,
          cod_grupo: grp.id,
          matchday: jornadaNombre,
          match_date: fechaPart,
          time: horaPart,
          status: p.estado === '5' ? 'Suspendido' : (score || p.estado === '1' ? 'Finalizado' : 'Programado'),
          home_team: p.local,
          home_team_id: p.cod_equipo_local,
          home_crest: formatLogoUrl(p.escudo_local || matchDetail?.escudo_local),
          away_team: p.visitante,
          away_team_id: p.cod_equipo_visitante,
          away_crest: formatLogoUrl(p.escudo_visitante || matchDetail?.escudo_visitante),
          home_score: score ? score[0] : null,
          away_score: score ? score[1] : null,
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
      return jornadaMatches;
    };

    /** Jornadas de un grupo. Solo se descargan las 3 próximas jornadas a la fecha actual. */
    const processGroupMatches = async (comp, grp) => {
      const jornadasData = await ffcvFetch(`filtros/jornadas_fetch.php?cod_grupo=${encodeURIComponent(grp.id)}`);
      if (!jornadasData) return false;
      matchesByJornada.delete(`${grp.id}|*`);
      const jornadas = Array.isArray(jornadasData.jornadas) ? jornadasData.jornadas : [];
      console.log(`     Total jornadas en el grupo: ${jornadas.length}`);

      // Identificar cuáles jornadas están pendientes / próximas según la fecha de sus partidos en cache
      const jornadaInfos = jornadas.map((jor, idx) => {
        const codJornada = jor.codjornada || jor.nombre;
        const jornadaNombre = `Jornada ${jor.nombre || codJornada}`;
        const key = `${grp.id}|${jornadaNombre}`;
        const prev = prevByJornada.get(key) || [];
        const dates = prev.map((m) => m.match_date).filter(Boolean).sort();
        const minDate = dates[0] || '';
        const allPlayed = prev.length > 0 && prev.every(isPlayed);
        return { jor, codJornada, jornadaNombre, key, prev, minDate, allPlayed, idx };
      });

      // Ordenamos las pendientes por fecha estimada (o por orden de jornada)
      const pending = jornadaInfos.filter((j) => !j.allPlayed);
      // Las 3 próximas a disputar
      const targetKeys = new Set(pending.slice(0, 3).map((j) => j.key));

      for (const info of jornadaInfos) {
        const { jor, codJornada, jornadaNombre, key, prev, allPlayed } = info;

        // 1. Si ya se jugó entera en el pasado, se conservan sus partidos sin pedir nada
        if (!refreshAllMatches && allPlayed) {
          matchesByJornada.set(key, { matches: prev, refreshed: false });
          keptJornadas++;
          console.log(`       ${jornadaNombre}: ya jugada, se conservan sus ${prev.length} partidos`);
          continue;
        }

        // 2. Si no es una de las 3 próximas jornadas y ya tenemos partidos en cache, los conservamos
        if (!refreshAllMatches && !targetKeys.has(key) && prev.length > 0) {
          matchesByJornada.set(key, { matches: prev, refreshed: false });
          keptJornadas++;
          console.log(`       ${jornadaNombre}: jornada futura (más allá de las 3 próximas), se conservan sus ${prev.length} partidos`);
          continue;
        }

        // 3. Es una de las 3 próximas jornadas (o jornada pendiente nueva sin cache): se descarga
        matchesByJornada.set(key, { matches: prev, refreshed: false });
        const label = `Partidos ${comp.name} ${grp.name} - ${jornadaNombre}`;
        const run = async () => {
          const jornadaMatches = await scrapeJornada(comp, grp, codJornada, jornadaNombre);
          if (!jornadaMatches) return false;
          matchesByJornada.set(key, { matches: jornadaMatches, refreshed: true });
          refreshedJornadas++;
          return true;
        };
        if (await run()) {
          console.log(`       ${jornadaNombre}: ⚡ ${matchesByJornada.get(key).matches.length} partidos actualizados (próxima jornada)`);
        } else {
          console.log(`       ${jornadaNombre}: sin respuesta de la FFCV, se reintentará al final`);
          defer(label, run, () => notUpdated.push(label));
        }
      }
      return true;
    };

    for (const comp of TARGET_COMPETITIONS) {
      console.log(`\n🏆 ${comp.name} (${comp.id})`);
      for (const grp of comp.groups) {
        console.log(`  🔹 ${grp.name} (${grp.id})`);
        if (await processGroupMatches(comp, grp)) {
          console.log(`     ✅ Grupo ${grp.name} completado.`);
          continue;
        }
        // Mientras tanto se conservan los partidos anteriores del grupo
        const kept = previousMatches.filter(m => m.cod_grupo === grp.id);
        matchesByJornada.set(`${grp.id}|*`, { matches: kept, refreshed: false });
        const label = `Jornadas ${comp.name} ${grp.name}`;
        console.log(`     ⚠️ No se han podido obtener las jornadas, se reintentará al final. De momento se conservan ${kept.length} partidos anteriores.`);
        defer(label, () => processGroupMatches(comp, grp), () => notUpdated.push(label));
      }
    }

    console.log(`\n🏟️  Jornadas: ${refreshedJornadas} actualizadas, ${keptJornadas} conservadas sin volver a descargar.`);

    // ── Reintento de lo que ha fallado ─────────────────────────────────────────
    const stillFailed = await runDeferred();
    if (stillFailed.length > 0) {
      console.warn(`\n⚠️ Siguen fallando tras ${RETRY_ROUNDS} reintentos (se mantienen los datos anteriores):`);
      for (const label of stillFailed) console.warn(`   - ${label}`);
    }

    const allMatches = currentMatches();
    if (allMatches.length === 0) {
      throw new Error('No se ha obtenido ningún partido de la FFCV (¿acceso bloqueado?). No se sincroniza nada.');
    }
    fs.writeFileSync(MATCHES_FILE, JSON.stringify(allMatches, null, 2), 'utf8');
    console.log(`\n💾 Guardados ${allMatches.length} partidos en: ${MATCHES_FILE}`);

    const matchesToSync = [...matchesByJornada.values()].filter((v) => v.refreshed).flatMap((v) => v.matches);
    await syncMatchesToSupabase(supabase, matchesToSync);

    if (notUpdated.length > 0) {
      console.warn(`\n⚠️ No actualizados en esta ejecución: ${notUpdated.join('; ')}`);
    }
    console.log(`\n✨ ¡Scraping de partidos finalizado en ${Math.round((Date.now() - startedAt) / 1000)}s!`);
  } catch (err) {
    console.error('\n❌ Error durante el scraping de partidos:', err);
    process.exitCode = 1;
  } finally {
    await closeFfcv();
  }
})();
