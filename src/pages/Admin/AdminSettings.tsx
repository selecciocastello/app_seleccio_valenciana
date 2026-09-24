import React, { useState } from 'react';
import { Settings, Save, ShieldAlert, Sliders, Layers } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export const AdminSettings: React.FC = () => {
  const { appSettings, updateAppSettings } = useAuth();
  const { showToast } = useToast();

  const [appName, setAppName] = useState(appSettings.appName);
  const [season, setSeason] = useState(appSettings.season);
  const [allowPublicRegistration, setAllowPublicRegistration] = useState(appSettings.allowPublicRegistration);
  const [maintenanceMode, setMaintenanceMode] = useState(appSettings.maintenanceMode);
  const [categoriesText, setCategoriesText] = useState(appSettings.categories.join(', '));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const categoriesArray = categoriesText
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    updateAppSettings({
      appName,
      season,
      allowPublicRegistration,
      maintenanceMode,
      categories: categoriesArray
    });

    showToast('Canvis en el funcionament de la plataforma guardats correctament!', 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#061338] uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-6 h-6 text-amber-500" />
            <span>Ajustos de Funcionament de la Plataforma</span>
          </h1>
          <p className="text-xs font-semibold text-slate-600">
            Paràmetres globals, registre de seleccionadors i estat de la selecció
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="p-6 space-y-6 bg-white border border-slate-200/90 shadow-sm">
          <h2 className="text-sm font-black text-[#061338] uppercase tracking-wider border-b border-slate-200 pb-3 flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#ff6600]" />
            <span>Configuració General</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">
                Nom Oficial de la Plataforma
              </label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">
                Temporada Activa
              </label>
              <input
                type="text"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Categoríes de Selecció Habilitades (separades per coma)</span>
            </label>
            <input
              type="text"
              value={categoriesText}
              onChange={(e) => setCategoriesText(e.target.value)}
              placeholder="Sub-12, Sub-14, Sub-16, Femení Sub-15"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Les categoríes introduïdes apareixeran al registrar seleccionadors i filtrar jugadors.
            </p>
          </div>
        </Card>

        <Card className="p-6 space-y-6 bg-white border border-slate-200/90 shadow-sm">
          <h2 className="text-sm font-black text-[#061338] uppercase tracking-wider border-b border-slate-200 pb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#ff6600]" />
            <span>Permisos i Estat del Sistema</span>
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Registre públic de seleccionadors</h3>
                <p className="text-xs text-slate-500">
                  Permet que nous seleccionadors puguen crear compte des de la pàgina principal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAllowPublicRegistration(!allowPublicRegistration)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  allowPublicRegistration ? 'bg-amber-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    allowPublicRegistration ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Modo Manteniment</h3>
                <p className="text-xs text-slate-500">
                  Bloqueja l'accés temporal a tots els seleccionadors excepte a l'administrador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  maintenanceMode ? 'bg-rose-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Canvis de Funcionament</span>
          </button>
        </div>
      </form>
    </div>
  );
};
