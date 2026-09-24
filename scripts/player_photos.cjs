/**
 * Guarda las fotos de jugadores (que la FFCV sirve incrustadas en base64) como
 * ficheros estáticos en public/players/ para que Vercel las sirva por URL.
 * Así la tabla players de Supabase solo guarda una URL corta y no cientos de KB
 * por consulta (el egress del plan free de Supabase es limitado).
 */

const fs = require('fs');
const path = require('path');

const PHOTOS_DIR = path.join(__dirname, '..', 'public', 'players');
const PHOTOS_URL_PREFIX = '/players';

function detectExtension(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'png';
  if (buffer.slice(0, 4).toString() === 'GIF8') return 'gif';
  if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return 'webp';
  return 'jpg';
}

/**
 * Devuelve una URL para la foto: si es un data URI lo escribe a disco y devuelve
 * la ruta pública; si ya es una URL la devuelve tal cual.
 */
function toPhotoUrl(photo, playerId) {
  if (!photo) return null;
  if (!photo.startsWith('data:')) return photo;
  if (!playerId) return null;

  const base64 = photo.slice(photo.indexOf(',') + 1);
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) return null;

  const ext = detectExtension(buffer);
  const safeId = String(playerId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeId}.${ext}`;

  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  const filePath = path.join(PHOTOS_DIR, fileName);
  if (!fs.existsSync(filePath) || !fs.readFileSync(filePath).equals(buffer)) {
    fs.writeFileSync(filePath, buffer);
  }
  return `${PHOTOS_URL_PREFIX}/${fileName}`;
}

module.exports = { toPhotoUrl, PHOTOS_DIR };
