import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppStore } from './useAppStore';
import { normalizeSelectorName } from '../utils/agenda';

/**
 * Seleccionadors que poden tindre agenda: l'usuari actual, els seleccionadors registrats
 * actius i qualsevol tècnic que ja tinga partits a l'agenda. Sense duplicats per accents.
 */
export function useSelectors() {
  const { user, users } = useAuth();
  const { agenda } = useAppStore();
  const currentSelectorName = user?.full_name || 'Seleccionador';

  const selectors = useMemo(() => {
    const byKey = new Map<string, string>();
    const add = (name?: string) => {
      if (!name || !name.trim()) return;
      const key = normalizeSelectorName(name);
      if (!byKey.has(key)) byKey.set(key, name.trim());
    };
    add(user?.full_name);
    agenda.forEach((a) => add(a.selector_name));
    users
      .filter((u) => u.is_active && u.role?.name === 'seleccionador')
      .forEach((u) => add(u.full_name));
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, 'ca'));
  }, [user, users, agenda]);

  return { selectors, currentSelectorName };
}
