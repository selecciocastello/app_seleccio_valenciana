import React from 'react';
import { Trophy } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { JerseyBadge } from '../../components/ui/JerseyBadge';
import { useAppStore } from '../../hooks/useAppStore';

export const SelectedPlayers: React.FC = () => {
  const { players } = useAppStore();

  const selectedPlayersList = players.filter(
    (p) => p.status === 'Seleccionado' || p.status === 'Preseleccionado'
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[#061338] uppercase tracking-wider flex items-center gap-2">
          <Trophy className="w-6 h-6 text-[#ff6600]" />
          <span>Jugadors Seleccionats i Preseleccionats</span>
        </h1>
        <p className="text-xs font-semibold text-slate-600 mt-1">
          Plantilla oficial de la Selecció Territorial Infantil de Castelló
        </p>
      </div>

      {selectedPlayersList.length === 0 ? (
        <Card className="p-12 text-center bg-white border border-dashed border-slate-200 shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-full bg-orange-50 text-[#ff6600] mx-auto flex items-center justify-center">
            <Trophy className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
            Sense jugadors seleccionats actualment
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            La llista oficial de preseleccionats i seleccionats està buida. Canvia l'estat d'un jugador des de la seua fitxa tècnica o des de l'Agenda d'observacions per a incloure'l ací.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {selectedPlayersList.map((player) => (
            <Card key={player.id} className="p-6 space-y-4" gradient>
              <div className="flex items-center justify-between">
                <Badge status={player.status} />
                <JerseyBadge number={player.jersey_number || 10} size="sm" variant="kit" color="blue" />
              </div>

              <div className="flex items-center gap-4">
                {player.photo_url ? (
                  <img
                    src={player.photo_url}
                    alt={player.full_name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white/20 shadow-md"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#ff6600] to-amber-500 border-2 border-white/20 flex items-center justify-center text-lg font-black text-white shadow-lg">
                    {player.first_name[0]}
                    {player.last_name[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-black text-white uppercase">{player.full_name}</h3>
                  <p className="text-xs text-sky-200 font-bold">{player.position}</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">{player.team?.name}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-between text-xs text-slate-200">
                <span>Assistències: <strong className="text-emerald-300">100%</strong></span>
                <span>Gols: <strong className="text-white">{player.sports_data?.Goles || player.sports_data?.goals || 0}</strong></span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
