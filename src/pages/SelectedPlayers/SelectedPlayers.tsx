import React from 'react';
import { Trophy } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../hooks/useAppStore';

export const SelectedPlayers: React.FC = () => {
  const { players } = useAppStore();

  const selectedPlayersList = players.filter(
    (p) => p.status === 'Seleccionado' || p.status === 'Preseleccionado'
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-400" />
          <span>Jugadors Seleccionats i Preseleccionats</span>
        </h1>
        <p className="text-xs text-slate-400">
          Plantilla oficial de la Selecció Sub-16 de Castelló
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {selectedPlayersList.map((player) => (
          <Card key={player.id} className="p-6 space-y-4" gradient>
            <div className="flex items-center justify-between">
              <Badge status={player.status} />
              <span className="text-xs font-mono font-bold text-slate-400">Dorsal #{player.jersey_number || 10}</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 border-2 border-emerald-400/40 flex items-center justify-center text-lg font-black text-white shadow-lg">
                {player.first_name[0]}
                {player.last_name[0]}
              </div>
              <div>
                <h3 className="text-base font-bold text-white uppercase">{player.full_name}</h3>
                <p className="text-xs text-emerald-400 font-semibold">{player.position}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{player.team?.name}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-300">
              <span>Assistències: <strong className="text-emerald-400">100%</strong></span>
              <span>Gols: <strong className="text-white">{player.sports_data?.goals || 0}</strong></span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
