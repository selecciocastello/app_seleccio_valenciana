import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import clsx from 'clsx';
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
  CheckCircle2,
  Award
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

  const prevSeason = (player.history || []).find((h) => {
    const t = (h.temporada || '').replace(/\s+/g, '');
    return t.includes('2025-2026') || t.includes('25-26');
  });

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
            {player.photo_url ? (
              <img
                src={player.photo_url}
                alt={player.full_name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-400/40 shadow-xl"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 border-2 border-emerald-400/40 flex items-center justify-center text-2xl font-black text-white shadow-xl">
                {player.first_name[0]}
                {player.last_name[0]}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black text-white uppercase">{player.full_name}</h1>
                <Badge status={player.status} />
                {player.infantil_year && (
                  <span
                    className={clsx(
                      "px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm",
                      player.infantil_year === 'Infantil 1er año' && "bg-sky-500/20 text-sky-300 border-sky-400/40",
                      player.infantil_year === 'Infantil 2º año' && "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
                      player.infantil_year === 'Desconocido' && "bg-slate-700/40 text-slate-300 border-slate-600"
                    )}
                  >
                    {player.infantil_year}
                  </span>
                )}
                {player.age && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/10 text-slate-200 border border-white/10">
                    {player.age} anys
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-emerald-400 mt-1">
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
        <div className="space-y-6">
          {/* Card Historial FFCV Oficial */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Historial de Temporades (FFCV)</h3>
                  <p className="text-xs text-slate-400">
                    Trajectòria esportiva oficial extreta de la Federació de Futbol de la Comunitat Valenciana
                  </p>
                </div>
              </div>

              {player.infantil_year && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">Classificació:</span>
                  <span
                    className={clsx(
                      "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border",
                      player.infantil_year === 'Infantil 1er año' && "bg-sky-500/20 text-sky-300 border-sky-400/40",
                      player.infantil_year === 'Infantil 2º año' && "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
                      player.infantil_year === 'Desconocido' && "bg-slate-800 text-slate-300 border-slate-700"
                    )}
                  >
                    {player.infantil_year}
                  </span>
                </div>
              )}
            </div>

            {/* Banner de explicación de año infantil */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-start gap-3">
              <Award className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-200">
                  Criteri d'Assignació d'Any Infantil:
                </p>
                <p className="text-slate-400">
                  {prevSeason ? (
                    <>
                      A la temporada anterior (<strong className="text-white">2025-2026</strong>) va militar a <strong className="text-sky-300">{prevSeason.equipo}</strong> en la categoria <strong className="text-sky-300">{prevSeason.categoria}</strong>.{' '}
                      {player.infantil_year === 'Infantil 1er año'
                        ? 'En haver competit com a Aleví 2n any a la 25/26, li correspon la categoria d\'Infantil de 1er any per a la 26/27.'
                        : (player.infantil_year === 'Infantil 2º año'
                          ? 'En haver competit ja en categoria Infantil a la 25/26, li correspon la categoria d\'Infantil de 2n any per a la 26/27.'
                          : 'Determinació basada en el registre federatiu.')}
                    </>
                  ) : (
                    'No consta registre federatiu de la temporada 2025-2026 per a aquest jugador en el seu historial, per la qual cosa es classifica com a Desconegut.'
                  )}
                </p>
              </div>
            </div>

            {/* Tabla de Trayectoria */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0b1c33] text-white font-black uppercase tracking-wider border-b border-slate-800">
                    <th className="p-3.5">Temporada</th>
                    <th className="p-3.5 text-center">Escut</th>
                    <th className="p-3.5">Equip</th>
                    <th className="p-3.5">Categoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {(!player.history || player.history.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-500 font-bold">
                        Sense historial de temporades registrat.
                      </td>
                    </tr>
                  ) : (
                    player.history.map((h, idx) => {
                      const isTargetPrevSeason = (h.temporada || '').includes('2025-2026');
                      return (
                        <tr
                          key={idx}
                          className={clsx(
                            "hover:bg-slate-900/60 transition-colors",
                            isTargetPrevSeason && "bg-sky-950/20 font-bold"
                          )}
                        >
                          <td className="p-3.5 text-white font-bold flex items-center gap-2">
                            <span>{h.temporada}</span>
                            {isTargetPrevSeason && (
                              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md border border-sky-500/30">
                                Anterior (25/26)
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            {h.escudo_url ? (
                              <img
                                src={h.escudo_url}
                                alt={h.equipo}
                                className="w-7 h-7 mx-auto object-contain"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-200 font-semibold">{h.equipo}</td>
                          <td className="p-3.5 text-slate-300">{h.categoria}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Històric de Convocatòries i Assistència */}
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
        </div>
      )}
    </div>
  );
};
