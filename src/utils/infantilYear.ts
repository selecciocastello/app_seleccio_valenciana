import type { PlayerHistoryItem, InfantilYear } from '../types/models';

/**
 * Determina si un jugador és "Infantil 1er any", "Infantil 2n any" o "Desconegut"
 * basant-se en el seu historial de temporades federatives FFCV i l'edat:
 *
 * 1. Si en temporades anteriors (2025-2026, etc.) apareix en "Cadete" o "Infantil" -> Infantil 2º año.
 * 2. Si en temporades anteriors apareix en "Alevín" (Aleví) -> Infantil 1er año.
 * 3. Fallback per edat (>= 13 anys -> 2º año, 12 anys -> 1er año).
 */
export function calculateInfantilYear(
  history?: PlayerHistoryItem[] | null,
  age?: number | null,
  existingYear?: string | null
): InfantilYear {
  if (history && Array.isArray(history) && history.length > 0) {
    // Filtrar temporades anteriors a l'actual (2026-2027)
    const prevSeasons = history.filter((h) => {
      const t = (h.temporada || '').toLowerCase().replace(/\s+/g, '');
      return !t.startsWith('2026-2027') && !t.startsWith('26-27') && !t.startsWith('2026/2027');
    });

    if (prevSeasons.length > 0) {
      const allCategories = prevSeasons.map((h) =>
        (h.categoria || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
      );

      // Si en la temporada anterior apareix Cadete o Infantil -> Infantil 2º año
      const hasCadeteOrInfantil = allCategories.some(
        (cat) => cat.includes('cadet') || cat.includes('infantil')
      );
      if (hasCadeteOrInfantil) {
        return 'Infantil 2º año';
      }

      // Si en la temporada anterior era Alevín (Aleví) -> Infantil 1er año
      const hasAlevin = allCategories.some(
        (cat) => cat.includes('alevin') || cat.includes('alevi')
      );
      if (hasAlevin) {
        return 'Infantil 1er año';
      }
    }
  }

  // Fallback si ja té un any assignat vàlid
  if (existingYear && existingYear !== 'Desconocido' && existingYear !== 'Desconegut') {
    return existingYear as InfantilYear;
  }

  // Fallback per edat
  if (typeof age === 'number' && !isNaN(age)) {
    if (age >= 13) return 'Infantil 2º año';
    if (age === 12) return 'Infantil 1er año';
  }

  return 'Desconocido';
}
