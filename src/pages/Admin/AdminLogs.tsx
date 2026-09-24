import React from 'react';
import { Card } from '../../components/ui/Card';
import { useLanguage } from '../../contexts/LanguageContext';

export const AdminLogs: React.FC = () => {
  const { t } = useLanguage();

  const mockLogs = [
    { id: '1', date: '19/09/2026 11:41:02', user: 'Admin', action: 'LOGIN_SUCCESS', details: 'Accés correcte al sistema' },
    { id: '2', date: '19/09/2026 11:35:10', user: 'Vicent Ribes', action: 'CREATE_CALLUP', details: 'Nova Convocatòria Sub-16' },
    { id: '3', date: '19/09/2026 10:14:05', user: 'Vicent Ribes', action: 'UPDATE_PLAYER_STATUS', details: 'Jugador Marc Beltrán canviat a Seleccionat' },
    { id: '4', date: '18/09/2026 18:20:00', user: 'System Scraping', action: 'SCRAPING_JOB_SUCCESS', details: '3 jugadors nous actualitzats' }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[#061338] uppercase tracking-wider">{t.logs}</h1>
        <p className="text-xs font-semibold text-slate-600">
          Registre d'auditoria de seguretat i canvis realitzats en la plataforma
        </p>
      </div>

      <Card className="overflow-hidden bg-white border border-slate-200/90 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                <th className="p-4">Data / Hora</th>
                <th className="p-4">Usuari</th>
                <th className="p-4">Acció</th>
                <th className="p-4">Detalls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {mockLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-500">{log.date}</td>
                  <td className="p-4 font-bold text-[#061338]">{log.user}</td>
                  <td className="p-4 text-emerald-700 font-semibold">{log.action}</td>
                  <td className="p-4 text-slate-600">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
