/**
 * Utilitats de formatat de dates i hores per a la Selecció Valenciana Castelló.
 * Format requerit: dia-mes-any, dia de la setmana i després les hores.
 * Exemple: "Ds., 17-10-2026 · 10:00h" o "Dissabte, 17-10-2026 · 10:00h"
 */

export type LocaleCode = 'ca' | 'es' | 'ca-ES' | 'es-ES';

const WEEKDAYS_LONG_CA = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];
const WEEKDAYS_SHORT_CA = ['Dg.', 'Dl.', 'Dt.', 'Dc.', 'Dj.', 'Dv.', 'Ds.'];

const WEEKDAYS_LONG_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEKDAYS_SHORT_ES = ['Dom.', 'Lun.', 'Mar.', 'Mié.', 'Jue.', 'Vie.', 'Sáb.'];

const MONTHS_LONG_CA = [
  'gener', 'febrer', 'març', 'abril', 'maig', 'juny',
  'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'
];

const MONTHS_LONG_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Parsea una data de manera segura ignorant desplaçaments de zona horària UTC.
 */
export function parseDateSafe(input?: string | number | Date | null): {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  dayOfWeek: number; // 0-6 (0=Diumenge)
  hours: number;
  minutes: number;
  seconds: number;
  hasTime: boolean;
  isValid: boolean;
} {
  if (!input) {
    return { year: 0, month: 0, day: 0, dayOfWeek: 0, hours: 0, minutes: 0, seconds: 0, hasTime: false, isValid: false };
  }

  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      return { year: 0, month: 0, day: 0, dayOfWeek: 0, hours: 0, minutes: 0, seconds: 0, hasTime: false, isValid: false };
    }
    return {
      year: input.getFullYear(),
      month: input.getMonth() + 1,
      day: input.getDate(),
      dayOfWeek: input.getDay(),
      hours: input.getHours(),
      minutes: input.getMinutes(),
      seconds: input.getSeconds(),
      hasTime: input.getHours() !== 0 || input.getMinutes() !== 0 || input.getSeconds() !== 0,
      isValid: true,
    };
  }

  if (typeof input === 'number') {
    const d = new Date(input);
    return parseDateSafe(d);
  }

  const str = String(input).trim();
  if (!str) {
    return { year: 0, month: 0, day: 0, dayOfWeek: 0, hours: 0, minutes: 0, seconds: 0, hasTime: false, isValid: false };
  }

  // Format YYYY-MM-DD o YYYY-MM-DDTHH:MM...
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const hours = isoMatch[4] !== undefined ? parseInt(isoMatch[4], 10) : 0;
    const minutes = isoMatch[5] !== undefined ? parseInt(isoMatch[5], 10) : 0;
    const seconds = isoMatch[6] !== undefined ? parseInt(isoMatch[6], 10) : 0;
    const hasTime = isoMatch[4] !== undefined;

    const d = new Date(year, month - 1, day, hours, minutes, seconds);
    return {
      year,
      month,
      day,
      dayOfWeek: d.getDay(),
      hours,
      minutes,
      seconds,
      hasTime,
      isValid: !isNaN(d.getTime()),
    };
  }

  // Format DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] !== undefined ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] !== undefined ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] !== undefined ? parseInt(dmyMatch[6], 10) : 0;
    const hasTime = dmyMatch[4] !== undefined;

    const d = new Date(year, month - 1, day, hours, minutes, seconds);
    return {
      year,
      month,
      day,
      dayOfWeek: d.getDay(),
      hours,
      minutes,
      seconds,
      hasTime,
      isValid: !isNaN(d.getTime()),
    };
  }

  // Fallback natiu
  const native = new Date(str);
  if (!isNaN(native.getTime())) {
    return {
      year: native.getFullYear(),
      month: native.getMonth() + 1,
      day: native.getDate(),
      dayOfWeek: native.getDay(),
      hours: native.getHours(),
      minutes: native.getMinutes(),
      seconds: native.getSeconds(),
      hasTime: native.getHours() !== 0 || native.getMinutes() !== 0,
      isValid: true,
    };
  }

  return { year: 0, month: 0, day: 0, dayOfWeek: 0, hours: 0, minutes: 0, seconds: 0, hasTime: false, isValid: false };
}

/**
 * Neteja i normalitza un text d'hora a format HH:MM (ex: "15:30:00" -> "15:30", "9:5" -> "09:05")
 */
export function formatTimeClean(rawTime?: string | null): string {
  if (!rawTime) return '';
  const trimmed = rawTime.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    return `${h}:${m}`;
  }
  return trimmed;
}

export interface FormatDateOptions {
  /** 'short' (Ds.) o 'long' (Dissabte). Per defecte: 'short' */
  weekdayFormat?: 'short' | 'long' | 'none';
  /** Separador entre dia, mes i any: '-' o '/'. Per defecte: '-' */
  dateSeparator?: '-' | '/';
  /** 'numeric' (17-10-2026) o 'text' (17 d'octubre de 2026). Per defecte: 'numeric' */
  monthFormat?: 'numeric' | 'text';
  /** Hora addicional si no està a la pròpia data (ex: match.time) */
  time?: string | null;
  /** Afegir sufix 'h' a la hora (ex: 10:00h). Per defecte: true */
  timeSuffix?: boolean;
  /** Mostrar sempre la hora si està disponible. Per defecte: true */
  showTime?: boolean;
  /** Idioma 'ca' o 'es'. Per defecte: 'ca' */
  locale?: LocaleCode;
  /** Text quan no hi ha data vàlida */
  fallbackText?: string;
}

