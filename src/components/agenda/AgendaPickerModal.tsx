import React from 'react';
import { CalendarCheck, Check, Plus, X } from 'lucide-react';
import { useAppStore } from '../../hooks/useAppStore';
import { useSelectors } from '../../hooks/useSelectors';
import { useToast } from '../../contexts/ToastContext';
import { isSameSelector, isMatchSchedulable } from '../../utils/agenda';
import { formatMatchDateTime } from '../../utils/dateFormatter';
import type { Match } from '../../types/models';

interface AgendaPickerModalProps {
  match: Match | null;
  onClose: () => void;
}

/** Tria a l'agenda de quin seleccionador va un partit (es pot afegir a més d'una). */
export const AgendaPickerModal: React.FC<AgendaPickerModalProps> = ({ match, onClose }) => {
  const { agenda, addToAgenda, removeFromAgenda } = useAppStore();
  const { selectors, currentSelectorName } = useSelectors();
  const { showToast } = useToast();

  if (!match) return null;

  const home = match.home_team_name || match.home_team?.name || 'Local';
  const away = match.away_team_name || match.away_team?.name || 'Visitant';
  const formattedDate = formatMatchDateTime(match, { longWeekday: true });

  // Un partit ja jugat no es pot afegir; sí que es pot traure d'una agenda
  const schedulable = isMatchSchedulable(match);
  const visibleSelectors = schedulable
    ? selectors
    : selectors.filter((s) => agenda.some((a) => a.match_id === match.id && isSameSelector(a.selector_name, s)));

  const handleToggle = (selector: string) => {
    const existing = agenda.find((a) => a.match_id === match.id && isSameSelector(a.selector_name, selector));
    if (existing) {
      removeFromAgenda(existing.id);
      showToast(`Partit tret de l'agenda de ${selector}`, 'info');
    } else {
      addToAgenda(match, selector);
      showToast(`Partit afegit a l'agenda de ${selector}`, 'success');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 bg-[#061338] text-white">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#ff6600] flex items-center gap-1">
              <CalendarCheck className="w-3.5 h-3.5" /> Afegir a l'agenda
            </span>
            <h3 className="text-sm font-black mt-1 break-words">
              {home} vs {away}
            </h3>
            <p className="text-[11px] text-sky-200 font-semibold mt-0.5">
              📅 {formattedDate}
              {match.field_name ? ` · ${match.field_name}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10" aria-label="Tancar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 px-1">
            {schedulable
              ? "De quin seleccionador és l'agenda?"
              : "Aquest partit ja s'ha jugat: no es pot afegir a cap agenda."}
          </p>
          {visibleSelectors.map((selector) => {
            const inAgenda = agenda.some((a) => a.match_id === match.id && isSameSelector(a.selector_name, selector));
            const isMe = isSameSelector(selector, currentSelectorName);
            return (
              <button
                key={selector}
                type="button"
                onClick={() => handleToggle(selector)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                  inAgenda
                    ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-white border-slate-200 hover:border-[#ff6600] hover:bg-orange-50'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-[#002568] text-white text-[11px] font-black flex items-center justify-center shrink-0">
                    {selector.substring(0, 2).toUpperCase()}
                  </span>
                  <span className="text-sm font-black text-[#061338] truncate">
                    {selector}
                    {isMe && <span className="ml-1.5 text-[10px] font-bold text-slate-400">(tu)</span>}
                  </span>
                </span>
                {inAgenda ? (
                  <span className="text-[11px] font-black text-emerald-700 flex items-center gap-1 shrink-0">
                    <Check className="w-4 h-4" /> {schedulable ? "A l'agenda" : 'Traure'}
                  </span>
                ) : (
                  <span className="text-[11px] font-black text-[#ff6600] flex items-center gap-1 shrink-0">
                    <Plus className="w-4 h-4" /> Afegir
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#061338] hover:bg-[#002568] text-white text-xs font-black transition-colors"
          >
            Fet
          </button>
        </div>
      </div>
    </div>
  );
};
