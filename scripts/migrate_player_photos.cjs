#!/usr/bin/env node
/**
 * Migración única: convierte las fotos base64 de src/data/scraped_players.json en
 * ficheros de public/players/ y sustituye photo_url por su URL.
 *
 * Uso:
 *   node scripts/migrate_player_photos.cjs          # solo JSON + ficheros
 *   node scripts/migrate_player_photos.cjs --db     # además actualiza Supabase
 */

// Polyfill de WebSocket para Node < 22
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

const fs = require('fs');
const path = require('path');
const { toPhotoUrl } = require('./player_photos.cjs');

const playersPath = path.join(__dirname, '..', 'src', 'data', 'scraped_players.json');

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

async function main() {
  const players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
  let converted = 0;
  for (const p of players) {
    if (p.photo_url && p.photo_url.startsWith('data:')) {
      p.photo_url = toPhotoUrl(p.photo_url, p.ffcv_player_id || p.id);
      converted++;
    }
  }
  fs.writeFileSync(playersPath, JSON.stringify(players, null, 2), 'utf8');
  console.log(`🖼️  ${converted} fotos convertidas a ficheros en public/players/`);

  if (!process.argv.includes('--db')) return;

  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Credenciales de Supabase no encontradas (.env o variables de entorno)');
    process.exit(1);
  }

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // Solo se piden los ids de las filas con base64, sin descargar las fotos
  const { data: rows, error } = await supabase
    .from('players')
    .select('id, source_player_id')
    .like('photo_url', 'data:%')
    .limit(5000);
  if (error) {
    console.error('❌ Error leyendo jugadores:', error.message);
    process.exit(1);
  }

  const urlBySourceId = new Map(players.map((p) => [String(p.ffcv_player_id || ''), p.photo_url]));
  let updated = 0;
  for (const row of rows) {
    const url = urlBySourceId.get(String(row.source_player_id || '')) || null;
    const { error: upErr } = await supabase.from('players').update({ photo_url: url }).eq('id', row.id);
    if (upErr) console.warn(`   ⚠️ ${row.id}: ${upErr.message}`);
    else updated++;
  }
  console.log(`✅ ${updated}/${rows.length} jugadores actualizados en Supabase`);
}

main();
