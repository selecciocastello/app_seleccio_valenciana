/**
 * Utilitat per a formatar i normalitzar les competicions i grups oficials de la FFCV
 * (Preferent Infantil, 1ª Regional Infantil, 2ª Regional Infantil).
 */

export function normalizeGroup(group?: string | null): string {
  if (!group) return '';
  const clean = group.replace(/grup\s*[-–—:]*\s*/i, '').trim();
  if (!clean) return '';
  return `Grup ${clean}`;
}

export function normalizeCompetitionName(competition?: string | null): string {
  if (!competition) return 'Preferent Infantil';
  const c = competition.toLowerCase();
  
  if (c.includes('autonòmica') || c.includes('autonomica')) {
    return 'Lliga Autonòmica Infantil';
  }
  if (c.includes('preferent')) {
    return 'Preferent Infantil';
  }
  if (c.includes('primera') || c.includes('1a') || c.includes('1ª') || c.includes('1r') || c.includes('1 regional')) {
    return '1ª Regional Infantil';
  }
  if (c.includes('segona') || c.includes('segunda') || c.includes('2a') || c.includes('2ª') || c.includes('2 regional')) {
    return '2ª Regional Infantil';
  }
  
  return competition.replace(/^lliga\s+/i, '').trim() || 'Preferent Infantil';
}

/**
 * Retorna la clau o etiqueta canònica de la categoria (ex: "Preferent Infantil · Grup 1", "1ª Regional Infantil · Grup 1")
 */
export function formatCompetition(competition?: string | null, group?: string | null): string {
  const compName = normalizeCompetitionName(competition);
  const grpName = normalizeGroup(group);
  return grpName ? `${compName} · ${grpName}` : compName;
}

/**
 * Retorna versió curta per a espais reduïts (ex: "Preferent · G1", "1ª Reg · G1")
 */
export function formatCompetitionShort(competition?: string | null, group?: string | null): string {
  const compName = normalizeCompetitionName(competition);
  const grpName = normalizeGroup(group);
  const shortGrp = grpName ? grpName.replace('Grup ', 'G') : '';

  let shortComp = 'Preferent';
  if (compName.includes('Autonòmica')) {
    shortComp = 'Autonòmica';
  } else if (compName.includes('1ª Regional')) {
    shortComp = '1ª Regional';
  } else if (compName.includes('2ª Regional')) {
    shortComp = '2ª Regional';
  } else if (compName.includes('Preferent')) {
    shortComp = 'Preferent';
  }

  return shortGrp ? `${shortComp} · ${shortGrp}` : shortComp;
}
