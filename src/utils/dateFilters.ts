// Fecha de hoy en formato YYYY-MM-DD (zona horaria local), para comparar con fechas guardadas como string
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// true si la fecha (string YYYY-MM-DD o ISO) es hoy o posterior
export function isTodayOrFuture(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) >= getTodayDateString();
}
