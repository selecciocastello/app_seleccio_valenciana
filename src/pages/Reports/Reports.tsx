import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppStore } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';

export const Reports: React.FC = () => {
  const { t } = useLanguage();
  const { reports, createReport, players } = useAppStore();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id || '');
  const [technical, setTechnical] = useState('');
  const [tactical, setTactical] = useState('');
  const [physical, setPhysical] = useState('');
  const [recommendation, setRecommendation] = useState('Preseleccionable');

  // Puntuaciones multidimensionales
  const [tecnicaScore, setTecnicaScore] = useState(8);
  const [tacticaScore, setTacticaScore] = useState(7);
  const [fisicaScore, setFisicaScore] = useState(8);
  const [actitudScore, setActitudScore] = useState(9);

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    const playerObj = players.find((p) => p.id === selectedPlayerId);

    createReport({
      player_id: selectedPlayerId,
      player: playerObj,
      technical_summary: technical,
      tactical_summary: tactical,
      physical_summary: physical,
      recommendation,
      scores: {
        TECNICA: tecnicaScore,
        TACTICA: tacticaScore,
        FISICA: fisicaScore,
        ACTITUD: actitudScore
      }
    });

    showToast('Informe tècnic registrat correctament', 'success');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#061338] uppercase tracking-wider">{t.reports}</h1>
          <p className="text-xs font-semibold text-slate-600">
            Avaluació tècnica, tàctica i evolució dels candidats de Castelló
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.createReport}</span>
        </button>
      </div>

      {/* Grid de Informes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => (
          <Card key={report.id} className="p-6 space-y-4" gradient>
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs text-slate-400 font-semibold">{report.report_date}</span>
                <h3 className="text-lg font-black text-white mt-1">{report.player?.full_name}</h3>
                <p className="text-xs text-emerald-400 font-semibold">
                  {report.player?.position} • {report.player?.team?.name}
                </p>
              </div>
              <Badge variant="gold">{report.recommendation}</Badge>
            </div>

            {/* Puntuaciones por Criterios */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center">
              <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Tècnica</span>
                <span className="text-sm font-black text-amber-400">{report.scores?.TECNICA || 8}/10</span>
              </div>
              <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Tàctica</span>
                <span className="text-sm font-black text-emerald-400">{report.scores?.TACTICA || 7}/10</span>
              </div>
              <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Física</span>
                <span className="text-sm font-black text-sky-400">{report.scores?.FISICA || 8}/10</span>
              </div>
              <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Actitud</span>
                <span className="text-sm font-black text-purple-400">{report.scores?.ACTITUD || 9}/10</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              {report.technical_summary && (
                <p>
                  <strong className="text-white">Valoració Tècnica:</strong> {report.technical_summary}
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Modal Nuevo Informe */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nou Informe Tècnic">
        <form onSubmit={handleCreateReport} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Seleccionar Jugador</label>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.position} - {p.team?.name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-300 mb-1">Tècnica (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={tecnicaScore}
                onChange={(e) => setTecnicaScore(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-300 mb-1">Tàctica (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={tacticaScore}
                onChange={(e) => setTacticaScore(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-300 mb-1">Física (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={fisicaScore}
                onChange={(e) => setFisicaScore(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-300 mb-1">Actitud (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={actitudScore}
                onChange={(e) => setActitudScore(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Resum Tècnic</label>
            <textarea
              value={technical}
              onChange={(e) => setTechnical(e.target.value)}
              rows={2}
              placeholder="Observacions sobre control i selecció de passada..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Resum Tàctic i Físic</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={tactical}
                onChange={(e) => setTactical(e.target.value)}
                placeholder="Inteligència táctica..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                value={physical}
                onChange={(e) => setPhysical(e.target.value)}
                placeholder="Condició física..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Recomanació Interna</label>
            <select
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="Preseleccionable">Preseleccionable</option>
              <option value="En observación">En observació contínua</option>
              <option value="Descartado">No prioritari actualment</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
            >
              Cancel·lar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
            >
              Guardar Informe
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
