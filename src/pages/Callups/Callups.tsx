import React, { useState } from 'react';
import { Plus, Calendar, MapPin, CheckCircle, LayoutGrid, ShieldAlert } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { SoccerPitch } from '../../components/callups/SoccerPitch';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppStore } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';
import type { Player } from '../../types/models';

export const Callups: React.FC = () => {
  const { t } = useLanguage();
  const { callups, createCallup, players } = useAppStore();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCallupId, setSelectedCallupId] = useState<string>(callups[0]?.id || '');
  const [viewMode, setViewMode] = useState<'pitch' | 'list'>('pitch');

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('Instal·lacions Chencho, Castelló');
  const [notes, setNotes] = useState('');

  const activeCallup = callups.find((c) => c.id === selectedCallupId) || callups[0];
  const activePlayers = activeCallup?.callup_players?.map((cp) => cp.player!).filter(Boolean) || [];

  // Demarcaciones
  const porteros = activePlayers.filter((p) => p.position === 'Portero');
  const defensas = activePlayers.filter((p) =>
    p.position?.includes('Defensa') || p.position?.includes('Lateral') || p.position?.includes('Carrilero')
  );
  const medios = activePlayers.filter((p) =>
    p.position?.includes('Medio') || p.position?.includes('Pivote') || p.position?.includes('Mediapunta')
  );
  const delanteros = activePlayers.filter((p) =>
    p.position?.includes('Delantero') || p.position?.includes('Extremo') || p.position?.includes('Punta')
  );

  const handleCreateCallup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) {
      showToast('Por favor, indica el título y la fecha', 'error');
      return;
    }

    const selectedPlayers = players.filter(
      (p) => p.status === 'Seleccionado' || p.status === 'Preseleccionado'
    );

    createCallup({
      title,
      date: new Date(date).toISOString(),
      location,
      notes,
      callup_players: selectedPlayers.map((p) => ({
        id: `cp_${p.id}`,
        callup_id: 'new',
        player_id: p.id,
        player: p,
        status: 'Convocado',
        attendance: true
      }))
    });

    showToast('Convocatòria creada correctament', 'success');
    setIsModalOpen(false);
    setTitle('');
    setDate('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#061338] uppercase tracking-wider">{t.callups}</h1>
          <p className="text-xs text-slate-500 font-semibold">
            Visualització táctica en campograma i desplegament per demarcacions
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-[#ff6600] hover:bg-orange-600 text-white font-black uppercase tracking-wider text-xs rounded-full shadow-md flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.createCallup}</span>
        </button>
      </div>

      {/* Selector de Convocatoria Activa & View Mode */}
      <Card className="p-4 bg-white space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs font-black uppercase text-[#061338]">Convocatòria Activa:</span>
            <select
              value={selectedCallupId}
              onChange={(e) => setSelectedCallupId(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 text-[#061338] text-xs font-bold rounded-2xl px-3 py-2 focus:outline-none"
            >
              {callups.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({new Date(c.date).toLocaleDateString('ca-ES')})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-full border border-slate-200 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setViewMode('pitch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                viewMode === 'pitch' ? 'bg-[#061338] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-300" /> Campograma Tàctic
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                viewMode === 'list' ? 'bg-[#061338] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-sky-300" /> Demarcacions
            </button>
          </div>
        </div>
      </Card>

      {/* Campograma Táctico en Césped estilo FFCV */}
      {viewMode === 'pitch' && (
        <div className="space-y-4">
          <Card className="p-4 md:p-6 bg-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h2 className="text-base font-black text-[#061338] uppercase">{activeCallup?.title}</h2>
                <p className="text-xs text-slate-500 font-semibold flex items-center gap-2 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-[#ff6600]" />
                  {new Date(activeCallup?.date || Date.now()).toLocaleDateString('ca-ES')} •
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {activeCallup?.location}
                </p>
              </div>
              <Badge status={activeCallup?.status} />
            </div>

            <SoccerPitch players={activePlayers} />
          </Card>
        </div>
      )}

      {/* Desglose Organizado por Demarcaciones (Porteros, Defensas, Centrocampistas, Delanteros) */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-[#061338] tracking-wide uppercase">
          CONVOCATS PER DEMARCACIÓ TÀCTICA ({activePlayers.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Porteros */}
          <Card className="p-4 space-y-3 bg-white border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black uppercase text-amber-600">PORTERIA ({porteros.length})</h3>
              <span className="text-[10px] font-bold text-slate-400">POR</span>
            </div>
            <div className="space-y-2">
              {porteros.map((p) => (
                <PlayerCardMini key={p.id} player={p} />
              ))}
            </div>
          </Card>

          {/* Defensas */}
          <Card className="p-4 space-y-3 bg-white border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black uppercase text-[#061338]">DEFENSES ({defensas.length})</h3>
              <span className="text-[10px] font-bold text-slate-400 font-mono">DEF</span>
            </div>
            <div className="space-y-2">
              {defensas.map((p) => (
                <PlayerCardMini key={p.id} player={p} />
              ))}
            </div>
          </Card>

          {/* Centrocampistas */}
          <Card className="p-4 space-y-3 bg-white border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black uppercase text-[#002568]">MIGCAMPISTES ({medios.length})</h3>
              <span className="text-[10px] font-bold text-slate-400 font-mono">MIG</span>
            </div>
            <div className="space-y-2">
              {medios.map((p) => (
                <PlayerCardMini key={p.id} player={p} />
              ))}
            </div>
          </Card>

          {/* Delanteros */}
          <Card className="p-4 space-y-3 bg-white border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black uppercase text-[#ff6600]">DAVANTERS ({delanteros.length})</h3>
              <span className="text-[10px] font-bold text-slate-400 font-mono">DAV</span>
            </div>
            <div className="space-y-2">
              {delanteros.map((p) => (
                <PlayerCardMini key={p.id} player={p} />
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Modal Nueva Convocatoria */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Nova Convocatòria">
        <form onSubmit={handleCreateCallup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Títol de la Convocatòria</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="I Convocatòria Selecció Castelló Sub-16"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-900"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lloc</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Observacions / Indicacions</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Indicacions tàctiques..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-900"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-full"
            >
              Cancel·lar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#ff6600] hover:bg-orange-600 text-white text-xs font-bold rounded-full"
            >
              Guardar Convocatòria
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const PlayerCardMini: React.FC<{ player: Player }> = ({ player }) => (
  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-2xl">
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-7 h-7 rounded-full bg-[#002568] text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
        {player.jersey_number || player.first_name[0]}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-900 line-clamp-2 break-words">{player.full_name}</p>
        <p className="text-[10px] text-slate-500 line-clamp-2 break-words">{player.team?.name}</p>
      </div>
    </div>
    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
  </div>
);
