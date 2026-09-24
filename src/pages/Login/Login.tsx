import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, UserCheck, Lock, Mail, ArrowRight, UserPlus, KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { login, loginDemo, isLoading } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim()) {
      setErrorMsg('Si us plau, introdueix el teu correu electrònic.');
      return;
    }

    const res = await login(email, password);

    if (res.success) {
      showToast('Sessió iniciada correctament', 'success');
      navigate('/dashboard');
    } else {
      setErrorMsg(res.error || 'Accés denegat.');
    }
  };

  const fillAdminCredentials = () => {
    setEmail('seleccio.castello.2026@gmail.com');
    setPassword('castello.2026');
    setErrorMsg('');
  };

  const handleDemoAccess = (role: 'admin' | 'seleccionador') => {
    loginDemo(role);
    showToast(`Accés d'avaluació en rol: ${role.toUpperCase()}`, 'success');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#061338] via-[#002568] to-[#003db3] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Ambient background blur circles */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#ff6600]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Header Logo FFCV Style */}
        <div className="text-center space-y-3">
          <img
            src="/logo_seleccio.png"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }}
            alt="Selecció Valenciana Castelló Futbol Logo"
            className="w-24 h-24 mx-auto object-contain drop-shadow-xl transition-transform hover:scale-105"
          />
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-wide uppercase italic">
            SELECCIÓ CASTELLÓ
          </h1>
          <p className="text-xs md:text-sm text-sky-200 font-bold tracking-widest uppercase">
            FEDERACIÓ DE FUTBOL COMUNITAT VALENCIANA
          </p>
        </div>

        {/* Login Form Container */}
        <div className="bg-white/95 backdrop-blur-2xl p-6 md:p-8 rounded-3xl shadow-2xl space-y-5 border border-white/20 text-slate-900">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-[#061338]">{t.loginTitle}</h2>
            <p className="text-xs text-slate-500">{t.loginSubtitle}</p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                {t.email}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seleccio.castello.2026@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002568] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                {t.password}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002568] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#ff6600] hover:bg-orange-600 text-white font-black uppercase tracking-wider py-3 rounded-2xl shadow-lg shadow-orange-950/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <span>{t.enter}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Direct Fill for Admin & Register Link */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={fillAdminCredentials}
              className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 flex items-center justify-center gap-2 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              <span>Omplir credencials Administrador</span>
            </button>

            <div className="pt-2 text-center border-t border-slate-100">
              <p className="text-xs text-slate-600">
                Ets nou seleccionador?{' '}
                <Link
                  to="/registro"
                  className="font-black text-[#002568] hover:underline inline-flex items-center gap-1"
                >
                  <span>Registra't aquí</span>
                  <UserPlus className="w-3.5 h-3.5" />
                </Link>
              </p>
            </div>
          </div>

          {/* Demo Access */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <p className="text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
              ACCÉS RÀPID DEMO
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoAccess('seleccionador')}
                className="flex items-center justify-center gap-2 p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#002568]" />
                <span>Seleccionador</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoAccess('admin')}
                className="flex items-center justify-center gap-2 p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold text-amber-800 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Admin</span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-sky-200/80 font-medium">
          © {new Date().getFullYear()} Selecció Valenciana Castelló Futbol • FFCV
        </p>
      </div>
    </div>
  );
};
