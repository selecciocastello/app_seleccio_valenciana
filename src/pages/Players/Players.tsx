import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ChevronRight,
  Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppStore } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';
import { JerseyBadge } from '../../components/ui/JerseyBadge';
import { CustomSelect } from '../../components/ui/Select';
import { PLAYER_POSITIONS, type Player, type PlayerStatus } from '../../types/models';

type SortField = 'name' | 'matches' | 'goals';
type SortOrder = 'asc' | 'desc';

export const Players: React.FC = () => {
  const { t } = useLanguage();
  const { players, teams, addPlayer, updatePlayer } = useAppStore();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [selectedInfantilYear, setSelectedInfantilYear] = useState<string>('all');
  const [selectedMatchesFilter, setSelectedMatchesFilter] = useState<string>('all');
  const [selectedGoalsFilter, setSelectedGoalsFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State per afegir nou jugador
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [position, setPosition] = useState<string>('Mediocentro');
  const [teamId, setTeamId] = useState(teams[0]?.id || '');
  const [status, setStatus] = useState<PlayerStatus>('Candidato');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [notes, setNotes] = useState('');

  const getPlayerStats = (player: Player) => {
    const sd = (player.sports_data || {}) as Record<string, any>;
    const rawMatches = sd.Jugados ?? sd.jugados ?? sd.matches_played ?? sd.Jugats ?? sd.jugats ?? 0;
    const rawGoals = sd.Goles ?? sd.goles ?? sd.goals ?? sd.Gols ?? sd.gols ?? 0;
    const rawTitular = sd.Titular ?? sd.titular ?? 0;
    const rawSuplente = sd.Suplente ?? sd.suplente ?? 0;
    const rawConvocados = sd.Convocados ?? sd.convocados ?? 0;
    const rawYellowCards = sd.Amarillas ?? sd.amarillas ?? sd.yellow_cards ?? 0;
    const rawRedCards = sd.Rojas ?? sd.rojas ?? sd.red_cards ?? 0;

    return {
      matches: rawMatches !== undefined && rawMatches !== null && String(rawMatches).trim() !== '' ? Number(rawMatches) || 0 : 0,
      goals: rawGoals !== undefined && rawGoals !== null && String(rawGoals).trim() !== '' ? Number(rawGoals) || 0 : 0,
      titular: rawTitular !== undefined && rawTitular !== null && String(rawTitular).trim() !== '' ? Number(rawTitular) || 0 : 0,
      suplente: rawSuplente !== undefined && rawSuplente !== null && String(rawSuplente).trim() !== '' ? Number(rawSuplente) || 0 : 0,
      convocados: rawConvocados !== undefined && rawConvocados !== null && String(rawConvocados).trim() !== '' ? Number(rawConvocados) || 0 : 0,
      yellowCards: rawYellowCards !== undefined && rawYellowCards !== null && String(rawYellowCards).trim() !== '' ? Number(rawYellowCards) || 0 : 0,
      redCards: rawRedCards !== undefined && rawRedCards !== null && String(rawRedCards).trim() !== '' ? Number(rawRedCards) || 0 : 0,
    };
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedStatus !== 'all' ||
    selectedTeam !== 'all' ||
    selectedPosition !== 'all' ||
    selectedInfantilYear !== 'all' ||
    selectedMatchesFilter !== 'all' ||
    selectedGoalsFilter !== 'all' ||
    sortBy !== 'name' ||
    sortOrder !== 'asc';

  const handleResetFilters = () => {
    setSearch('');
    setSelectedStatus('all');
    setSelectedTeam('all');
    setSelectedPosition('all');
    setSelectedInfantilYear('all');
    setSelectedMatchesFilter('all');
    setSelectedGoalsFilter('all');
    setSortBy('name');
    setSortOrder('asc');
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      // Para goles y partidos, comenzar ordenando de mayor a menor por utilidad
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  const normalizePosition = (pos?: string | null) => {
    if (!pos || pos === 'Candidato' || pos === 'Sense definir') return 'Sense definir';
    const match = PLAYER_POSITIONS.find((p) => p.toLowerCase() === pos.trim().toLowerCase());
    return match || pos;
  };

  const handlePositionChange = (playerId: string, playerName: string, newPosition: string) => {
    const finalPos = newPosition === 'Sense definir' ? '' : newPosition;
    updatePlayer(playerId, { position: finalPos });
    showToast(`Posició de ${playerName} actualitzada a "${newPosition}"`, 'success');
  };

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
      
      const normalizedPos = normalizePosition(p.position);
      const isUnassigned = normalizedPos === 'Sense definir';
      const matchesPosition =
        selectedPosition === 'all' ||
        (selectedPosition === 'unassigned' ? isUnassigned : normalizedPos === selectedPosition || p.position === selectedPosition);

      const matchesInfantilYear = selectedInfantilYear === 'all' || p.infantil_year === selectedInfantilYear;

      const stats = getPlayerStats(p);

      let matchesFilterPass = true;
      if (selectedMatchesFilter === 'with_matches') matchesFilterPass = stats.matches >= 1;
      else if (selectedMatchesFilter === 'min_3') matchesFilterPass = stats.matches >= 3;
      else if (selectedMatchesFilter === 'min_5') matchesFilterPass = stats.matches >= 5;
      else if (selectedMatchesFilter === 'no_matches') matchesFilterPass = stats.matches === 0;

      let goalsFilterPass = true;
      if (selectedGoalsFilter === 'with_goals') goalsFilterPass = stats.goals >= 1;
      else if (selectedGoalsFilter === 'min_3') goalsFilterPass = stats.goals >= 3;
      else if (selectedGoalsFilter === 'min_5') goalsFilterPass = stats.goals >= 5;
      else if (selectedGoalsFilter === 'no_goals') goalsFilterPass = stats.goals === 0;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesTeam &&
        matchesPosition &&
        matchesInfantilYear &&
        matchesFilterPass &&
        goalsFilterPass
      );
    });

    result.sort((a, b) => {
      if (sortBy === 'matches') {
        const aVal = getPlayerStats(a).matches;
        const bVal = getPlayerStats(b).matches;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      }
      if (sortBy === 'goals') {
        const aVal = getPlayerStats(a).goals;
        const bVal = getPlayerStats(b).goals;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      }

      const comp = a.full_name.localeCompare(b.full_name, 'ca', { sensitivity: 'base' });
      return sortOrder === 'desc' ? -comp : comp;
    });

    return result;
  }, [
    players,
    search,
    selectedStatus,
    selectedTeam,
    selectedPosition,
    selectedInfantilYear,
    selectedMatchesFilter,
    selectedGoalsFilter,
    sortBy,
    sortOrder,
  ]);

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
      position: position === 'Sense definir' ? '' : position,
      status,
      team_id: teamId,
      team: selectedTeamObj,
      phone: phone || undefined,
      email: email || undefined,
      guardian_name: guardianName || undefined,
      guardian_phone: guardianPhone || undefined,
      notes: notes || undefined
    });

    showToast('Jugador afegit correctament a la base de dades', 'success');
    setIsModalOpen(false);
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setGuardianName('');
    setGuardianPhone('');
    setNotes('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#061338] uppercase tracking-wider">{t.players}</h1>
          <p className="text-xs font-semibold text-slate-600">
            Cens, posicionament i seguiment de candidats de la província de Castelló
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
      <Card className="p-4 sm:p-5 bg-white space-y-4 shadow-sm border border-slate-200/80 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {/* Buscador */}
          <div className="relative sm:col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#002568] focus:ring-2 focus:ring-[#002568]/15 transition-all shadow-xs"
            />
          </div>

          {/* Filtro Año Infantil */}
          <CustomSelect
            value={selectedInfantilYear}
            onChange={setSelectedInfantilYear}
            options={[
              { value: 'all', label: 'Tots els Anys' },
              { value: 'Infantil 1er año', label: 'Infantil 1er any' },
              { value: 'Infantil 2º año', label: 'Infantil 2n any' },
              { value: 'Desconocido', label: 'Desconegut' },
            ]}
          />

          {/* Filtro Posición */}
          <CustomSelect
            value={selectedPosition}
            onChange={setSelectedPosition}
            options={[
              { value: 'all', label: 'Posició: Totes' },
              { value: 'unassigned', label: 'Sense definir' },
              ...PLAYER_POSITIONS.map((pos) => ({ value: pos, label: pos })),
            ]}
          />

          {/* Filtro Estado */}
          <CustomSelect
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={[
              { value: 'all', label: 'Tots els Estats' },
              { value: 'Candidato', label: 'Candidat' },
              { value: 'Observado', label: 'Observat' },
              { value: 'Preseleccionado', label: 'Preseleccionat' },
              { value: 'Seleccionado', label: 'Seleccionat' },
              { value: 'Lesionado', label: 'Lesionat' },
            ]}
          />

          {/* Filtro Equipo (con buscador integrado) */}
          <CustomSelect
            value={selectedTeam}
            onChange={setSelectedTeam}
            searchable={true}
            searchPlaceholder="Cercar equip..."
            options={[
              { value: 'all', label: 'Tots els Equips' },
              ...teams.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />

          {/* Filtro Partidos Jugados */}
          <CustomSelect
            value={selectedMatchesFilter}
            onChange={setSelectedMatchesFilter}
            options={[
              { value: 'all', label: 'Partits: Tots' },
              { value: 'with_matches', label: 'Amb partits (≥ 1 PJ)' },
              { value: 'min_3', label: 'Més de 3 (≥ 3 PJ)' },
              { value: 'min_5', label: 'Més de 5 (≥ 5 PJ)' },
              { value: 'no_matches', label: 'Sense partits (0 PJ)' },
            ]}
          />

          {/* Filtro Goles */}
          <CustomSelect
            value={selectedGoalsFilter}
            onChange={setSelectedGoalsFilter}
            options={[
              { value: 'all', label: 'Gols: Tots' },
              { value: 'with_goals', label: 'Amb gols (≥ 1 gol)' },
              { value: 'min_3', label: 'Golejadors (≥ 3 gols)' },
              { value: 'min_5', label: 'Top golejadors (≥ 5 gols)' },
              { value: 'no_goals', label: 'Sense gols (0)' },
            ]}
          />
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-semibold">
              Filtres actius: <strong className="text-[#061338]">{filteredPlayers.length}</strong> jugadors trobats
            </span>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restablir filtres</span>
            </button>
          </div>
        )}
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
        <div className="md:hidden space-y-3.5">
          {filteredPlayers.map((player) => {
            const stats = getPlayerStats(player);
            const currentPos = normalizePosition(player.position);
            return (
              <Card key={player.id} className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-3">
                {/* 1. Header: Foto neta (sense tapar), Nom, Club, Tags i a la dreta Dorsal + Estat */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Foto clara i neta */}
                    <div className="relative shrink-0">
                      {player.photo_url ? (
                        <img
                          src={player.photo_url}
                          alt={player.full_name}
                          className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-2xs bg-slate-100"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-[#002568] text-white flex items-center justify-center font-black text-base uppercase shadow-2xs">
                          {player.first_name[0]}
                          {player.last_name[0]}
                        </div>
                      )}
                    </div>

                    {/* Informació Principal: Nom, Club, Any Infantil i Edat */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#061338] uppercase leading-tight line-clamp-2">
                        {player.full_name}
                      </p>

                      {/* Club / Equip */}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mt-1 truncate">
                        {player.team?.crest_url ? (
                          <img
                            src={player.team.crest_url}
                            alt={player.team.name}
                            className="w-4 h-4 object-contain shrink-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Shield className="w-3.5 h-3.5 text-[#ff6600] shrink-0" />
                        )}
                        <span className="truncate">{player.team?.name || 'Sense equip'}</span>
                      </div>

                      {/* Tags: Categoria, Any i Edat */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-flex items-center border",
                            player.infantil_year === 'Infantil 1er año' && "bg-sky-50 text-sky-700 border-sky-300",
                            player.infantil_year === 'Infantil 2º año' && "bg-emerald-50 text-emerald-700 border-emerald-300",
                            (!player.infantil_year || player.infantil_year === 'Desconocido') && "bg-slate-100 text-slate-600 border-slate-200"
                          )}
                        >
                          {player.infantil_year === 'Infantil 2º año' ? '2n Any (2011)' : player.infantil_year === 'Infantil 1er año' ? '1r Any (2012)' : 'Infantil'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {player.age ? `${player.age} anys` : '13 anys'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dorsal i Estat a la dreta (mai damunt de la foto) */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <JerseyBadge number={player.jersey_number} size="sm" variant="kit" color="blue" />
                    <Badge status={player.status} />
                  </div>
                </div>

                {/* 2. Selector Ràpid de Posició */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Posició al camp:
                    </span>
                    <span className={clsx(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded",
                      currentPos !== 'Sense definir' ? "bg-sky-100 text-[#002568] font-black" : "bg-slate-200 text-slate-600"
                    )}>
                      {currentPos !== 'Sense definir' ? 'Assignada' : 'Pendent'}
                    </span>
                  </div>
                  <select
                    value={currentPos}
                    onChange={(e) => handlePositionChange(player.id, player.full_name, e.target.value)}
                    className={clsx(
                      "w-full text-xs font-bold rounded-lg px-3 py-2 border transition-all cursor-pointer focus:outline-none",
                      currentPos !== 'Sense definir'
                        ? "bg-white text-[#002568] border-sky-400 font-black shadow-2xs"
                        : "bg-white text-slate-600 border-slate-300"
                    )}
                  >
                    <option value="Sense definir">Sense definir (Tria la posició)</option>
                    {PLAYER_POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Panell d'Estadístiques FFCV (Partits i Gols com a l'ordinador) */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-center">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 block">Partits</span>
                    <span className="text-xs font-black text-slate-800">{stats.matches} PJ</span>
                  </div>
                  <div className="border-l border-slate-200">
                    <span className="text-[9px] font-black uppercase text-slate-500 block">Gols</span>
                    <span className={clsx(
                      "text-xs font-black px-2 py-0.5 rounded-md inline-block",
                      stats.goals > 0 ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "text-slate-600"
                    )}>
                      {stats.goals}
                    </span>
                  </div>
                </div>

                {/* 4. Botó d'acció: Veure Perfil */}
                <Link
                  to={`/jugadores/${player.id}`}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#061338] hover:bg-[#002568] text-white font-black text-xs uppercase tracking-wider rounded-xl transition-colors shadow-xs"
                >
                  <span>Veure Perfil</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      {/* Taula de Jugadors - Escriptori */}
      {filteredPlayers.length > 0 && (
        <Card className="hidden md:block overflow-hidden bg-white border border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-[#061338] text-white font-black uppercase tracking-wider">
                  <th className="py-3.5 px-3 w-12 text-center">Dorsal</th>
                  <th
                    onClick={() => handleSort('name')}
                    className="py-3.5 px-3 cursor-pointer select-none hover:bg-[#002568] transition-colors min-w-[180px]"
                    title="Ordenar per nom"
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>Jugador</span>
                      {sortBy === 'name' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#ff6600]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#ff6600]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Any Infantil</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Posició (Editable)</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Equip</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap">Edat</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap">Estat</th>
                  <th
                    onClick={() => handleSort('matches')}
                    className="py-3.5 px-3 text-center cursor-pointer select-none hover:bg-[#002568] transition-colors whitespace-nowrap"
                    title="Ordenar per partits jugats"
                  >
                    <div className="inline-flex items-center gap-1.5 justify-center">
                      <span>Partits</span>
                      {sortBy === 'matches' ? (
                        sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-[#ff6600]" /> : <ArrowUp className="w-3.5 h-3.5 text-[#ff6600]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('goals')}
                    className="py-3.5 px-3 text-center cursor-pointer select-none hover:bg-[#002568] transition-colors whitespace-nowrap"
                    title="Ordenar per gols"
                  >
                    <div className="inline-flex items-center gap-1.5 justify-center">
                      <span>Gols</span>
                      {sortBy === 'goals' ? (
                        sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5 text-[#ff6600]" /> : <ArrowUp className="w-3.5 h-3.5 text-[#ff6600]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-right sticky right-0 bg-[#061338] z-20 whitespace-nowrap shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.25)]">
                    Acció
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredPlayers.map((player) => {
                  const stats = getPlayerStats(player);
                  const currentPos = normalizePosition(player.position);
                  return (
                    <tr key={player.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-3 px-3 text-center">
                        <JerseyBadge number={player.jersey_number} size="sm" variant="kit" color="blue" />
                      </td>
                      <td className="py-3 px-3 font-black text-slate-900">
                        <Link
                          to={`/jugadores/${player.id}`}
                          className="flex items-center gap-3 group/player hover:text-[#002568] transition-colors"
                        >
                          {player.photo_url ? (
                            <img
                              src={player.photo_url}
                              alt={player.full_name}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm shrink-0 group-hover/player:ring-2 group-hover/player:ring-[#ff6600] transition-all"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#002568] text-white flex items-center justify-center font-black text-xs uppercase shadow-sm shrink-0 group-hover/player:ring-2 group-hover/player:ring-[#ff6600] transition-all">
                              {player.first_name[0]}
                              {player.last_name[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-sm font-black text-[#061338] uppercase group-hover/player:text-[#002568] group-hover/player:underline block truncate max-w-[200px]">
                              {player.full_name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {player.notes && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold" title={player.notes}>
                                  📝 Nota
                                </span>
                              )}
                              {(player.phone || player.guardian_phone) && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold" title={`Tel: ${player.phone || player.guardian_phone}`}>
                                  📞 Tel
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
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
                      {/* Posició Directament Editable */}
                      <td className="py-3 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={currentPos}
                          onChange={(e) => handlePositionChange(player.id, player.full_name, e.target.value)}
                          className={clsx(
                            "text-xs font-bold rounded-xl px-2.5 py-1.5 border transition-all cursor-pointer focus:outline-none",
                            currentPos !== 'Sense definir'
                              ? "bg-sky-50 text-[#002568] border-sky-300 hover:border-sky-400 font-black"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <option value="Sense definir">Sense definir</option>
                          {PLAYER_POSITIONS.map((pos) => (
                            <option key={pos} value={pos}>
                              {pos}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {player.team?.crest_url ? (
                            <img
                              src={player.team.crest_url}
                              alt={player.team.name}
                              className="w-5 h-5 object-contain shrink-0"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Shield className="w-4 h-4 text-[#ff6600] shrink-0" />
                          )}
                          <span className="truncate max-w-[160px]" title={player.team?.name}>
                            {player.team?.name || 'Sense equip'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-600 text-center whitespace-nowrap">
                        {player.age ? `${player.age} anys` : (player.birth_date || 'Infantil')}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <Badge status={player.status} />
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center min-w-7 px-2.5 py-1 rounded-lg font-bold text-xs bg-slate-100 text-slate-700 border border-slate-200">
                          {stats.matches}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={clsx(
                            "inline-flex items-center justify-center min-w-7 px-2.5 py-1 rounded-lg text-xs border font-bold",
                            Number(stats.goals) > 0
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-black"
                              : "bg-slate-50 text-slate-400 border-slate-200"
                          )}
                        >
                          {stats.goals}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right sticky right-0 bg-white group-hover:bg-slate-50 z-10 whitespace-nowrap shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.06)]">
                        <Link
                          to={`/jugadores/${player.id}`}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#061338] hover:bg-[#002568] text-white font-black text-xs rounded-full transition-all shadow-xs hover:shadow-md hover:scale-105 active:scale-95 whitespace-nowrap"
                        >
                          <span>Ver Perfil</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom *</label>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Cognoms *</label>
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
              <CustomSelect
                label="Posició al Camp"
                value={position}
                onChange={setPosition}
                options={PLAYER_POSITIONS.map((pos) => ({ value: pos, label: pos }))}
              />
            </div>
            <div>
              <CustomSelect
                label="Equip"
                value={teamId}
                onChange={setTeamId}
                searchable={teams.length > 5}
                searchPlaceholder="Cercar equip..."
                options={teams.map((t) => ({ value: t.id, label: t.name }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Telèfon Jugador</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="600 123 456"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Jugador</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@email.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom Tutor / Família</label>
              <input
                type="text"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="Ex: Pare o Mare"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Telèfon Tutor</label>
              <input
                type="tel"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                placeholder="611 987 654"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <div>
            <CustomSelect
              label="Estat Inicial"
              value={status}
              onChange={(val) => setStatus(val as PlayerStatus)}
              options={[
                { value: 'Candidato', label: 'Candidat' },
                { value: 'Observado', label: 'Observat' },
                { value: 'Preseleccionado', label: 'Preseleccionat' },
                { value: 'Seleccionado', label: 'Seleccionat' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Comentaris / Notes de Seguiment</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observacions tècniques inicials del jugador..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 focus:outline-none focus:border-[#002568]"
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
              Guardar Jugador
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
