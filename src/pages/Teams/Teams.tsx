import React from 'react';
import { Card } from '../../components/ui/Card';
import { useAppStore } from '../../hooks/useAppStore';
import { MapPin } from 'lucide-react';

export const Teams: React.FC = () => {
  const { teams } = useAppStore();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Equips i Clubs de Castelló</h1>
        <p className="text-xs text-slate-400">
          Clubs d'origen dels jugadors candidats per a les convocatòries territorials
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <Card key={team.id} className="p-6 space-y-4" gradient>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-emerald-400 font-black text-lg shadow-inner">
                {team.name[0]}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{team.name}</h3>
                <p className="text-xs text-slate-400">{team.club}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Camp:
                </span>
                <span className="font-semibold text-white">{team.field_name}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Localitat:</span>
                <span className="font-semibold text-white">{team.city}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
