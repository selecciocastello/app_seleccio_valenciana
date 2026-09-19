import React from 'react';
import { Calendar as CalendarIcon, ShieldAlert, Dumbbell } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../hooks/useAppStore';

export const CalendarView: React.FC = () => {
  const { callups, trainings } = useAppStore();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white uppercase tracking-wider">Calendari d'Esdeveniments</h1>
        <p className="text-xs text-slate-400">
          Vista unificada de Convocatòries, Partits d'observació i Entrenaments
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-3 p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-emerald-400" />
            <span>Pròxims Esdeveniments Programats</span>
          </h3>

          <div className="space-y-3">
            {callups.map((c) => (
              <div key={c.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-blue-400 uppercase">Convocatòria Oficial</span>
                    <h4 className="text-sm font-bold text-white">{c.title}</h4>
                    <p className="text-xs text-slate-400">{c.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge status={c.status} />
                  <p className="text-xs font-semibold text-slate-400 mt-1">
                    {new Date(c.date).toLocaleDateString('ca-ES')}
                  </p>
                </div>
              </div>
            ))}

            {trainings.map((t) => (
              <div key={t.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">Entrenament Tàctic</span>
                    <h4 className="text-sm font-bold text-white">{t.title}</h4>
                    <p className="text-xs text-slate-400">{t.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="success">Programat</Badge>
                  <p className="text-xs font-semibold text-slate-400 mt-1">
                    {new Date(t.start_time).toLocaleDateString('ca-ES')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
