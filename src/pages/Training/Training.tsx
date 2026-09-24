import React, { useState } from 'react';
import { Dumbbell, Plus, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppStore } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';

export const Training: React.FC = () => {
  const { t } = useLanguage();
  const { trainings, createTraining, players } = useAppStore();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [objective, setObjective] = useState('');
  const [attendanceState, setAttendanceState] = useState<Record<string, boolean>>({});

  const handleCreateTraining = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) {
      showToast('Por favor, indica título y fecha', 'error');
      return;
    }

    createTraining({
      title,
      start_time: new Date(date).toISOString(),
      end_time: new Date(new Date(date).getTime() + 7200000).toISOString(),
      objective,
      location: 'Gaetà Huguet, Castelló'
    });

    showToast('Entrenament programat amb èxit', 'success');
    setIsModalOpen(false);
    setTitle('');
  };

  const toggleAttendance = (playerId: string) => {
    setAttendanceState((prev) => ({ ...prev, [playerId]: !prev[playerId] }));
    showToast('Assistència registrada', 'info');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#061338] uppercase tracking-wider">{t.training}</h1>
          <p className="text-xs font-semibold text-slate-600">
            Planificació de sessions, exercicis i control d'assistència
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.createTraining}</span>
        </button>
      </div>

      {/* Grid de Sesiones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {trainings.map((session) => (
            <Card key={session.id} className="p-6 space-y-4 bg-white border border-slate-200/90 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant="success">Entrenament Tàctic</Badge>
                  <h3 className="text-lg font-black text-[#061338] mt-2">{session.title}</h3>
                  <p className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    {new Date(session.start_time).toLocaleDateString('ca-ES')} • 18:00h - 20:00h
                  </p>
                </div>
              </div>

              {session.objective && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                  <strong className="text-emerald-700 font-bold">Objectiu Principal:</strong> {session.objective}
                </div>
              )}

              {/* Registro Rápido de Asistencia */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 mb-3">Control d'Assistència de Jugadors Convocats:</h4>
                {(() => {
                  const trainingPlayers = players.filter(
                    (p) => p.status === 'Seleccionado' || p.status === 'Preseleccionado'
                  );

                  if (trainingPlayers.length === 0) {
                    return (
                      <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                        No hi ha jugadors seleccionats per a aquesta sessió d'entrenament.
                      </p>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {trainingPlayers.map((player) => {
                        const attended = attendanceState[player.id] ?? true;
                        return (
                          <div
                            key={player.id}
                            className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                          >
                            <span className="font-bold text-[#061338]">{player.full_name}</span>
                            <button
                              onClick={() => toggleAttendance(player.id)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[10px] transition-colors ${
                                attended
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}
                            >
                              {attended ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Assistit
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 text-rose-600" /> No Assistit
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </Card>
          ))}
        </div>

        {/* Ejercicios Recomendados / Biblioteca */}
        <Card className="p-5 space-y-4 bg-white border border-slate-200/90 shadow-sm">
          <h3 className="text-base font-black text-[#061338] flex items-center gap-2 uppercase tracking-wide">
            <Dumbbell className="w-4 h-4 text-emerald-600" />
            <span>Biblioteca d'Exercicis</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <h4 className="font-bold text-[#061338]">Rondo Tàctic 5x2 amb Transició</h4>
              <p className="text-slate-600 mt-1">Durada: 15 min. Espai reduït. Treball de pressió rere pèrdua.</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <h4 className="font-bold text-[#061338]">Partit Reduït amb Eixida des de Enrere</h4>
              <p className="text-slate-600 mt-1">Durada: 25 min. Posicionament dels centrals i pivote.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal Nuevo Entrenamiento */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Programar Nou Entrenament">
        <form onSubmit={handleCreateTraining} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Títol de la Sessió</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Entrenament Tàctic Intensiu"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Objectiu Principal</label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={3}
              placeholder="Automatismes en atac organitzat..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            />
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
              Guardar Entrenament
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
