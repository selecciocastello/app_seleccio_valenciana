/**
 * fetch_matches_ffcv.cjs
 * Fast match and standings fetcher directly from FFCV JSON APIs:
 * - resultados_por_grupo_jornada_data.php?cod_grupo={grp}&cod_jornada={jor}
 * - clasificaciones_ajax.php?cod_grupo={grp}&cod_jornada=1
 * - ficha_partido_ajax.php?cod_partido={codacta}
 * - datos_campo.php?Codigo_Campo={codigo_campo}
 */

const fs = require('fs');
const path = require('path');

const TARGET_COMPETITIONS = [
  {
    id: '905431907',
    name: 'Lliga Preferent Infantil',
    groups: [{ id: '905431908', name: 'Grup - 1' }]
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

const FIELDS_CACHE_FILE = path.join(__dirname, 'fields_cache.json');
let fieldsCache = new Map();
if (fs.existsSync(FIELDS_CACHE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(FIELDS_CACHE_FILE, 'utf8'));
    fieldsCache = new Map(Object.entries(data));
  } catch (e) {}
}

function saveFieldsCache() {
  const obj = Object.fromEntries(fieldsCache);
  fs.writeFileSync(FIELDS_CACHE_FILE, JSON.stringify(obj, null, 2), 'utf8');
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function parseDate(str) {
  if (!str) return null;
  const parts = str.trim().split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  return str;
}

function parseTime(str) {
  if (!str) return '09:00:00';
  const trimmed = str.trim();
  if (trimmed.length === 5) return `${trimmed}:00`;
  return trimmed;
}

function cleanCrest(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `https://appwebffcv.novanet.es${url}`;
}

async function getFieldDetails(codigoCampo, defaultName = '') {
  if (!codigoCampo) return null;
  if (fieldsCache.has(codigoCampo)) {
    return fieldsCache.get(codigoCampo);
  }

  const url = `https://ffcv.es/competiciones/api/instalaciones/datos_campo.php?Codigo_Campo=${encodeURIComponent(codigoCampo)}`;
  const data = await fetchJson(url);

  const fieldObj = {
    codigo_campo: codigoCampo,
    nombre: data?.nombre_campo || defaultName,
    direccion: data?.direccion || null,
    localidad: data?.localidad || null,
    provincia: data?.provincia || 'Castelló',
    codigo_postal: data?.codigo_postal || null,
    superficie: data?.superficie_juego || null,
    latitude: data?.latitud ? parseFloat(data.latitud) : null,
    longitude: data?.longitud ? parseFloat(data.longitud) : null
  };

  fieldsCache.set(codigoCampo, fieldObj);
  return fieldObj;
}

if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

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

async function detectSegonaInfantil() {
  try {
    const data = await fetchJson('https://ffcv.es/competiciones/api/filtros/competiciones_fetch.php?cod_temporada=22');
    if (!data || !Array.isArray(data.competiciones)) return null;

    const segonaComp = data.competiciones.find(c => {
      const n = (c.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return (n.includes('segona') || n.includes('segunda') || n.includes('2a') || n.includes('2ª') || n.includes('2 regional')) &&
             n.includes('infantil') && !n.includes('futsal') && !n.includes('platja');
    });

    if (!segonaComp) return null;

    const grpData = await fetchJson(`https://ffcv.es/competiciones/api/filtros/grupos_fetch.php?cod_competicion=${encodeURIComponent(segonaComp.codigo)}`);
    if (!grpData || !Array.isArray(grpData.grupos)) return null;

    // Grupos 1 al 4 de Castelló
    const castellonGroups = grpData.grupos.filter(g => {
      const m = g.nombre.match(/\b([1-4])\b/) || g.nombre.match(/grup[^\d]*([1-4])/i);
      return Boolean(m);
    });

    if (castellonGroups.length === 0) return null;

    return {
      id: String(segonaComp.codigo),
      name: segonaComp.nombre,
      groups: castellonGroups.map(g => ({ id: String(g.codigo), name: g.nombre }))
    };
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('🚀 Iniciando extracción rápida de partidos, jornadas y clasificaciones FFCV...');
  const allMatches = [];

  const competitions = [...TARGET_COMPETITIONS];
  const segona = await detectSegonaInfantil();
  if (segona && segona.groups.length > 0) {
    console.log(`\n🎉 ¡Detectada ${segona.name} (${segona.id}) con ${segona.groups.length} grupos de Castelló!`);
    competitions.push(segona);
  } else {
    console.log('\n⏳ Segona Regional Infantil (Grupos 1 al 4 de Castelló):');
    console.log('   La FFCV aún no ha publicado los calendarios. El sistema los revisará automáticamente cada semana y los incorporará en cuanto FFCV los publique.');
  }

  for (const comp of competitions) {
    console.log(`\n🏆 ${comp.name} (${comp.id})`);

    for (const grp of comp.groups) {
      console.log(`  🔹 ${grp.name} (${grp.id})`);

      // 1. Obtener clasificación actual para puntos y posiciones
      console.log('     📊 Obteniendo clasificación y posiciones...');
      const clasifUrl = `https://ffcv.es/competiciones/api/clasificaciones/clasificaciones_ajax.php?cod_grupo=${encodeURIComponent(grp.id)}&cod_jornada=1`;
      const clasifData = await fetchJson(clasifUrl);
      const teamStatsMap = new Map();

      if (Array.isArray(clasifData?.clasificacion)) {
        for (const c of clasifData.clasificacion) {
          if (c.codequipo) {
            teamStatsMap.set(c.codequipo.toString(), {
              posicion: c.posicion ? `${c.posicion}º` : undefined,
              puntos: c.puntos != null ? c.puntos : 0
            });
          }
          if (c.nombre) {
            teamStatsMap.set(c.nombre.trim().toLowerCase(), {
              posicion: c.posicion ? `${c.posicion}º` : undefined,
              puntos: c.puntos != null ? c.puntos : 0
            });
          }
        }
      }

      // 2. Obtener lista de jornadas del grupo
      const jornadasUrl = `https://ffcv.es/competiciones/api/filtros/jornadas_fetch.php?cod_grupo=${encodeURIComponent(grp.id)}`;
      const jornadasData = await fetchJson(jornadasUrl);
      const jornadas = Array.isArray(jornadasData?.jornadas) ? jornadasData.jornadas : [];
      console.log(`     Total jornadas a procesar: ${jornadas.length}`);

      for (const jor of jornadas) {
        const codJornada = jor.codjornada || jor.nombre;
        const jornadaNombre = `Jornada ${jor.nombre || codJornada}`;

        const matchesUrl = `https://ffcv.es/competiciones/api/partidos/resultados_por_grupo_jornada_data.php?cod_grupo=${encodeURIComponent(grp.id)}&cod_jornada=${encodeURIComponent(codJornada)}`;
        const matchesData = await fetchJson(matchesUrl);
        const matchesList = Array.isArray(matchesData?.partidos) ? matchesData.partidos : [];

        for (const p of matchesList) {
          const homeStats = teamStatsMap.get(p.cod_equipo_local?.toString()) || teamStatsMap.get(p.local?.trim().toLowerCase());
          const awayStats = teamStatsMap.get(p.cod_equipo_visitante?.toString()) || teamStatsMap.get(p.visitante?.trim().toLowerCase());

          // Si el partido tiene codacta, obtener ficha de partido para asegurar campo y árbitros
          let codigoCampo = null;
          let confirmedField = p.campo || 'Por determinar';
          let confirmedDate = p.fecha;
          let confirmedTime = p.hora;
          let referees = [];

          if (p.codacta) {
            // Nota: para no saturar FFCV con 720 peticiones a la ficha, solo pedimos si es necesario
            // o si es la Jornada 1 para tener los datos de campos más inmediatos
            if (codJornada === '1' || !fieldsCache.has(p.campo)) {
              const fichaUrl = `https://ffcv.es/competiciones/api/partidos/ficha_partido_ajax.php?cod_partido=${encodeURIComponent(p.codacta)}`;
              const ficha = await fetchJson(fichaUrl);
              if (ficha) {
                if (ficha.codigo_campo) codigoCampo = ficha.codigo_campo;
                if (ficha.campo) confirmedField = ficha.campo;
                if (ficha.fecha) confirmedDate = ficha.fecha;
                if (ficha.hora) confirmedTime = ficha.hora;
                if (Array.isArray(ficha.arbitros_partido)) {
                  referees = ficha.arbitros_partido.map(a => `${a.nombre || ''} (${a.puesto || 'Árbitro'})`).filter(Boolean);
                }
              }
            }
          }

          let fieldInfo = null;
          if (codigoCampo) {
            fieldInfo = await getFieldDetails(codigoCampo, confirmedField);
          }

          const fechaPart = parseDate(confirmedDate);
          const horaPart = parseTime(confirmedTime);

          const isPlayed = p.estado === '1' || (p.resultado && p.resultado !== '0' && p.resultado !== 'x - x');
          let homeScore = null;
          let awayScore = null;

          if (p.resultado && p.resultado.includes('-')) {
            const [h, a] = p.resultado.split('-').map(s => parseInt(s.trim(), 10));
            if (!isNaN(h)) homeScore = h;
            if (!isNaN(a)) awayScore = a;
          }

          const matchRecord = {
            id: `ffcv-acta-${p.codacta || `${p.cod_equipo_local}-${p.cod_equipo_visitante}-${fechaPart}`}`,
            codacta: p.codacta || null,
            competition_name: comp.name,
            cod_competicion: comp.id,
            group_name: grp.name,
            cod_grupo: grp.id,
            matchday: jornadaNombre,
            match_date: fechaPart,
            time: horaPart,
            status: isPlayed ? 'Finalizado' : 'Programado',
            home_team_id: p.cod_equipo_local || '',
            home_team_name: p.local || 'Local',
            home_crest: cleanCrest(p.escudo_local),
            home_position: homeStats?.posicion || undefined,
            home_points: homeStats?.puntos != null ? homeStats.puntos : 0,
            away_team_id: p.cod_equipo_visitante || '',
            away_team_name: p.visitante || 'Visitante',
            away_crest: cleanCrest(p.escudo_visitante),
            away_position: awayStats?.posicion || undefined,
            away_points: awayStats?.puntos != null ? awayStats.puntos : 0,
            home_score: homeScore,
            away_score: awayScore,
            field_name: fieldInfo?.nombre || confirmedField,
            field_code: codigoCampo || fieldInfo?.codigo_campo || null,
            address: fieldInfo?.direccion || null,
            city: fieldInfo?.localidad || null,
            province: fieldInfo?.provincia || 'Castelló',
            postal_code: fieldInfo?.codigo_postal || null,
            surface: fieldInfo?.superficie || null,
            latitude: fieldInfo?.latitude || null,
            longitude: fieldInfo?.longitude || null,
            referees: referees,
            source: 'FFCV Scraping',
            scraped_at: new Date().toISOString()
          };

          allMatches.push(matchRecord);
        }
        process.stdout.write(`       [${jornadaNombre}] ${matchesList.length} partidos procesados.\r`);
      }
      console.log(`\n     ✅ Grupo ${grp.name} completado.`);
    }
  }

  saveFieldsCache();

  // Guardar archivo final de partidos
  const outPath = path.join(__dirname, '..', 'src', 'data', 'scraped_matches.json');
  fs.writeFileSync(outPath, JSON.stringify(allMatches, null, 2), 'utf8');
  console.log(`\n🎉 ¡Extracción de partidos completada con éxito!`);
  console.log(`   Total partidos guardados: ${allMatches.length} en ${outPath}`);
}

main().catch(console.error);