/**
 * Formata una data amb el dia de la setmana, dia-mes-any i posteriorment les hores.
 * Exemple: "Ds., 17-10-2026 · 10:00h"
 */
export function formatDateTimeCustom(
  dateInput?: string | number | Date | null,
  options?: FormatDateOptions
): string {
  const {
    weekdayFormat = 'short',
    dateSeparator = '-',
    monthFormat = 'numeric',
    time: explicitTime,
    timeSuffix = true,
    showTime = true,
    locale = 'ca',
    fallbackText = 'Data per definir',
  } = options || {};

  const parsed = parseDateSafe(dateInput);
  if (!parsed.isValid) {
    return fallbackText;
  }

  const isEs = locale === 'es' || locale === 'es-ES';
  const weekdaysLong = isEs ? WEEKDAYS_LONG_ES : WEEKDAYS_LONG_CA;
  const weekdaysShort = isEs ? WEEKDAYS_SHORT_ES : WEEKDAYS_SHORT_CA;
  const monthsLong = isEs ? MONTHS_LONG_ES : MONTHS_LONG_CA;

  // 1. Dia de la setmana
  let weekdayStr = '';
  if (weekdayFormat === 'short') {
    weekdayStr = `${weekdaysShort[parsed.dayOfWeek]} `;
  } else if (weekdayFormat === 'long') {
    weekdayStr = `${weekdaysLong[parsed.dayOfWeek]}, `;
  }

  // 2. Dia - Mes - Any
  const dd = String(parsed.day).padStart(2, '0');
  const mm = String(parsed.month).padStart(2, '0');
  const yyyy = String(parsed.year);

  let dateStr = '';
  if (monthFormat === 'text') {
    const monthName = monthsLong[parsed.month - 1];
    if (isEs) {
      dateStr = `${parsed.day} de ${monthName} de ${yyyy}`;
    } else {
      const deOrD = ['a', 'e', 'i', 'o', 'u'].includes(monthName[0]) ? "d'" : "de ";
      dateStr = `${parsed.day} ${deOrD}${monthName} de ${yyyy}`;
    }
  } else {
    dateStr = `${dd}${dateSeparator}${mm}${dateSeparator}${yyyy}`;
  }

  // 3. Hores
  let timeStr = '';
  if (showTime) {
    const cleanExplicit = formatTimeClean(explicitTime);
    if (cleanExplicit) {
      timeStr = ` · ${cleanExplicit}${timeSuffix ? 'h' : ''}`;
    } else if (parsed.hasTime) {
      const h = String(parsed.hours).padStart(2, '0');
      const m = String(parsed.minutes).padStart(2, '0');
      // Ignorem 00:00 si prové de dates ISO pures sense hora real
      if (h !== '00' || m !== '00') {
        timeStr = ` · ${h}:${m}${timeSuffix ? 'h' : ''}`;
      }
    }
  }

  return `${weekdayStr}${dateStr}${timeStr}`.trim();
}

/**
 * Format curt i complet ideal per a targetes i llistes:
 * "Ds., 17-10-2026 · 10:00h" o "Ds., 17-10-2026"
 */
export function formatAppDate(
  dateInput?: string | number | Date | null,
  timeInput?: string | null,
  locale: LocaleCode = 'ca'
): string {
  return formatDateTimeCustom(dateInput, {
    weekdayFormat: 'short',
    dateSeparator: '-',
    time: timeInput,
    locale,
  });
}

/**
 * Format llarg amb nom complet del dia de la setmana:
 * "Dissabte, 17-10-2026 · 10:00h" o "Dissabte, 17-10-2026"
 */
export function formatAppDateLong(
  dateInput?: string | number | Date | null,
  timeInput?: string | null,
  locale: LocaleCode = 'ca'
): string {
  return formatDateTimeCustom(dateInput, {
    weekdayFormat: 'long',
    dateSeparator: '-',
    time: timeInput,
    locale,
  });
}

/**
 * Format text per a capçaleres d'agenda o resums:
 * "Dissabte, 17 d'octubre de 2026"
 */
export function formatAppDateHeader(
  dateInput?: string | number | Date | null,
  locale: LocaleCode = 'ca'
): string {
  return formatDateTimeCustom(dateInput, {
    weekdayFormat: 'long',
    monthFormat: 'text',
    showTime: false,
    locale,
  });
}

/**
 * Format per a partits (Match): extreu match_date i match_time / time automàticament
 */
export function formatMatchDateTime(
  match?: { match_date?: string | null; match_time?: string | null; time?: string | null } | null,
  options?: { longWeekday?: boolean; locale?: LocaleCode }
): string {
  if (!match || !match.match_date) return 'Data per definir';
  const rawTime = match.match_time || match.time || '';
  return formatDateTimeCustom(match.match_date, {
    weekdayFormat: options?.longWeekday ? 'long' : 'short',
    time: rawTime,
    locale: options?.locale || 'ca',
  });
}
