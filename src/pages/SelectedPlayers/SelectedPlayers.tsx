import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Star,
  Shield,
  Plus,
  CheckSquare,
  Square,
  Search,
  Calendar,
  MapPin,
  Layers,
  LayoutGrid,
  Building2,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  List,
  UserCheck,
  Award
} from 'lucide-react';
import clsx from 'clsx';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { JerseyBadge } from '../../components/ui/JerseyBadge';
import { Modal } from '../../components/ui/Modal';
import { StarRating } from '../../components/ui/StarRating';
import { useAppStore } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';
import type { Player } from '../../types/models';
import { PlayerPhoto } from '../../components/ui/PlayerPhoto';

type ViewMode = 'list_position' | 'cards_position' | 'team' | 'grid';
type StatusFilter = 'all' | 'Preseleccionado' | 'Seleccionado' | 'all_pool';

interface PositionGroup {
  id: string;
  name: string;
  short: string;
  badgeClass: string;
  headerBorder: string;
  headerBg: string;
  iconBg: string;
  players: Player[];
}

interface TeamGroup {
  id: string;
  name: string;
  crestUrl?: string;
  players: Player[];
}

export const SelectedPlayers: React.FC = () => {
  const { players, callups, updatePlayer, addPlayersToCallup, createCallup } = useAppStore();
  const { showToast } = useToast();

  // Filtros y modo de visualización (Por defecto 'list_position' = formato lista organizado por posiciones)
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list_position');
  const [ratingFilter, setRatingFilter] = useState<'all' | 'min_4' | 'min_3' | 'unrated'>('all');

  // Selección múltiple para convocatorias
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  // Modal para añadir a convocatoria
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'existing' | 'new'>('existing');
  const [targetCallupId, setTargetCallupId] = useState<string>(callups[0]?.id || '');

  // Formulario nueva convocatoria
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newLocation, setNewLocation] = useState('Instal·lacions Esportives Chencho (Castelló)');
  const [newNotes, setNewNotes] = useState('');

  // 1. Base pool de jugadores seleccionados / preseleccionados (o todos para reclutamiento)
  const basePool = useMemo(() => {
    return players.filter((p) => {
      if (statusFilter === 'all') {
        return p.status === 'Seleccionado' || p.status === 'Preseleccionado';
      }
      if (statusFilter === 'Preseleccionado') {
        return p.status === 'Preseleccionado';
      }
      if (statusFilter === 'Seleccionado') {
        return p.status === 'Seleccionado';
      }
      if (statusFilter === 'all_pool') {
        return true; // Todos los jugadores para búsqueda amplia
      }
      return false;
    });
  }, [players, statusFilter]);

  // 2. Filtro de búsqueda y valoración de estrellas
  const filteredPlayers = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    return basePool.filter((p) => {
      const pName = (p.full_name || '').toLowerCase();
      const pTeam = (p.team?.name || '').toLowerCase();
      const pPos = (p.position || '').toLowerCase();
      const pSecPos = (p.secondary_position || '').toLowerCase();

      const matchesSearch =
        !searchLower ||
        pName.includes(searchLower) ||
        pTeam.includes(searchLower) ||
        pPos.includes(searchLower) ||
        pSecPos.includes(searchLower);

      let matchesRating = true;
      const r = p.rating || 0;
      if (ratingFilter === 'min_4') matchesRating = r >= 4;
      else if (ratingFilter === 'min_3') matchesRating = r >= 3;
      else if (ratingFilter === 'unrated') matchesRating = r === 0;

      return matchesSearch && matchesRating;
    });
  }, [basePool, search, ratingFilter]);

  // Estadísticas rápidas
  const totalPre = useMemo(() => players.filter((p) => p.status === 'Preseleccionado').length, [players]);
  const totalSel = useMemo(() => players.filter((p) => p.status === 'Seleccionado').length, [players]);
  const ratedCount = useMemo(
    () => basePool.filter((p) => (p.rating || 0) > 0).length,
    [basePool]
  );
  const avgRating = useMemo(() => {
    const rated = basePool.filter((p) => (p.rating || 0) > 0);
    if (rated.length === 0) return 0;
    const sum = rated.reduce((acc, p) => acc + (p.rating || 0), 0);
    return (sum / rated.length).toFixed(1);
  }, [basePool]);

  // Agrupación por Demarcación / Posición (Porteros, Defensas, Medios, Delanteros)
  const positionGroups = useMemo<PositionGroup[]>(() => {
    const porters: Player[] = [];
    const defenses: Player[] = [];
    const migs: Player[] = [];
    const davanters: Player[] = [];
    const sensePos: Player[] = [];

    filteredPlayers.forEach((p) => {
      const pos = (p.position || '').toLowerCase();
      if (!pos || pos === 'sense definir' || pos === 'candidato' || pos === 'desconocido') {
        sensePos.push(p);
      } else if (pos.includes('porter') || pos.includes('arquero') || pos.includes('goalkeeper')) {
        porters.push(p);
      } else if (
        pos.includes('defensa') ||
        pos.includes('lateral') ||
        pos.includes('carrilero') ||
        pos.includes('central')
      ) {
        defenses.push(p);
      } else if (
        pos.includes('mig') ||
        pos.includes('pivote') ||
        pos.includes('mediocentro') ||
        pos.includes('mediapunta') ||
        pos.includes('medio') ||
        pos.includes('interior') ||
        pos.includes('centrocampista')
      ) {
        migs.push(p);
      } else if (
        pos.includes('delantero') ||
        pos.includes('extrem') ||
        pos.includes('punta') ||
        pos.includes('davanter') ||
        pos.includes('atacante')
      ) {
        davanters.push(p);
      } else {
        sensePos.push(p);
      }
    });

    const groups: PositionGroup[] = [
      {
        id: 'porteria',
        name: 'Porteros / Porters',
        short: 'POR',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
        headerBorder: 'border-l-4 border-amber-500',
        headerBg: 'bg-amber-50/70',
        iconBg: 'bg-amber-500 text-white',
        players: porters
      },
      {
        id: 'defensa',
        name: 'Defensas / Línia Defensiva (Centrals i Laterals)',
        short: 'DEF',
        badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
        headerBorder: 'border-l-4 border-blue-600',
        headerBg: 'bg-blue-50/70',
        iconBg: 'bg-blue-700 text-white',
        players: defenses
      },
      {
        id: 'migcamp',
        name: 'Medios / Mig del Camp (Pivots i Mitjos)',
        short: 'MIG',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        headerBorder: 'border-l-4 border-emerald-600',
        headerBg: 'bg-emerald-50/70',
        iconBg: 'bg-emerald-600 text-white',
        players: migs
      },
      {
        id: 'atac',
        name: 'Delanteros / Atac i Davantera (Extrems i Davanters)',
        short: 'DAV',
        badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
        headerBorder: 'border-l-4 border-[#ff6600]',
        headerBg: 'bg-orange-50/70',
        iconBg: 'bg-[#ff6600] text-white',
        players: davanters
      }
    ];

    if (sensePos.length > 0) {
      groups.push({
        id: 'sense_posicio',
        name: 'Sense Posició Definida / Polivalents',
        short: 'PEND',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        headerBorder: 'border-l-4 border-slate-400',
        headerBg: 'bg-slate-100/70',
        iconBg: 'bg-slate-500 text-white',
        players: sensePos
      });
    }

    return groups;
  }, [filteredPlayers]);

  // Agrupación por Club / Equipo
  const teamGroups = useMemo<TeamGroup[]>(() => {
    const map = new Map<string, { name: string; crestUrl?: string; players: Player[] }>();

    filteredPlayers.forEach((p) => {
      const teamId = p.team_id || p.team?.id || p.team?.name || 'sense_equip';
      const teamName = p.team?.name || 'Sense equip assignat';
      const crest = p.team?.crest_url;

      if (!map.has(teamId)) {
        map.set(teamId, { name: teamName, crestUrl: crest, players: [] });
      }
      map.get(teamId)!.players.push(p);
    });

    return Array.from(map.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        crestUrl: data.crestUrl,
        players: data.players
      }))
      .sort((a, b) => b.players.length - a.players.length);
  }, [filteredPlayers]);

  // Handlers de selección múltiple
  const toggleSelectPlayer = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const allIds = filteredPlayers.map((p) => p.id);
    setSelectedPlayerIds(allIds);
  };

  const deselectAll = () => {
    setSelectedPlayerIds([]);
  };

  // Handler de valoración por estrellas
  const handleRatingChange = (player: Player, newRating: number) => {
    updatePlayer(player.id, { rating: newRating });
    showToast(
      newRating > 0
        ? `Valoració de ${player.full_name}: ${newRating} de 5 estrelles ⭐`
        : `Valoració de ${player.full_name} restablerta`,
      'success'
    );
  };

  // Handlers de Convocatorias
  const handleOpenAddModal = () => {
    if (selectedPlayerIds.length === 0) {
      showToast('Selecciona almenys un jugador per afegir a la convocatòria', 'error');
      return;
    }
    if (callups.length > 0 && !targetCallupId) {
      setTargetCallupId(callups[0].id);
    }
    setIsModalOpen(true);
  };

  const handleConfirmAddToExisting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCallupId) {
      showToast('Selecciona una convocatòria existent', 'error');
      return;
    }

    const targetCallup = callups.find((c) => c.id === targetCallupId);
    const res = addPlayersToCallup(targetCallupId, selectedPlayerIds);

    showToast(
      `S'han afegit ${res.addedCount} jugadors a la convocatòria "${targetCallup?.title || 'Convocatòria'}" (${res.totalCount} jugadors en total)`,
      'success'
    );

    setIsModalOpen(false);
    setSelectedPlayerIds([]);
  };

  const handleConfirmCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDate) {
      showToast('Indica el títol i la data de la nova convocatòria', 'error');
      return;
    }

    const selectedObjs = players.filter((p) => selectedPlayerIds.includes(p.id));

    const created = createCallup({
      title: newTitle,
      date: new Date(newDate).toISOString(),
      location: newLocation,
      notes: newNotes,
      status: 'Planificada',
      callup_players: selectedObjs.map((p) => ({
        id: `cp_${p.id}_${Date.now()}`,
        callup_id: 'new',
        player_id: p.id,
        player: p,
        status: 'Convocado',
        attendance: true,
        created_at: new Date().toISOString()
      }))
    });

    showToast(`Nova convocatòria "${created.title}" creada amb ${selectedObjs.length} jugadors convocats`, 'success');
    setIsModalOpen(false);
    setSelectedPlayerIds([]);
    setNewTitle('');
    setNewDate('');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* 1. Header Oficial FFCV amb Resum */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#061338] uppercase tracking-wider flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff6600] to-amber-500 text-white flex items-center justify-center shadow-md">
              <Trophy className="w-5 h-5" />
            </div>
            <span>JUGADORS SELECCIONATS I PRESELECCIONATS</span>
          </h1>
          <p className="text-xs font-semibold text-slate-600 mt-1">
            Plantilla oficial organitzada per posicions, llistat d'accés ràpid, valoració de 1 a 5 estrelles i gestió de convocatòries
          </p>
        </div>

        {/* Botó Principal d'Acció: Convocatòries */}
        <div className="flex items-center gap-2">
          {selectedPlayerIds.length > 0 && (
            <button
              onClick={handleOpenAddModal}
              className="px-5 py-2.5 bg-[#ff6600] hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center gap-2 transition-all animate-pulse cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Convocar ({selectedPlayerIds.length}) a Convocatòria</span>
            </button>
          )}
          <Link
            to="/convocatorias"
            className="px-4 py-2.5 bg-[#061338] hover:bg-[#002568] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 transition-colors"
          >
            <ShieldAlert className="w-4 h-4 text-sky-300" />
            <span>Veure Convocatòries</span>
          </Link>
        </div>
      </div>

      {/* 2. Targetes de Resum de Plantilla */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Preseleccionats</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{totalPre}</span>
            <span className="text-[11px] font-bold text-slate-500">en seguiment</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Seleccionats</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{totalSel}</span>
            <span className="text-[11px] font-bold text-slate-500">oficials</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Valorats ⭐</span>
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{ratedCount}</span>
            <span className="text-[11px] font-bold text-slate-500">amb nota ({avgRating} ★)</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-[#061338] tracking-wider">Convocatòries</span>
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#061338]">{callups.length}</span>
            <span className="text-[11px] font-bold text-slate-500">creades</span>
          </div>
        </div>
      </div>

      {/* 3. Barra de Controls: Filtres, Mode de Vista i Búsqueda */}
      <Card className="p-4 bg-white border border-slate-200 shadow-sm space-y-3.5">
        {/* Fila 1: Filtres d'Estat i Botons de Format de Vista */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Pestanyes d'Estat */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setStatusFilter('all')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer',
                statusFilter === 'all'
                  ? 'bg-[#061338] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Tots ({totalPre + totalSel})
            </button>
            <button
              onClick={() => setStatusFilter('Preseleccionado')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer',
                statusFilter === 'Preseleccionado'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-100'
              )}
            >
              <span>⭐ Preseleccionats</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{totalPre}</span>
            </button>
            <button
              onClick={() => setStatusFilter('Seleccionado')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer',
                statusFilter === 'Seleccionado'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-100'
              )}
            >
              <span>🏆 Seleccionats</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">{totalSel}</span>
            </button>
            <button
              onClick={() => setStatusFilter('all_pool')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer',
                statusFilter === 'all_pool'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              )}
              title="Veure tots els jugadors del cens per reclutar"
            >
              Tots els Jugadors
            </button>
          </div>

          {/* Selector de Mode de Vista: Llista (Defecte) vs Targetes vs Equip vs Graella */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
              Vista:
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {/* 1. LLISTA PER POSICIÓ (EL PRIMER PER DEFECTE) */}
              <button
                onClick={() => setViewMode('list_position')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap cursor-pointer',
                  viewMode === 'list_position'
                    ? 'bg-[#061338] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
                title="Format de Llista organitzat per Posicions (Porteros, Defensas, Medios, Delanteros)"
              >
                <List className={clsx('w-3.5 h-3.5', viewMode === 'list_position' ? 'text-[#ff6600]' : 'text-slate-500')} />
                <span>Llista (Posicions)</span>
              </button>

              {/* 2. TARGETES PER POSICIÓ */}
              <button
                onClick={() => setViewMode('cards_position')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap cursor-pointer',
                  viewMode === 'cards_position'
                    ? 'bg-[#061338] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
                title="Format de Targetes amples per Posicions"
              >
                <Layers className={clsx('w-3.5 h-3.5', viewMode === 'cards_position' ? 'text-sky-300' : 'text-slate-500')} />
                <span>Targetes</span>
              </button>

              {/* 3. PER EQUIP / CLUB */}
              <button
                onClick={() => setViewMode('team')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap cursor-pointer',
                  viewMode === 'team'
                    ? 'bg-[#061338] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
                title="Agrupats per Equip / Club"
              >
                <Building2 className={clsx('w-3.5 h-3.5', viewMode === 'team' ? 'text-emerald-300' : 'text-slate-500')} />
                <span>Equips</span>
              </button>

              {/* 4. GRAELLA TOTAL */}
              <button
                onClick={() => setViewMode('grid')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap cursor-pointer',
                  viewMode === 'grid'
                    ? 'bg-[#061338] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
                title="Tots els jugadors en graella"
              >
                <LayoutGrid className={clsx('w-3.5 h-3.5', viewMode === 'grid' ? 'text-amber-300' : 'text-slate-500')} />
                <span>Graella Total</span>
              </button>
            </div>
          </div>
        </div>

        {/* Fila 2: Cercador i Filtre per Estrelles */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cercar per nom de jugador, club o posició..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002568]/20 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value as any)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">Totes les valoracions</option>
              <option value="min_4">⭐⭐⭐⭐+ (4 a 5 estrelles)</option>
              <option value="min_3">⭐⭐⭐+ (3 a 5 estrelles)</option>
              <option value="unrated">Sense valorar (0 estrelles)</option>
            </select>

            {/* Selecció Ràpida per a Convocatòria */}
            <button
              onClick={selectedPlayerIds.length === filteredPlayers.length && filteredPlayers.length > 0 ? deselectAll : selectAllFiltered}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
              title="Seleccionar o deseleccionar tots els jugadors mostrats"
            >
              {selectedPlayerIds.length > 0 && selectedPlayerIds.length === filteredPlayers.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-[#ff6600]" />
                  <span>Deseleccionar Tots</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-slate-500" />
                  <span>Seleccionar Tots ({filteredPlayers.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Card>

      {/* 4. Contingut Principal: Llistat / Agrupacions */}
      {filteredPlayers.length === 0 ? (
        <Card className="p-12 text-center bg-white border border-dashed border-slate-200 shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-full bg-orange-50 text-[#ff6600] mx-auto flex items-center justify-center">
            <Trophy className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
            No s'han trobat jugadors amb els filtres actuals
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Canvia els criteris de cerca o canvia l'estat dels jugadors a <strong>Preseleccionat</strong> o <strong>Seleccionat</strong> des de la seua fitxa.
          </p>
        </Card>
      ) : (
        <>
          {/* ========================================================= */}
          {/* MODE 1: LLISTA PER POSICIÓ (EL FORMAT SOL·LICITAT PER DEFECTE) */}
          {/* ========================================================= */}
          {viewMode === 'list_position' && (
            <div className="space-y-6">
              {positionGroups.map((group) => {
                if (group.players.length === 0) return null;
                const groupSelectedCount = group.players.filter((p) => selectedPlayerIds.includes(p.id)).length;
                const isAllGroupSelected = groupSelectedCount === group.players.length;

                return (
                  <div key={group.id} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all">
                    {/* Header de la Línia / Posició */}
                    <div className={clsx('p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80', group.headerBg, group.headerBorder)}>
                      <div className="flex items-center gap-3">
                        <span className={clsx('px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border shadow-2xs', group.badgeClass)}>
                          {group.short}
                        </span>
                        <div>
                          <h2 className="text-sm sm:text-base font-black text-[#061338] uppercase tracking-wide flex items-center gap-2">
                            <span>{group.name}</span>
                          </h2>
                          <span className="text-[11px] font-bold text-slate-500">
                            {group.players.length} {group.players.length === 1 ? 'jugador' : 'jugadors'} a la plantilla
                          </span>
                        </div>
                      </div>

                      {/* Botó per seleccionar/deseleccionar tota la línia */}
                      <button
                        type="button"
                        onClick={() => {
                          const groupIds = group.players.map((p) => p.id);
                          if (isAllGroupSelected) {
                            setSelectedPlayerIds((prev) => prev.filter((id) => !groupIds.includes(id)));
                          } else {
                            setSelectedPlayerIds((prev) => Array.from(new Set([...prev, ...groupIds])));
                          }
                        }}
                        className={clsx(
                          'self-start sm:self-auto px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border',
                          isAllGroupSelected
                            ? 'bg-[#061338] text-white border-[#061338] shadow-xs'
                            : 'bg-white/80 hover:bg-white text-slate-700 border-slate-300 shadow-2xs'
                        )}
                      >
                        {isAllGroupSelected ? (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-[#ff6600]" />
                            <span>Deseleccionar línia</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                            <span>Seleccionar línia ({group.players.length})</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Format Llista Desktop (Taula Neta i Compacta) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                            <th className="py-2.5 px-3 w-10 text-center">Triar</th>
                            <th className="py-2.5 px-2 w-12 text-center">Dorsal</th>
                            <th className="py-2.5 px-3 min-w-[200px]">Jugador</th>
                            <th className="py-2.5 px-3 min-w-[140px]">Posició Específica</th>
                            <th className="py-2.5 px-3 min-w-[150px]">Equip / Club</th>
                            <th className="py-2.5 px-3 text-center whitespace-nowrap">Edat / Any</th>
                            <th className="py-2.5 px-3 min-w-[140px]">Valoració ⭐</th>
                            <th className="py-2.5 px-3 text-center whitespace-nowrap">Partits / Gols</th>
                            <th className="py-2.5 px-3 text-center whitespace-nowrap">Estat</th>
                            <th className="py-2.5 px-3 text-right">Fitxa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.players.map((player) => {
                            const isSelected = selectedPlayerIds.includes(player.id);
                            const stats = {
                              matches: Number(player.sports_data?.Jugados || player.sports_data?.matches_played || 0),
                              goals: Number(player.sports_data?.Goles || player.sports_data?.goals || 0)
                            };
                            const currentPos = player.position && player.position !== 'Candidato' ? player.position : 'Sense definir';

                            return (
                              <tr
                                key={player.id}
                                className={clsx(
                                  'transition-colors duration-150 group',
                                  isSelected
                                    ? 'bg-sky-50/70 hover:bg-sky-50'
                                    : 'hover:bg-slate-50/80 bg-white'
                                )}
                              >
                                {/* 1. Checkbox */}
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => toggleSelectPlayer(player.id, e)}
                                    className="p-1 rounded hover:bg-black/5 transition-colors cursor-pointer"
                                    title={isSelected ? 'Deseleccionar jugador' : 'Seleccionar jugador'}
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-[#ff6600]" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                                    )}
                                  </button>
                                </td>

                                {/* 2. Dorsal */}
                                <td className="py-2.5 px-2 text-center">
                                  <JerseyBadge number={player.jersey_number} size="xs" variant="kit" color="blue" />
                                </td>

                                {/* 3. Jugador (Foto + Nom + Enllaç) */}
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2.5">
                                    <Link to={`/jugadores/${player.id}`} className="shrink-0 group/photo">
                                      <PlayerPhoto
                                        src={player.photo_url}
                                        alt={player.full_name}
                                        firstName={player.first_name}
                                        lastName={player.last_name}
                                        imgClassName="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-2xs group-hover/photo:ring-2 group-hover/photo:ring-[#ff6600] transition-all bg-slate-100"
                                        fallbackClassName="w-9 h-9 rounded-xl bg-[#002568] text-white flex items-center justify-center font-black text-xs uppercase shadow-2xs group-hover/photo:ring-2 group-hover/photo:ring-[#ff6600] transition-all"
                                      />
                                    </Link>
                                    <div className="min-w-0">
                                      <Link
                                        to={`/jugadores/${player.id}`}
                                        className="font-black text-[#061338] hover:text-[#ff6600] uppercase truncate block transition-colors leading-tight"
                                      >
                                        {player.full_name}
                                      </Link>
                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold mt-0.5">
                                        {player.infantil_year && (
                                          <span className="text-slate-600 font-bold">
                                            {player.infantil_year === 'Infantil 2º año' ? '2n Any' : player.infantil_year === 'Infantil 1er año' ? '1r Any' : player.infantil_year}
                                          </span>
                                        )}
                                        {player.birth_year && (
                                          <span className="text-[#002568] font-bold font-mono">({player.birth_year})</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* 4. Posició específica */}
                                <td className="py-2.5 px-3">
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-sky-50 text-[#002568] border border-sky-200 self-start">
                                      {currentPos}
                                    </span>
                                    {player.secondary_position && player.secondary_position !== 'Sense definir' && (
                                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 self-start">
                                        Alt: {player.secondary_position}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* 5. Club / Equip */}
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 truncate max-w-[180px]">
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
                                </td>

                                {/* 6. Edat */}
                                <td className="py-2.5 px-3 text-center">
                                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                    {player.age ? `${player.age} anys` : '13 anys'}
                                  </span>
                                </td>

                                {/* 7. Valoració Tècnica (⭐ Estrelles Interactives) */}
                                <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-2">
                                    <StarRating
                                      rating={player.rating || 0}
                                      onChange={(newRating) => handleRatingChange(player, newRating)}
                                      size="sm"
                                    />
                                    <span className="text-[10px] font-black text-slate-600 whitespace-nowrap">
                                      {player.rating ? `${player.rating}★` : '-'}
                                    </span>
                                  </div>
                                </td>

                                {/* 8. Estadístiques FFCV */}
                                <td className="py-2.5 px-3 text-center">
                                  <div className="inline-flex items-center gap-2 text-xs font-bold">
                                    <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded" title="Partits Jugats">
                                      {stats.matches} PJ
                                    </span>
                                    <span
                                      className={clsx(
                                        'px-1.5 py-0.5 rounded font-black',
                                        stats.goals > 0
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                          : 'text-slate-500 bg-slate-50'
                                      )}
                                      title="Gols Marcats"
                                    >
                                      {stats.goals} {stats.goals === 1 ? 'gol' : 'gols'}
                                    </span>
                                  </div>
                                </td>

                                {/* 9. Estat */}
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <Badge status={player.status} />
                                </td>

                                {/* 10. Fitxa */}
                                <td className="py-2.5 px-3 text-right">
                                  <Link
                                    to={`/jugadores/${player.id}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-[#061338] text-slate-700 hover:text-white rounded-lg text-[11px] font-black uppercase tracking-wider transition-colors shadow-2xs"
                                  >
                                    <span>Fitxa</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Format Llista Mòbil (Files Compactes d'Alta Densitat) */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {group.players.map((player) => {
                        const isSelected = selectedPlayerIds.includes(player.id);
                        const stats = {
                          matches: Number(player.sports_data?.Jugados || player.sports_data?.matches_played || 0),
                          goals: Number(player.sports_data?.Goles || player.sports_data?.goals || 0)
                        };
                        const currentPos = player.position && player.position !== 'Candidato' ? player.position : 'Sense definir';

                        return (
                          <div
                            key={player.id}
                            className={clsx(
                              'p-3 transition-colors',
                              isSelected ? 'bg-sky-50/70' : 'bg-white'
                            )}
                          >
                            <div className="flex items-start gap-2.5">
                              {/* Checkbox */}
                              <button
                                type="button"
                                onClick={(e) => toggleSelectPlayer(player.id, e)}
                                className="mt-1 p-1 rounded hover:bg-black/5"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-[#ff6600]" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                              </button>

                              {/* Foto */}
                              <Link to={`/jugadores/${player.id}`} className="shrink-0">
                                <PlayerPhoto
                                  src={player.photo_url}
                                  alt={player.full_name}
                                  firstName={player.first_name}
                                  lastName={player.last_name}
                                  imgClassName="w-10 h-10 rounded-xl object-cover border border-slate-200"
                                  fallbackClassName="w-10 h-10 rounded-xl bg-[#002568] text-white flex items-center justify-center font-black text-xs uppercase"
                                />
                              </Link>

                              {/* Info Jugador */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <Link
                                    to={`/jugadores/${player.id}`}
                                    className="font-black text-xs text-[#061338] uppercase truncate block"
                                  >
                                    {player.full_name}
                                  </Link>
                                  <Badge status={player.status} />
                                </div>

                                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 mt-0.5">
                                  <span className="truncate">{player.team?.name || 'Sense equip'}</span>
                                  <span>•</span>
                                  <span className="text-[#002568] font-black uppercase text-[10px]">{currentPos}</span>
                                </div>

                                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <StarRating
                                      rating={player.rating || 0}
                                      onChange={(newRating) => handleRatingChange(player, newRating)}
                                      size="xs"
                                    />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-600">
                                      {stats.matches} PJ / {stats.goals} G
                                    </span>
                                    <Link
                                      to={`/jugadores/${player.id}`}
                                      className="px-2 py-0.5 bg-[#061338] text-white text-[10px] font-black uppercase rounded"
                                    >
                                      Fitxa &gt;
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 2: TARGETES PER POSICIÓ */}
          {/* ========================================================= */}
          {viewMode === 'cards_position' && (
            <div className="space-y-8">
              {positionGroups.map((group) => {
                if (group.players.length === 0) return null;
                const groupSelectedCount = group.players.filter((p) => selectedPlayerIds.includes(p.id)).length;
                return (
                  <div key={group.id} className="space-y-3">
                    {/* Header de la Demarcació */}
                    <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${group.badgeClass}`}>
                          {group.short}
                        </span>
                        <h2 className="text-base font-black text-[#061338] uppercase tracking-wide">
                          {group.name}
                        </h2>
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          {group.players.length} {group.players.length === 1 ? 'jugador' : 'jugadors'}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          const groupIds = group.players.map((p) => p.id);
                          const allSelected = groupIds.every((id) => selectedPlayerIds.includes(id));
                          if (allSelected) {
                            setSelectedPlayerIds((prev) => prev.filter((id) => !groupIds.includes(id)));
                          } else {
                            setSelectedPlayerIds((prev) => Array.from(new Set([...prev, ...groupIds])));
                          }
                        }}
                        className="text-[11px] font-black text-slate-600 hover:text-[#061338] transition-colors cursor-pointer"
                      >
                        {groupSelectedCount === group.players.length
                          ? 'Deseleccionar línia'
                          : `Seleccionar línia (${group.players.length})`}
                      </button>
                    </div>

                    {/* Graella de Targetes del Grup */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.players.map((player) => (
                        <PlayerCardInteractive
                          key={player.id}
                          player={player}
                          isSelected={selectedPlayerIds.includes(player.id)}
                          onToggleSelect={() => toggleSelectPlayer(player.id)}
                          onRatingChange={(r) => handleRatingChange(player, r)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 3: AGRUPAT PER EQUIP / CLUB */}
          {/* ========================================================= */}
          {viewMode === 'team' && (
            <div className="space-y-8">
              {teamGroups.map((group) => {
                const groupSelectedCount = group.players.filter((p) => selectedPlayerIds.includes(p.id)).length;
                return (
                  <div key={group.id} className="space-y-3">
                    {/* Header del Club */}
                    <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2">
                      <div className="flex items-center gap-2.5">
                        {group.crestUrl ? (
                          <img
                            src={group.crestUrl}
                            alt={group.name}
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Shield className="w-5 h-5 text-[#ff6600]" />
                        )}
                        <h2 className="text-base font-black text-[#061338] uppercase tracking-wide">
                          {group.name}
                        </h2>
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          {group.players.length} {group.players.length === 1 ? 'jugador' : 'jugadors'}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          const groupIds = group.players.map((p) => p.id);
                          const allSelected = groupIds.every((id) => selectedPlayerIds.includes(id));
                          if (allSelected) {
                            setSelectedPlayerIds((prev) => prev.filter((id) => !groupIds.includes(id)));
                          } else {
                            setSelectedPlayerIds((prev) => Array.from(new Set([...prev, ...groupIds])));
                          }
                        }}
                        className="text-[11px] font-black text-slate-600 hover:text-[#061338] transition-colors cursor-pointer"
                      >
                        {groupSelectedCount === group.players.length
                          ? 'Deseleccionar equip'
                          : `Seleccionar club (${group.players.length})`}
                      </button>
                    </div>

                    {/* Graella de Targetes del Club */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.players.map((player) => (
                        <PlayerCardInteractive
                          key={player.id}
                          player={player}
                          isSelected={selectedPlayerIds.includes(player.id)}
                          onToggleSelect={() => toggleSelectPlayer(player.id)}
                          onRatingChange={(r) => handleRatingChange(player, r)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================= */}
          {/* MODE 4: GRAELLA TOTAL */}
          {/* ========================================================= */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlayers.map((player) => (
                <PlayerCardInteractive
                  key={player.id}
                  player={player}
                  isSelected={selectedPlayerIds.includes(player.id)}
                  onToggleSelect={() => toggleSelectPlayer(player.id)}
                  onRatingChange={(r) => handleRatingChange(player, r)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* 5. Barra Flotant d'Acció Ràpida (Sticky Bottom quan hi ha selecció) */}
      {selectedPlayerIds.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 md:left-64 z-40 animate-fade-in-up">
          <div className="max-w-4xl mx-auto bg-[#061338] text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#ff6600] text-white flex items-center justify-center font-black text-sm shadow-md">
                {selectedPlayerIds.length}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider">
                  {selectedPlayerIds.length} {selectedPlayerIds.length === 1 ? 'jugador seleccionat' : 'jugadors seleccionats'}
                </p>
                <p className="text-[11px] text-sky-200">
                  A punt per afegir a una convocatòria oficial o crear-ne una nova
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={deselectAll}
                className="flex-1 sm:flex-none px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel·lar
              </button>
              <button
                onClick={handleOpenAddModal}
                className="flex-1 sm:flex-none px-5 py-2 bg-[#ff6600] hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Afegir a Convocatòria</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal per Afegir a Convocatòria (Existent o Nova) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Convocatòria: Afegir ${selectedPlayerIds.length} Jugadors`}
      >
        <div className="space-y-5">
          {/* Pestanyes del Modal: Existent vs Nova */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setModalTab('existing')}
              className={clsx(
                'flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer',
                modalTab === 'existing'
                  ? 'bg-white text-[#061338] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Convocatòria Existent ({callups.length})
            </button>
            <button
              type="button"
              onClick={() => setModalTab('new')}
              className={clsx(
                'flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer',
                modalTab === 'new'
                  ? 'bg-white text-[#061338] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              + Crear Nova Convocatòria
            </button>
          </div>

          {/* Opció 1: Seleccionar Convocatòria Existent */}
          {modalTab === 'existing' && (
            <form onSubmit={handleConfirmAddToExisting} className="space-y-4">
              {callups.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                  <p className="text-xs font-bold text-slate-600">
                    No hi ha cap convocatòria creada prèviament.
                  </p>
                  <button
                    type="button"
                    onClick={() => setModalTab('new')}
                    className="px-4 py-2 bg-[#ff6600] text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                    Crear la Primera Convocatòria
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-black text-[#061338] uppercase tracking-wider mb-2">
                      Tria la Convocatòria Destinació:
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                      {callups.map((callup) => {
                        const isSelected = targetCallupId === callup.id;
                        const currentCount = callup.callup_players?.length || 0;
                        return (
                          <div
                            key={callup.id}
                            onClick={() => setTargetCallupId(callup.id)}
                            className={clsx(
                              'p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3',
                              isSelected
                                ? 'bg-sky-50/70 border-[#002568] shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-black text-[#061338] uppercase truncate">
                                  {callup.title}
                                </h4>
                                <Badge status={callup.status} />
                              </div>
                              <p className="text-[11px] font-semibold text-slate-500 mt-1 flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-[#ff6600]" />
                                {new Date(callup.date).toLocaleDateString('ca-ES')} •
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span className="truncate">{callup.location}</span>
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-[#002568] block">
                                {currentCount} jugadors
                              </span>
                              <span className="text-[10px] text-emerald-600 font-bold">
                                +{selectedPlayerIds.length} nous
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel·lar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#ff6600] hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar i Afegir</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* Opció 2: Crear Nova Convocatòria al Vol */}
          {modalTab === 'new' && (
            <form onSubmit={handleConfirmCreateAndAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-[#061338] uppercase tracking-wider mb-1">
                  Títol de la Convocatòria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 2a Convocatòria Oficial Chencho"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#002568]/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-[#061338] uppercase tracking-wider mb-1">
                    Data i Hora *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#002568]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-[#061338] uppercase tracking-wider mb-1">
                    Ubicació / Instal·lació
                  </label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#002568]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#061338] uppercase tracking-wider mb-1">
                  Observacions / Objectius de la Sessió
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes per al cos tècnic i objectius d'observació..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#002568]/20"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs font-bold text-amber-900 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                <span>
                  S'inclouran directament els <strong>{selectedPlayerIds.length} jugadors seleccionats</strong> com a convocats actius.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel·lar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#ff6600] hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear i Convocar</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
};

// --- SUB-COMPONENT: Targeta Interactiva de Jugador amb Valoració 1-5 estrelles ---
interface PlayerCardInteractiveProps {
  player: Player;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRatingChange: (newRating: number) => void;
}

const PlayerCardInteractive: React.FC<PlayerCardInteractiveProps> = ({
  player,
  isSelected,
  onToggleSelect,
  onRatingChange
}) => {
  const currentPos = player.position && player.position !== 'Candidato' ? player.position : 'Sense definir';
  const stats = {
    matches: Number(player.sports_data?.Jugados || player.sports_data?.matches_played || 0),
    goals: Number(player.sports_data?.Goles || player.sports_data?.goals || 0)
  };

  return (
    <Card
      className={clsx(
        'p-4 bg-white border rounded-2xl transition-all duration-200 space-y-3.5 relative select-none',
        isSelected
          ? 'border-[#002568] ring-2 ring-[#002568]/40 shadow-md bg-sky-50/20'
          : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md'
      )}
    >
      {/* 1. Header: Checkbox de selecció + Badges d'Estat i Dorsal */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggleSelect}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-black transition-all cursor-pointer',
            isSelected
              ? 'bg-[#061338] text-white shadow-2xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          )}
        >
          {isSelected ? (
            <CheckSquare className="w-3.5 h-3.5 text-[#ff6600]" />
          ) : (
            <Square className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>{isSelected ? 'Seleccionat' : 'Triar'}</span>
        </button>

        <div className="flex items-center gap-1.5">
          <Badge status={player.status} />
          <JerseyBadge number={player.jersey_number} size="sm" variant="kit" color="blue" />
        </div>
      </div>

      {/* 2. Dades del Jugador: Foto, Nom, Equip i Posició */}
      <div className="flex items-start gap-3">
        <Link to={`/jugadores/${player.id}`} className="shrink-0 group">
          <PlayerPhoto
            src={player.photo_url}
            alt={player.full_name}
            firstName={player.first_name}
            lastName={player.last_name}
            imgClassName="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-2xs group-hover:ring-2 group-hover:ring-[#ff6600] transition-all bg-slate-100"
            fallbackClassName="w-14 h-14 rounded-2xl bg-[#002568] text-white flex items-center justify-center font-black text-base uppercase shadow-2xs group-hover:ring-2 group-hover:ring-[#ff6600] transition-all"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to={`/jugadores/${player.id}`}
            className="text-sm font-black text-[#061338] hover:text-[#002568] uppercase tracking-wide truncate block transition-colors"
          >
            {player.full_name}
          </Link>

          {/* Club / Equip */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mt-0.5 truncate">
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
              <Shield className="w-3.5 h-3.5 text-[#ff6600]" />
            )}
            <span className="truncate">{player.team?.name || 'Sense equip'}</span>
          </div>

          {/* Posicions: Principal i Secundària */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-sky-50 text-[#002568] border border-sky-200">
              {currentPos}
            </span>
            {player.secondary_position && player.secondary_position !== 'Sense definir' && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                Alt: {player.secondary_position}
              </span>
            )}
            {player.infantil_year && (
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {player.infantil_year === 'Infantil 2º año' ? '2n Any' : player.infantil_year === 'Infantil 1er año' ? '1r Any' : player.infantil_year}
              </span>
            )}
            <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-flex items-center gap-1">
              <span>{player.age ? `${player.age} anys` : '13 anys'}</span>
              {player.birth_year && (
                <span className="text-[#002568] font-black font-mono">({player.birth_year})</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Valoració de 1 a 5 Estrelles Interactiva ⭐ */}
      <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block">
            Valoració Tècnica:
          </span>
          <span className="text-[11px] font-black text-slate-800">
            {player.rating ? `${player.rating} / 5 estrelles` : 'Sense valorar'}
          </span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <StarRating
            rating={player.rating || 0}
            onChange={onRatingChange}
            size="md"
          />
        </div>
      </div>

      {/* 4. Footer: Estadístiques FFCV + Enllaç a Perfil */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span>Partits: <strong className="text-slate-900 font-bold">{stats.matches}</strong></span>
          <span>Gols: <strong className="text-[#ff6600] font-black">{stats.goals}</strong></span>
        </div>

        <Link
          to={`/jugadores/${player.id}`}
          className="text-[11px] font-black uppercase text-[#061338] hover:text-[#002568] flex items-center gap-0.5 hover:underline"
        >
          <span>Fitxa</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </Card>
  );
};
