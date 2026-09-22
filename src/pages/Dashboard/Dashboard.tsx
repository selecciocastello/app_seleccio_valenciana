import React from 'react';
import {
  Users,
  Trophy,
  ShieldAlert,
  Dumbbell,
  Calendar,
  ArrowUpRight,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../hooks/useAppStore';

export const Dashboard: React.FC = () => {
  const { players, callups, trainings } = useAppStore();

  const totalPlayers = players.length;
  const selectedCount = players.filter((p) => p.status === 'Seleccionado').length;

  const nextCallup = callups[0];
  const nextTraining = trainings[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header Banner FFCV (Idéntico al de la imagen FFCV) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#061338] via-[#002568] to-[#003db3] p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-sky-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
              <Trophy className="w-3.5 h-3.5 text-[#ff6600]" /> SELECCIÓ TERRITORIAL CASTELLÓ
            </div>
            <h1 className="text-2xl md:text-3xl font-black italic tracking-wide uppercase">
              PRIMERA FFCV - GRUP 1
            </h1>
            <p className="text-xs md:text-sm text-slate-200">
              Seguiment tècnic i gestió de jugadors de la província de Castelló
            </p>
          </div>

          {/* Search bar inside banner like FFCV */}
          <div className="w-full md:w-72 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar club o jugador..."
              className="w-full bg-white text-slate-900 placeholder-slate-400 rounded-full pl-10 pr-4 py-2 text-xs font-medium border-0 shadow-md focus:outline-none focus:ring-2 focus:ring-[#ff6600]"
            />
          </div>
        </div>

        {/* Decorative background logo curve */}
        <img
          src="/logo_seleccio.png"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }}
          alt="Watermark"
          className="absolute -right-8 -bottom-10 w-64 h-64 opacity-15 pointer-events-none object-contain"
        />
      </div>

      {/* 2. Filtros de Selección Estilo FFCV (Temporada, Modalidad, Competición, Grupo) */}
      <Card className="p-4 md:p-6 bg-white space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-black uppercase text-slate-700 mb-1 tracking-wider">
              TEMPORADA
            </label>
            <select className="w-full bg-white border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 shadow-sm focus:border-[#002568] focus:outline-none">
              <option>2026-2027</option>
              <option>2025-2026</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase text-slate-700 mb-1 tracking-wider">
              MODALIDAD
            </label>
            <select className="w-full bg-white border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 shadow-sm focus:border-[#002568] focus:outline-none">
              <option>MASCULÍ F11</option>
              <option>FEMENÍ F11</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase text-slate-700 mb-1 tracking-wider">
              COMPETICIÓ
            </label>
            <select className="w-full bg-white border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 shadow-sm focus:border-[#002568] focus:outline-none">
              <option>Primera FFCV Sub-16</option>
              <option>Preferent Sub-14</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black uppercase text-slate-700 mb-1 tracking-wider">
              GRUPO
            </label>
            <select className="w-full bg-white border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 shadow-sm focus:border-[#002568] focus:outline-none">
              <option>Grup - 1 (Castelló)</option>
            </select>
          </div>
        </div>

        {/* Date Selector Pills (Idénticos a FFCV) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            <button className="w-8 h-8 rounded-full bg-[#ff6600] text-white flex items-center justify-center shrink-0 shadow-md">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="px-4 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0">
              09-09-2026
            </button>
            <button className="px-4 py-1.5 rounded-full bg-[#061338] text-white text-xs font-bold shrink-0 shadow-md">
              16-09-2026
            </button>
            <button className="w-8 h-8 rounded-full bg-[#ff6600] text-white flex items-center justify-center shrink-0 shadow-md">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Link
            to="/convocatorias"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#ff6600] hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-full shadow-md transition-all shrink-0"
          >
            <ShieldAlert className="w-4 h-4" /> Nova Convocatòria
          </Link>
        </div>
      </Card>

      {/* 3. Título de Sección y Cards de Jugadores / Sanciones Estilo FFCV */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h2 className="text-lg font-black text-[#061338] tracking-wide uppercase">
            JUGADORS OBSERVATS I CITATS PER CLUBS
          </h2>
          <span className="text-xs font-bold text-slate-500">Actualitzat: Dimecres, 16 de setembre de 2026</span>
        </div>

        {/* Grid de Cards de Equipos y Jugadores estilo FFCV */}
        {(() => {
          const activeObserved = players.filter(
            (p) => p.status === 'Observado' || p.status === 'Preseleccionado' || p.status === 'Seleccionado'
          );

          if (activeObserved.length === 0) {
            return (
              <Card className="p-8 text-center bg-white border border-dashed border-slate-200 shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                    Sense jugadors en seguiment prioritari
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Actualment la llista de candidats i preseleccionats està buida. Pots marcar jugadors com a observats o candidats des del cens o en finalitzar una observació en l'Agenda.
                  </p>
                </div>
                <Link
                  to="/jugadores"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#061338] hover:bg-[#002568] text-white text-xs font-bold rounded-full transition-all"
                >
                  <Users className="w-3.5 h-3.5" /> Explorar Cens de Jugadors
                </Link>
              </Card>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {activeObserved.slice(0, 4).map((player) => (
                <Card key={player.id} className="p-5 space-y-3 bg-white border border-slate-200/90 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-[#061338]">{player.team?.name || 'Club Castelló'}</h3>
                    <Badge status={player.status} />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-600">Jugadors en seguiment</p>
                    <p className="text-[11px] text-slate-400 font-semibold">Posició: {player.position} | Dorsal #{player.jersey_number || 10}</p>
                  </div>

                  {/* Player Card pill internal like FFCV */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#002568] text-white flex items-center justify-center font-black text-sm uppercase shadow">
                        {player.first_name[0]}
                        {player.last_name[0]}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase">{player.full_name}</h4>
                        <p className="text-[11px] text-[#ff6600] font-bold">Estat: {player.status}</p>
                      </div>
                    </div>
                    <Link
                      to={`/jugadores/${player.id}`}
                      className="px-3 py-1.5 bg-[#061338] hover:bg-[#002568] text-white font-bold text-[11px] rounded-full transition-colors"
                    >
                      Perfil
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          );
        })()}
      </div>

      {/* 4. Próximos Eventos y Calendario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-[#061338] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#ff6600]" />
              <span>PRÒXIMS ESDEVENIMENTS Y PARTITS</span>
            </h3>
            <Link to="/calendario" className="text-xs font-bold text-[#003db3] hover:underline flex items-center gap-1">
              Ver calendari complet <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {nextCallup && (
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-[#002568] text-white rounded-2xl shrink-0 shadow-md">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-[#ff6600] uppercase tracking-wider block">
                      CONVOCATÒRIA OFICIAL
                    </span>
                    <h4 className="text-sm font-black text-slate-900">{nextCallup.title}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {nextCallup.location}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge status={nextCallup.status} />
                  <p className="text-xs font-bold text-slate-700 mt-1">
                    {new Date(nextCallup.date).toLocaleDateString('ca-ES')}
                  </p>
                </div>
              </div>
            )}

            {nextTraining && (
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-[#061338] text-white rounded-2xl shrink-0 shadow-md">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-sky-600 uppercase tracking-wider block">
                      ENTRENAMENT TÀCTIC
                    </span>
                    <h4 className="text-sm font-black text-slate-900">{nextTraining.title}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {nextTraining.location}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="success">Programat</Badge>
                  <p className="text-xs font-bold text-slate-700 mt-1">
                    {new Date(nextTraining.start_time).toLocaleDateString('ca-ES')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Resumen KPIs rápido */}
        <div className="space-y-4">
          <Card className="p-5 bg-gradient-to-br from-[#061338] to-[#002568] text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-sky-300 uppercase tracking-wider">TOTAL JUGADORS</p>
                <h3 className="text-3xl font-black text-white mt-1">{totalPlayers}</h3>
              </div>
              <div className="p-3 bg-white/10 rounded-2xl text-sky-300">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-300 mt-3">En base de dades territorial Castelló</p>
          </Card>

          <Card className="p-5 bg-white border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">SELECCIONATS</p>
                <h3 className="text-3xl font-black text-[#ff6600] mt-1">{selectedCount}</h3>
              </div>
              <div className="p-3 bg-orange-50 rounded-2xl text-[#ff6600]">
                <Trophy className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">Plantilla titular Sub-16</p>
          </Card>
        </div>
      </div>
    </div>
  );
};
