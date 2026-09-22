import React, { useState } from 'react';
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Shield,
  Users,
  Trophy,
  ShieldAlert,
  Calendar,
  CalendarCheck,
  MapPin,
  Dumbbell,
  FileSpreadsheet
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

export const Header: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, language, setLanguage } = useLanguage();
  const { user, role, logout } = useAuth();

  const navItems = [
    { to: '/dashboard', label: t.dashboard, icon: LayoutDashboard },
    { to: '/equipos', label: t.teams, icon: Shield },
    { to: '/jugadores', label: t.players, icon: Users },
    { to: '/seleccionados', label: t.selectedPlayers, icon: Trophy },
    { to: '/convocatorias', label: t.callups, icon: ShieldAlert },
    { to: '/entrenamientos', label: t.training, icon: Dumbbell },
    { to: '/informes', label: t.reports, icon: FileSpreadsheet },
    { to: '/calendario', label: t.calendar, icon: Calendar },
    { to: '/agenda', label: t.agenda || 'Agenda', icon: CalendarCheck },
    { to: '/mapa', label: t.map, icon: MapPin }
  ];

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-[#061338] via-[#002568] to-[#003db3] shadow-md">
      {/* Top Banner FFCV Style */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo_seleccio.png"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }}
            alt="Logo Selecció Castelló"
            className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-md transition-transform hover:scale-105"
          />
          <div>
            <span className="font-black text-xs md:text-sm tracking-widest text-white uppercase block leading-tight">
              SELECCIÓ VALENCIANA CASTELLÓ
            </span>
            <span className="text-[10px] text-sky-300 font-bold tracking-wider uppercase hidden sm:block">
              FEDERACIÓ DE FUTBOL COMUNITAT VALENCIANA
            </span>
          </div>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={() => setLanguage(language === 'va' ? 'es' : 'va')}
            className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
          >
            {language.toUpperCase()}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Desktop Quick Info & Lang Switcher */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full text-xs text-white">
            <button
              onClick={() => setLanguage('va')}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                language === 'va' ? 'bg-[#ff6600] text-white' : 'text-slate-200 hover:text-white'
              }`}
            >
              VALENCIÀ
            </button>
            <button
              onClick={() => setLanguage('es')}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                language === 'es' ? 'bg-[#ff6600] text-white' : 'text-slate-200 hover:text-white'
              }`}
            >
              CASTELLANO
            </button>
          </div>
        </div>
      </div>

      {/* Pill Nav Bar for Mobile / Tablet quick scroll */}
      <div className="lg:hidden border-t border-white/10 px-4 py-2 overflow-x-auto flex gap-2 custom-scrollbar bg-[#061338]/60 backdrop-blur-md">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                isActive
                  ? 'bg-[#ff6600] text-white shadow-sm'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className="fixed inset-x-0 top-[110px] bottom-0 bg-[#061338]/95 backdrop-blur-xl p-4 overflow-y-auto flex flex-col justify-between z-50 lg:hidden border-t border-white/10">
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                      isActive ? 'bg-[#ff6600] text-white' : 'text-slate-200 hover:bg-white/10'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 text-sky-300" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-white/10 space-y-4">
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-sm font-bold text-white">{user?.full_name}</p>
                <p className="text-xs text-sky-300 capitalize">{role}</p>
              </div>
              <button
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-rose-300 bg-rose-500/20 rounded-xl"
              >
                <LogOut className="w-4 h-4" /> {t.logout}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
