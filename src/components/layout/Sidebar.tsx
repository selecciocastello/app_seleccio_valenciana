import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Calendar,
  MapPin,
  Dumbbell,
  FileSpreadsheet,
  Settings,
  Database,
  ScrollText,
  Trophy,
  Globe2,
  LogOut
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

export const Sidebar: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { user, role, logout } = useAuth();

  const navItems = [
    { to: '/dashboard', label: t.dashboard, icon: LayoutDashboard },
    { to: '/jugadores', label: t.players, icon: Users },
    { to: '/seleccionados', label: t.selectedPlayers, icon: Trophy },
    { to: '/convocatorias', label: t.callups, icon: ShieldAlert },
    { to: '/entrenamientos', label: t.training, icon: Dumbbell },
    { to: '/informes', label: t.reports, icon: FileSpreadsheet },
    { to: '/calendario', label: t.calendar, icon: Calendar },
    { to: '/mapa', label: t.map, icon: MapPin },
    { to: '/equipos', label: t.teams, icon: Settings }
  ];

  const adminItems = [
    { to: '/administracion/usuarios', label: t.users, icon: Users },
    { to: '/administracion/ajustes', label: 'Ajustos Funcionament', icon: Settings },
    { to: '/administracion/scraping', label: t.scraping, icon: Database },
    { to: '/administracion/logs', label: t.logs, icon: ScrollText }
  ];


  return (
    <aside className="hidden lg:flex flex-col w-64 bg-[#061338] text-white border-r border-blue-900/40 shrink-0 h-screen sticky top-0 select-none shadow-xl">
      {/* Header / Branding */}
      <div className="p-5 border-b border-blue-900/40 flex items-center gap-3.5 bg-gradient-to-r from-[#061338] to-[#002568]">
        <img
          src="/logo_seleccio.png"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }}
          alt="Selecció Valenciana Castelló Futbol"
          className="w-20 h-20 object-contain drop-shadow-md transition-transform hover:scale-105"
        />
        <div>
          <h1 className="text-xs font-black tracking-wider uppercase text-white leading-tight">
            SELECCIÓ CASTELLÓ
          </h1>
          <p className="text-[10px] text-sky-300 font-bold tracking-wide uppercase">Plataforma Tècnica FFCV</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6 custom-scrollbar">
        <div>
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-sky-200/60 mb-2">
            Gestió Esportiva
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-full text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? 'bg-[#ff6600] text-white shadow-md shadow-orange-950/20'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0 text-sky-300" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sección de Administración solo para Admin */}
        {role === 'admin' && (
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-amber-300/80 mb-2 flex items-center gap-1.5">
              <span>Administració</span>
            </p>
            <nav className="space-y-1">
              {adminItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-full text-xs font-bold transition-all duration-200 ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0 text-amber-300" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Language Switcher & User Profile */}
      <div className="p-4 border-t border-blue-900/40 bg-[#001948]/60 space-y-3">
        {/* Selector de idioma */}
        <div className="flex items-center justify-between px-2 text-xs text-slate-300">
          <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <Globe2 className="w-3.5 h-3.5 text-sky-300" /> Idioma:
          </span>
          <div className="flex gap-1 bg-[#061338] p-0.5 rounded-full border border-blue-900/60">
            <button
              onClick={() => setLanguage('va')}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                language === 'va' ? 'bg-[#ff6600] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              VA
            </button>
            <button
              onClick={() => setLanguage('es')}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                language === 'es' ? 'bg-[#ff6600] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              ES
            </button>
          </div>
        </div>

        {/* Info usuario */}
        <div className="flex items-center justify-between pt-2 border-t border-blue-900/40">
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center font-bold text-xs text-slate-950 uppercase shadow-inner">
              {user?.full_name?.substring(0, 2) || 'SC'}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-white truncate">{user?.full_name}</p>
              <p className="text-[10px] text-sky-300 capitalize">{role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title={t.logout}
            className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
