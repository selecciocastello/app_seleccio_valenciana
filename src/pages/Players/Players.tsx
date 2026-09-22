import React, { useState, useMemo } from 'react';
import { Search, Plus, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppStore } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';
import { JerseyBadge } from '../../components/ui/JerseyBadge';
import type { PlayerStatus } from '../../types/models';

export const Players: React.FC = () => {
  const { t } = useLanguage();
  const { players, teams, addPlayer } = useAppStore();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [selectedInfantilYear, setSelectedInfantilYear] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State para añadir jugador
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [position, setPosition] = useState('Mediocentro');
  const [teamId, setTeamId] = useState(teams[0]?.id || '');
  const [status, setStatus] = useState<PlayerStatus>('Candidato');

  const filteredPlayers = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const result = players.filter((p) => {
      const pName = (p.full_name || '').toLowerCase();
      const pTeam = (p.team?.name || '').toLowerCase();
      const pPos = (p.position || '').toLowerCase();

      const matchesSearch =
        !searchLower ||
        pName.includes(searchLower) ||
        pTeam.includes(searchLower) ||
        pPos.includes(searchLower);

      const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;
      const matchesTeam = selectedTeam === 'all' || p.team_id === selectedTeam;
      const matchesPosition = selectedPosition === 'all' || p.position === selectedPosition;
      const matchesInfantilYear = selectedInfantilYear === 'all' || p.infantil_year === selectedInfantilYear;

      return matchesSearch && matchesStatus && matchesTeam && matchesPosition && matchesInfantilYear;
    });

    result.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ca', { sensitivity: 'base' }));
    return result;
  }, [players, search, selectedStatus, selectedTeam, selectedPosition, selectedInfantilYear]);

  const handleCreatePlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName) {
      showToast('Por favor, indica el nombre y los apellidos', 'error');
      return;
    }

    const selectedTeamObj = teams.find((t) => t.id === teamId);
    addPlayer({
      first_name: firstName,
      last_name: lastName,
      position,
      status,
      team_id: teamId,
      team: selectedTeamObj
    });

    showToast('Jugador afegit correctament a la base de dades', 'success');
    setIsModalOpen(false);
    setFirstName('');
    setLastName('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#061338] uppercase tracking-wider">{t.players}</h1>
          <p className="text-xs font-semibold text-slate-600">
            Cens i seguiment de candidats de la província de Castelló
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-[#ff6600] hover:bg-orange-600 text-white font-black uppercase tracking-wider text-xs rounded-full shadow-md flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addPlayer}</span>
        </button>
      </div>

      {/* Buscador y Filtros */}
      <Card className="p-4 bg-white space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Buscador */}
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#002568]"
            />
          </div>

          {/* Filtro Año Infantil */}
          <select
            value={selectedInfantilYear}
            onChange={(e) => setSelectedInfantilYear(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#002568]"
          >
            <option value="all">Tots els Anys (Infantil)</option>
            <option value="Infantil 1er año">Infantil 1er any</option>
            <option value="Infantil 2º año">Infantil 2n any</option>
            <option value="Desconocido">Desconegut</option>
          </select>

          {/* Filtro Estado */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#002568]"
          >
            <option value="all">Tots els Estats</option>
            <option value="Candidato">Candidat</option>
            <option value="Observado">Observat</option>
            <option value="Preseleccionado">Preseleccionat</option>
            <option value="Seleccionado">Seleccionat</option>
            <option value="Lesionado">Lesionat</option>
          </select>

          {/* Filtro Equipo */}
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#002568]"
          >
            <option value="all">Tots els Equips</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Filtro Posición */}
          <select
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#002568]"
          >
            <option value="all">Totes les Posicions</option>
            <option value="Portero">Portero</option>
            <option value="Defensa Central">Defensa Central</option>
            <option value="Lateral Izquierdo">Lateral Izquierdo</option>
            <option value="Lateral Derecho">Lateral Derecho</option>
            <option value="Mediocentro">Mediocentro</option>
            <option value="Extremo Derecho">Extremo Derecho</option>
            <option value="Extremo Izquierdo">Extremo Izquierdo</option>
            <option value="Delantero Centro">Delantero Centro</option>
          </select>
        </div>
      </Card>

      {/* Resum del cens de jugadors del scraping */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold text-slate-600 px-1">
        <span>
          Mostrant <strong className="text-[#061338]">{filteredPlayers.length}</strong> de <strong className="text-[#061338]">{players.length}</strong> jugadors del cens oficial FFCV
        </span>
        <div className="flex items-center gap-3 text-[11px] font-bold">
          <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            {players.filter((p) => p.infantil_year === 'Infantil 2º año').length} de 2n Any
          </span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {players.filter((p) => p.infantil_year === 'Infantil 1er año').length} de 1r Any
          </span>
        </div>
      </div>

      {/* Llistat de Jugadors - Cards en mòbil */}
      {filteredPlayers.length === 0 ? (
        <Card className="p-8 text-center text-slate-500 font-bold bg-white border border-slate-200">
          No s'han trobat jugadors amb els filtres seleccionats.
        </Card>
      ) : (
        <div className="md:hidden space-y-3">
          {filteredPlayers.map((player) => (
            <Card key={player.id} className="p-4 bg-white border border-slate-200 space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {player.photo_url ? (
                    <img
                      src={player.photo_url}
                      alt={player.full_name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#002568] text-white flex items-center justify-center font-black text-sm uppercase shadow-sm">
                      {player.first_name[0]}
                      {player.last_name[0]}
                    </div>
                  )}
                  <div className="absolute -bottom-1.5 -right-1.5">
                    <JerseyBadge number={player.jersey_number} size="xs" variant="kit" color="blue" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-[#061338] uppercase line-clamp-2 break-words">{player.full_name}</p>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                    {player.position} · {player.team?.name}
                  </p>
                </div>
                <Badge status={player.status} />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <span
                  className={clsx(
                    "px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 border",
                    player.infantil_year === 'Infantil 1er año' && "bg-sky-50 text-sky-700 border-sky-300",
                    player.infantil_year === 'Infantil 2º año' && "bg-emerald-50 text-emerald-700 border-emerald-300",
                    (!player.infantil_year || player.infantil_year === 'Desconocido') && "bg-slate-100 text-slate-600 border-slate-200"
                  )}
                >
                  {player.infantil_year || 'Desconegut'}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {player.age ? `${player.age} anys` : (player.birth_date || 'Infantil')}
                </span>
              </div>

              <Link
                to={`/jugadores/${player.id}`}
                className="flex items-center justify-center w-full py-2.5 bg-[#061338] hover:bg-[#002568] text-white font-bold text-xs rounded-full transition-colors"
              >
                Ver Perfil
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Taula de Jugadors - Escriptori */}
      {filteredPlayers.length > 0 && (
        <Card className="hidden md:block overflow-hidden bg-white border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-[#061338] text-white font-black uppercase tracking-wider">
                  <th className="p-4">Dorsal</th>
                  <th className="p-4">Jugador</th>
                  <th className="p-4">Any Infantil</th>
                  <th className="p-4">Posició</th>
                  <th className="p-4">Equip</th>
                  <th className="p-4">Edat</th>
                  <th className="p-4">Estat</th>
                  <th className="p-4">Font Dades</th>
                  <th className="p-4 text-right">Acció</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <JerseyBadge number={player.jersey_number} size="sm" variant="kit" color="blue" />
                    </td>
                    <td className="p-4 font-black text-slate-900 flex items-center gap-3">
                      {player.photo_url ? (
                        <img
                          src={player.photo_url}
                          alt={player.full_name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#002568] text-white flex items-center justify-center font-black text-xs uppercase shadow-sm">
                          {player.first_name[0]}
                          {player.last_name[0]}
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-black text-[#061338] uppercase">{player.full_name}</span>
                        <p className="text-[11px] text-slate-400 font-semibold">{player.position}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={clsx(
                          "px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 border",
                          player.infantil_year === 'Infantil 1er año' && "bg-sky-50 text-sky-700 border-sky-300",
                          player.infantil_year === 'Infantil 2º año' && "bg-emerald-50 text-emerald-700 border-emerald-300",
                          (!player.infantil_year || player.infantil_year === 'Desconocido') && "bg-slate-100 text-slate-600 border-slate-200"
                        )}
                      >
                        {player.infantil_year || 'Desconegut'}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-700">{player.position}</td>
                    <td className="p-4 font-bold text-slate-800">{player.team?.name}</td>
                    <td className="p-4 font-semibold text-slate-600">
                      {player.age ? `${player.age} anys` : (player.birth_date || 'Infantil')}
                    </td>
                    <td className="p-4">
                      <Badge status={player.status} />
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                        <Database className="w-3 h-3 text-[#002568]" />
                        {player.source === 'source_a_scraping' || player.source === 'ffcv_scraping' ? 'Scraping FFCV' : 'Manual'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        to={`/jugadores/${player.id}`}
                        className="px-3.5 py-1.5 bg-[#061338] hover:bg-[#002568] text-white font-bold text-xs rounded-full transition-colors inline-block"
                      >
                        Ver Perfil
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal Nuevo Jugador */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Afegir Nou Jugador">
        <form onSubmit={handleCreatePlayer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Pau"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cognoms</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ribes Martí"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-900"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Posició</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-900"
              >
                <option value="Portero">Portero</option>
                <option value="Defensa Central">Defensa Central</option>
                <option value="Lateral Izquierdo">Lateral Izquierdo</option>
                <option value="Lateral Derecho">Lateral Derecho</option>
                <option value="Mediocentro">Mediocentro</option>
                <option value="Extremo Derecho">Extremo Derecho</option>
                <option value="Extremo Izquierdo">Extremo Izquierdo</option>
                <option value="Delantero Centro">Delantero Centro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Equip</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-900"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Estat Inicial</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PlayerStatus)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-900"
            >
              <option value="Candidato">Candidat</option>
              <option value="Observado">Observat</option>
              <option value="Preseleccionado">Preseleccionat</option>
              <option value="Seleccionado">Seleccionat</option>
            </select>
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
              Guardar Jugador
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
