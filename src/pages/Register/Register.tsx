import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [category, setCategory] = useState('Sub-16');
  const [errorMsg, setErrorMsg] = useState('');

  const { register, isLoading, appSettings } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMsg('Tots els camps són obligatoris.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Les contrasenyes no coincideixen.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('La contrasenya ha de tindre almenys 6 caràcters.');
      return;
    }

    const res = register({
      email,
      password,
      full_name: fullName,
      category_assigned: category
    });

    if (res.success) {
      showToast('Compte de seleccionador creat correctament! Benvingut.', 'success');
      navigate('/dashboard');
    } else {
      setErrorMsg(res.error || 'No s’ha pogut registrar el seleccionador.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#061338] via-[#002568] to-[#003db3] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#ff6600]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Header Logo */}
        <div className="text-center space-y-3">
          <img
            src="/logo_seleccio.png"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }}
            alt="Selecció Valenciana Castelló Futbol Logo"
            className="w-20 h-20 mx-auto object-contain drop-shadow-xl"
          />
          <h1 className="text-2xl font-black text-white tracking-wide uppercase italic">
            SELECCIÓ CASTELLÓ
          </h1>
          <p className="text-xs text-sky-200 font-bold tracking-widest uppercase">
            REGISTRE DE NOUS SELECCIONADORS
          </p>
        </div>

        {/* Register Form Card */}
        <div className="bg-white/95 backdrop-blur-2xl p-6 md:p-8 rounded-3xl shadow-2xl space-y-5 border border-white/20 text-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-[#061338]">Crear Compte de Seleccionador</h2>
              <p className="text-xs text-slate-500">Accés per a tècnics i scouting de Castelló</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <UserPlus className="w-5 h-5" />
            </div>
          </div>

          {!appSettings.allowPublicRegistration && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-semibold">
              El registre públic està actualment desactivat per l’administrador.
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Nom i Cognoms
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Joan Beltrán"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002568] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Correu Electrònic
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seleccionador@ejemplo.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002568] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Categoría Principal
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002568] transition-all"
              >
                {appSettings.categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Contrasenya
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Confirmar Contrasenya
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002568] transition-all"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !appSettings.allowPublicRegistration}
              className="w-full bg-[#ff6600] hover:bg-orange-600 disabled:opacity-50 text-white font-black uppercase tracking-wider py-3 rounded-2xl shadow-lg shadow-orange-950/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2"
            >
              <span>Registrar Seleccionador</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#002568] hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ja tens un compte? Inicia sessió aquí</span>
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-sky-200/80 font-medium">
          © {new Date().getFullYear()} Selecció Valenciana Castelló Futbol • FFCV
        </p>
      </div>
    </div>
  );
};
