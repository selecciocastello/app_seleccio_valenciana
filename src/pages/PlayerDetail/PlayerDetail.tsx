import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldAlert,
  Dumbbell,
  FileSpreadsheet,
  History,
  Activity,
  Edit,
  Database,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';

export const PlayerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { players, updatePlayer } = useAppStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'resumen' | 'datos' | 'convocatorias' | 'entrenamientos' | 'informes' | 'historico'>('resumen');

  const player = players.find((p) => p.id === id) || players[0];

  const handleStatusChange = (newStatus: string) => {
    updatePlayer(player.id, { status: newStatus as any });
    showToast(`Estat actualitzat a: ${newStatus}`, 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <Link
        to="/jugadores"
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Tornar al llistat de jugadors
      </Link>

      {/* Profile Header Card */}
      <Card className="p-6" gradient>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 border-2 border-emerald-400/40 flex items-center justify-center text-2xl font-black text-white shadow-xl">
              {player.first_name[0]}
              {player.last_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-white uppercase">{player.full_name}</h1>
                <Badge status={player.status} />
              </div>
              <p className="text-sm font-semibold text-emerald-400 mt-0.5">
                {player.position} • {player.team?.name}
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-300 mt-2">
                <span>Dorsal: #{player.jersey_number || 10}</span>
                <span>•</span>
                <span>Peu: {player.dominant_foot || 'Diestro'}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {player.city || 'Castelló'}
                </span>
              </div>
            </div>
          </div>

          {/* Acciones Rápidas */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={player.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-slate-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none"
            >
              <option value="Candidato">Estat: Candidat</option>
              <option value="Observado">Estat: Observat</option>
              <option value="Preseleccionado">Estat: Preseleccionat</option>
              <option value="Seleccionado">Estat: Seleccionat</option>
              <option value="Lesionado">Estat: Lesionat</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 overflow-x-auto pb-1">
        {[
          { id: 'resumen', label: 'Resum', icon: Activity },
          { id: 'datos', label: 'Dades Esportives', icon: Edit },
          { id: 'convocatorias', label: 'Convocatòries', icon: ShieldAlert },
          { id: 'entrenamientos', label: 'Entrenaments', icon: Dumbbell },
          { id: 'informes', label: 'Informes Tècnics', icon: FileSpreadsheet },
          { id: 'historico', label: 'Històric', icon: History }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-slate-900 text-emerald-400 border-t border-x border-slate-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'resumen' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-5 md:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-white">Estadístiques Principals</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400 uppercase">Partits Jugats</p>
                <p className="text-2xl font-black text-white mt-1">
                  {player.sports_data?.matches_played || 18}
                </p>
              </div>
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400 uppercase">Gols / Asist</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  {player.sports_data?.goals || 0} / {player.sports_data?.assists || 0}
                </p>
              </div>
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400 uppercase">Minuts Jugats</p>
                <p className="text-2xl font-black text-white mt-1">
                  {player.sports_data?.minutes || 1450}'
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-base font-bold text-white">Metadades de Scraping</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Font Dades:</span>
                <span className="text-white font-semibold flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-sky-400" />
                  {player.source}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">ID Extern:</span>
                <span className="text-white font-mono">{player.source_player_id || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Edició Manual:</span>
                <span className="text-emerald-400 font-semibold">
                  {player.is_manual_override ? 'Sí (Protegit)' : 'No'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'historico' && (
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-bold text-white">Històric de Convocatòries i Assistència</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div>
                <span className="text-xs font-bold text-emerald-400">15/10/2026 • Sub-16</span>
                <h4 className="text-sm font-bold text-white">I Convocatòria Selecció Castelló</h4>
                <p className="text-xs text-slate-400">Seleccionador: Vicent Ribes</p>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-300">Va Assistir</span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
