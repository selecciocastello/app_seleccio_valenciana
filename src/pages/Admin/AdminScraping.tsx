import React, { useState } from 'react';
import { Database, Play, RefreshCw, AlertTriangle, ScrollText } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { MockScraperService } from '../../services/scraping/MockScraperService';

export const AdminScraping: React.FC = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    'System initialization... Ready to run scraping pipeline.',
    'Scraper adapter loaded: fuente_territorial_castello_mock (Extensible architecture)'
  ]);

  const handleRunScraping = async () => {
    setIsRunning(true);
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Executing scraping task...`]);

    try {
      const scraper = new MockScraperService();
      const result = await scraper.executeSync();

      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Scraping completed successfully!`,
        `Records Processed: ${result.processedCount}`,
        `New Players Created: ${result.createdCount}`,
        `Existing Players Updated: ${result.updatedCount}`
      ]);

      showToast(`Scraping completat! Processats: ${result.processedCount} jugadors`, 'success');
    } catch (err: any) {
      showToast('Error en executar el scraping', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">{t.scraping}</h1>
          <p className="text-xs text-slate-400">
            Capa d'integració externa i ingestió desacoplada per a la Selecció de Castelló
          </p>
        </div>
        <button
          onClick={handleRunScraping}
          disabled={isRunning}
          className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/40 flex items-center gap-2.5 transition-all self-start sm:self-auto disabled:opacity-50"
        >
          {isRunning ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 text-emerald-300" />
          )}
          <span>{isRunning ? 'Executant Scraping...' : 'Executar Scraping Ara'}</span>
        </button>
      </div>

      {/* Grid Estado y Configuración */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 space-y-4 lg:col-span-1" gradient>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            <span>Estat del Servei</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Última Execució:</span>
              <span className="text-white font-semibold">19/09/2026 11:30h</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Estat:</span>
              <Badge variant="success">Servidor Actiu</Badge>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Font Externa actual:</span>
              <span className="text-sky-300 font-mono">fuente_territorial_castello_mock</span>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Protecció d'Edicions Manuals</span>
            </div>
            <p className="text-[11px] text-amber-200/80">
              Els jugadors modificats manualment pels seleccionadors tenen el flag{' '}
              <code>is_manual_override = true</code> per a evitar sobreescritures accidentals.
            </p>
          </div>
        </Card>

        {/* Logs de Consola */}
        <Card className="p-6 space-y-4 lg:col-span-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-emerald-400" />
            <span>Logs i Consola d'Execució</span>
          </h3>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 h-64 overflow-y-auto space-y-1 custom-scrollbar">
            {logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                {log}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
