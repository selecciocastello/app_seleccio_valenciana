import type { PlayerHistoryItem, InfantilYear } from '../types/models';

/**
 * Comprova si una categoria correspon estrictament a "Alevín 1er. Año" / "Aleví 1r Any"
 */
function isAlevin1erAno(categoria?: string | null): boolean {
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
 * Comprova si una categoria correspon a "Alevín 2º. Año" o Aleví genèric (no 1er any)
 */
function isAlevin2oAno(categoria?: string | null): boolean {
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
 * Determina si un jugador és "Infantil 1er any", "Infantil 2º año" o "Alevín 2º año"
 * segons les regles federatives establertes:
 *
 * 1. Si a la temporada 2025-2026 figura com a "Alevín 1er. Año"
 *    -> el jugador és "Alevín 2º año".
 * 2. Infantil 1er any:
 *    - Si a la temporada 2025-2026 figura com a "Alevín 2º. Año" (o Aleví genèric).
 *    - O si a la temporada 2024-2025 (2 temporades anteriors) figura com a "Alevín 1er. Año".
 * 3. Infantil 2º año:
 *    - Si a la temporada 2025-2026 figura en "Infantil" o "Cadet" (i no complia la condició d'Aleví 1er any a la 24-25).
 * 4. Fallback per edat federativa:
 *    - <= 11 anys -> Alevín 2º año
 *    - 12 anys -> Infantil 1er any
 *    - >= 13 anys -> Infantil 2º año
 */
export function calculateInfantilYear(
  history?: PlayerHistoryItem[] | null,
  age?: number | null,
  existingYear?: string | null
): InfantilYear {
  if (history && Array.isArray(history) && history.length > 0) {
    const season2425 = history.find((h) => {
      const t = (h.temporada || '').toLowerCase().replace(/\s+/g, '');
      return t.startsWith('2024-2025') || t.startsWith('24-25') || t.startsWith('2024/2025');
    });

    const season2526 = history.find((h) => {
      const t = (h.temporada || '').toLowerCase().replace(/\s+/g, '');
      return t.startsWith('2025-2026') || t.startsWith('25-26') || t.startsWith('2025/2026');
    });

    // 1. Si a la temporada 2025-2026 era Aleví 1er any -> actualment és Aleví 2º año
    if (season2526 && isAlevin1erAno(season2526.categoria)) {
      return 'Alevín 2º año';
    }

    // 2. Infantil 1er any:
    // - Si a la 25-26 era Aleví 2º año (o Aleví genèric)
    // - O si a la 24-25 era Aleví 1er any
    if (season2526 && isAlevin2oAno(season2526.categoria)) {
      return 'Infantil 1er año';
    }
    if (season2425 && isAlevin1erAno(season2425.categoria)) {
      return 'Infantil 1er año';
    }

    // 3. Infantil 2º año:
    // - Si a la 25-26 ja militava en Infantil o Cadet
    if (season2526) {
      const cat2526 = (season2526.categoria || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
      if (cat2526.includes('infantil') || cat2526.includes('cadet')) {
        return 'Infantil 2º año';
      }
    }
  }

  // Fallback per edat federativa
  if (typeof age === 'number' && !isNaN(age)) {
    if (age <= 11) return 'Alevín 2º año';
    if (age === 12) return 'Infantil 1er año';
    if (age >= 13) return 'Infantil 2º año';
  }

  // Fallback valor existent
  if (existingYear && existingYear !== 'Desconocido' && existingYear !== 'Desconegut') {
    return existingYear as InfantilYear;
  }

  return 'Desconocido';
}
