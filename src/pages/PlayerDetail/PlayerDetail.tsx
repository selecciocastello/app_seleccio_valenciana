import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowLeft,
  ShieldAlert,
  Dumbbell,
  FileSpreadsheet,
  History,
  Activity,
  Edit,
  Database,
  MapPin,
  CheckCircle2,
  Award,
  CalendarCheck,
  Shield,
  Users,
  Flame,
  TrendingUp,
  BarChart3,
  ExternalLink,
  Phone,
  Mail,
  FileText,
  Save,
  MessageCircle,
  UserCheck
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { CustomSelect } from '../../components/ui/Select';
import { useAppStore } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';
import { JerseyBadge } from '../../components/ui/JerseyBadge';
import { PLAYER_POSITIONS } from '../../types/models';

export const PlayerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { players, updatePlayer, callups, reports } = useAppStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<
    'resumen' | 'datos' | 'convocatorias' | 'entrenamientos' | 'informes' | 'historico'
  >('resumen');

  const player = players.find((p) => p.id === id) || players[0];

  // Local state for editable fields
  const [positionInput, setPositionInput] = useState(player?.position || '');
  const [dominantFootInput, setDominantFootInput] = useState(player?.dominant_foot || 'Diestro');
  const [phoneInput, setPhoneInput] = useState(player?.phone || '');
  const [emailInput, setEmailInput] = useState(player?.email || '');
  const [guardianNameInput, setGuardianNameInput] = useState(player?.guardian_name || '');
  const [guardianPhoneInput, setGuardianPhoneInput] = useState(player?.guardian_phone || '');
  const [guardianEmailInput, setGuardianEmailInput] = useState(player?.guardian_email || '');
  const [notesInput, setNotesInput] = useState(player?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (player) {
      setPositionInput(player.position && player.position !== 'Candidato' ? player.position : '');
      setDominantFootInput(player.dominant_foot || 'Diestro');
      setPhoneInput(player.phone || '');
      setEmailInput(player.email || '');
      setGuardianNameInput(player.guardian_name || '');
      setGuardianPhoneInput(player.guardian_phone || '');
      setGuardianEmailInput(player.guardian_email || '');
      setNotesInput(player.notes || '');
    }
  }, [player]);

  if (!player) {
    return (
      <div className="space-y-6 animate-fade-in p-6">
        <Link
          to="/jugadores"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#061338] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Tornar al llistat de jugadors
        </Link>
        <Card className="p-8 text-center bg-white border border-slate-200">
          <p className="text-slate-600 font-bold">No s'ha trobat el jugador seleccionat.</p>
        </Card>
      </div>
    );
  }

  const handleStatusChange = (newStatus: string) => {
    updatePlayer(player.id, { status: newStatus as any });
    showToast(`Estat actualitzat a "${newStatus}"`, 'success');
  };

  const handlePositionChange = (newPosition: string) => {
    const finalPos = newPosition === 'Sense definir' ? '' : newPosition;
    setPositionInput(finalPos);
    updatePlayer(player.id, { position: finalPos });
    showToast(`Posició actualitzada a "${newPosition}"`, 'success');
  };

  const handleSaveContactAndNotes = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    updatePlayer(player.id, {
      position: positionInput === 'Sense definir' ? '' : positionInput,
      dominant_foot: dominantFootInput as any,
      phone: phoneInput || undefined,
      email: emailInput || undefined,
      guardian_name: guardianNameInput || undefined,
      guardian_phone: guardianPhoneInput || undefined,
      guardian_email: guardianEmailInput || undefined,
      notes: notesInput || undefined
    });

    setTimeout(() => {
      setIsSaving(false);
      showToast('Dades de contacte, posició i comentaris guardats correctament', 'success');
    }, 200);
  };

  const handleQuickSaveNotes = () => {
    updatePlayer(player.id, { notes: notesInput });
    showToast('Comentaris tècnics guardats correctament', 'success');
  };

  // Helper per extreure estadístiques oficials del scraping FFCV
  const getStat = (keys: string[], fallback = '0'): string => {
    if (!player.sports_data) return fallback;
    const sd = player.sports_data as Record<string, any>;
    for (const k of keys) {
      if (sd[k] !== undefined && sd[k] !== null && String(sd[k]).trim() !== '') {
        return String(sd[k]);
      }
    }
    return fallback;
  };

  const convocats = getStat(['Convocados', 'convocados', 'Convocats', 'convocats']);
  const titular = getStat(['Titular', 'titular', 'Titulares', 'titulares']);
  const suplent = getStat(['Suplente', 'suplente', 'Suplents', 'suplents']);
  const jugats = getStat(['Jugados', 'jugados', 'Jugats', 'jugats', 'matches_played']);
  const gols = getStat(['Goles', 'goles', 'Gols', 'gols', 'goals']);
  const mediaGols = getStat(['Media goles/partido', 'media_goles', 'Media goles', 'Mitjana gols'], '0.00');
  const grogues = getStat(['Amarillas', 'amarillas', 'Grogues', 'grogues', 'yellow_cards']);
  const dobleGroga = getStat(['Doble amarilla', 'doble_amarilla', 'Doble groga']);
  const vermelles = getStat(['Rojas', 'rojas', 'Vermelles', 'vermelles', 'red_cards']);
  const targetaVerda = getStat(['Tarjeta verde', 'tarjeta_verde', 'Targeta verda']);

  const normalizePosition = (pos?: string | null) => {
    if (!pos || pos === 'Candidato' || pos === 'Sense definir') return 'Sense definir';
    const match = PLAYER_POSITIONS.find((p) => p.toLowerCase() === pos.trim().toLowerCase());
    return match || pos;
  };

  const currentPosition = normalizePosition(player.position);

  const prevSeason = (player.history || []).find((h) => {
    const t = (h.temporada || '').replace(/\s+/g, '');
    return t.includes('2025-2026') || t.includes('25-26');
  });

  // Informes relacionados con el jugador
  const playerReports = reports.filter((r) => r.player_id === player.id || r.player?.id === player.id);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Botón Volver */}
      <div>
        <Link
          to="/jugadores"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#061338] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#ff6600]" />
          <span>Tornar al llistat de jugadors</span>
        </Link>
      </div>

      {/* Profile Header Card */}
      <Card className="relative overflow-hidden bg-gradient-to-r from-[#061338] via-[#002568] to-[#003db3] text-white p-6 sm:p-8 border border-blue-900 shadow-xl" gradient>
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-5 text-center sm:text-left">
            {/* Foto del Jugador - Neta i sense solapaments */}
            <div className="relative shrink-0">
              {player.photo_url ? (
                <img
                  src={player.photo_url}
                  alt={player.full_name}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-white/20 shadow-2xl bg-white/10"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#ff6600] border-2 border-white/20 flex items-center justify-center font-black text-3xl text-white shadow-2xl">
                  {player.first_name?.[0] || 'J'}
                  {player.last_name?.[0] || 'P'}
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                {player.jersey_number && (
                  <JerseyBadge
                    number={player.jersey_number}
                    size="sm"
                    variant="kit"
                    color="blue"
                  />
                )}
                <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wide">
                  {player.full_name}
                </h1>
                <Badge status={player.status} />
                {player.infantil_year && (
                  <span
                    className={clsx(
                      "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm",
                      player.infantil_year === 'Infantil 1er año' && "bg-sky-400/20 text-sky-200 border-sky-300/40",
                      player.infantil_year === 'Infantil 2º año' && "bg-emerald-400/20 text-emerald-200 border-emerald-300/40",
                      player.infantil_year === 'Desconocido' && "bg-slate-700/60 text-slate-200 border-slate-600"
                    )}
                  >
                    {player.infantil_year}
                  </span>
                )}
                {player.age && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-white border border-white/20">
                    {player.age} anys
                  </span>
                )}
              </div>

              <div className="text-sm font-bold text-sky-200 mt-2 flex items-center justify-center sm:justify-start flex-wrap gap-2">
                <span className="bg-sky-500/20 px-2.5 py-0.5 rounded-md border border-sky-400/30 text-white font-extrabold">
                  {currentPosition}
                </span>
                <span className="text-white/40">•</span>
                <div className="inline-flex items-center gap-1.5">
                  {player.team?.crest_url && (
                    <img
                      src={player.team.crest_url}
                      alt={player.team.name}
                      className="w-4 h-4 object-contain inline-block"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <span>{player.team?.name || 'Sense equip assignat'}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-200 mt-2.5">
                <JerseyBadge
                  number={player.jersey_number}
                  size="xs"
                  variant="pill"
                  color="white"
                />
                <span>•</span>
                <span className="font-semibold">Peu: {player.dominant_foot || 'Diestro'}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-amber-300" /> {player.city || 'Castelló'}
                </span>
              </div>
            </div>
          </div>

          {/* Selectores Rápidos de Posición y Estado */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Selector de Posición */}
            <div className="flex-1 sm:min-w-[170px]">
              <span className="block text-[10px] text-sky-200 uppercase font-black tracking-wider mb-1">
                Posició al Camp
              </span>
              <CustomSelect
                theme="dark"
                value={currentPosition}
                onChange={handlePositionChange}
                options={[
                  { value: 'Sense definir', label: 'Sense definir' },
                  ...PLAYER_POSITIONS.map((pos) => ({ value: pos, label: pos })),
                ]}
              />
            </div>

            {/* Selector de Estado */}
            <div className="flex-1 sm:min-w-[180px]">
              <span className="block text-[10px] text-sky-200 uppercase font-black tracking-wider mb-1">
                Estat Selecció
              </span>
              <CustomSelect
                theme="dark"
                value={player.status}
                onChange={handleStatusChange}
                options={[
                  { value: 'Candidato', label: 'Estat: Candidat' },
                  { value: 'Observado', label: 'Estat: Observat' },
                  { value: 'Preseleccionado', label: 'Estat: Preseleccionat' },
                  { value: 'Seleccionado', label: 'Estat: Seleccionat' },
                  { value: 'Lesionado', label: 'Estat: Lesionat' },
                  { value: 'No seleccionado', label: 'Estat: No seleccionat' },
                ]}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Pestañas de Navegación */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-1 custom-scrollbar">
        {[
          { id: 'resumen', label: 'Resum & Seguiment', icon: Activity },
          { id: 'datos', label: 'Dades & Contacte', icon: Edit },
          { id: 'convocatorias', label: 'Convocatòries', icon: ShieldAlert },
          { id: 'entrenamientos', label: 'Entrenaments', icon: Dumbbell },
          { id: 'informes', label: 'Informes Tècnics', icon: FileSpreadsheet },
          { id: 'historico', label: 'Històric FFCV', icon: History }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                isActive
                  ? "bg-[#061338] text-white shadow-sm border-t-2 border-[#ff6600]"
                  : "text-slate-600 hover:text-[#061338] hover:bg-slate-200/60 font-bold"
              )}
            >
              <Icon className={clsx("w-4 h-4", isActive ? "text-[#ff6600]" : "text-slate-500")} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. RESUMEN TAB */}
      {/* ========================================================================= */}
      {activeTab === 'resumen' && (
        <div className="space-y-6">
          {/* Bloc de Contacte Ràpid i Notes del Seleccionador */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Notes del Seleccionador */}
            <Card className="p-6 space-y-4 bg-white border border-slate-200 lg:col-span-2 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#ff6600]" />
                  <h3 className="text-base font-black text-[#061338] uppercase tracking-wider">
                    Comentaris i Notes de Seguiment del Jugador
                  </h3>
                </div>
                <button
                  onClick={handleQuickSaveNotes}
                  className="px-3.5 py-1.5 bg-[#061338] hover:bg-[#002568] text-white text-xs font-bold rounded-full flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Save className="w-3.5 h-3.5 text-[#ff6600]" />
                  <span>Desar Notes</span>
                </button>
              </div>

              <div>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  rows={4}
                  placeholder="Escriu ací les observacions tècniques, punts forts, caràcter competitiu, seguiment de partits o recomanacions per a futures convocatòries..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#002568] focus:bg-white transition-all font-medium leading-relaxed"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Aquestes notes queden guardades al perfil oficial del jugador per a consulta de tots els seleccionadors.
                </p>
              </div>
            </Card>

            {/* Targeta de Contacte Ràpid */}
            <Card className="p-6 space-y-4 bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-black text-[#061338] uppercase tracking-wider">
                    Contacte
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab('datos')}
                  className="text-xs font-bold text-[#ff6600] hover:underline flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* Telèfon Jugador */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Telèfon Jugador</span>
                    <span className="font-bold text-slate-800">{player.phone || 'Sense telèfon'}</span>
                  </div>
                  {player.phone && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${player.phone}`}
                        className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                        title="Trucar"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={`https://wa.me/34${player.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
                        title="WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Email Jugador */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Email Jugador</span>
                    <span className="font-bold text-slate-800 truncate block">{player.email || 'Sense email'}</span>
                  </div>
                  {player.email && (
                    <a
                      href={`mailto:${player.email}`}
                      className="p-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors"
                      title="Enviar Email"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Tutor / Família */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Tutor / Família ({player.guardian_name || 'Tutor'})
                    </span>
                    <span className="font-bold text-slate-800">{player.guardian_phone || 'Sense telèfon'}</span>
                  </div>
                  {player.guardian_phone && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${player.guardian_phone}`}
                        className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                        title="Trucar al Tutor"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={`https://wa.me/34${player.guardian_phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
                        title="WhatsApp al Tutor"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Bloc d'Estadístiques Oficials FFCV (10 mètriques) */}
          <Card className="p-6 space-y-5 bg-white border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#ff6600]" />
                <h3 className="text-base font-black text-[#061338] uppercase tracking-wider">
                  Estadístiques Oficials FFCV
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
                Temporada 2026-2027
              </span>
            </div>

            {/* Graella de 10 Targetes de Mètriques Oficials */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* 1. Convocats */}
              <div className="bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Convocats</span>
                  <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900">{convocats}</span>
                  <span className="text-[10px] text-slate-400 block font-medium mt-0.5">partits en llista</span>
                </div>
              </div>

              {/* 2. Titular */}
              <div className="bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Titular</span>
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900">{titular}</span>
                  <span className="text-[10px] text-slate-400 block font-medium mt-0.5">en l'onze titular</span>
                </div>
              </div>

              {/* 3. Suplent */}
              <div className="bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Suplent</span>
                  <div className="w-7 h-7 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900">{suplent}</span>
                  <span className="text-[10px] text-slate-400 block font-medium mt-0.5">des de la banqueta</span>
                </div>
              </div>

              {/* 4. Jugats */}
              <div className="bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Jugats</span>
                  <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-emerald-700">{jugats}</span>
                  <span className="text-[10px] text-emerald-600/80 block font-medium mt-0.5">partits disputats</span>
                </div>
              </div>

              {/* 5. Gols */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50/50 border border-orange-200/80 hover:border-orange-300 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-orange-700 tracking-wider">Gols</span>
                  <div className="w-7 h-7 rounded-xl bg-[#ff6600] text-white flex items-center justify-center shadow-sm">
                    <Flame className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-[#ff6600]">{gols}</span>
                  <span className="text-[10px] text-orange-600/80 block font-medium mt-0.5">gols oficials</span>
                </div>
              </div>

              {/* 6. Media goles/partido */}
              <div className="bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Gols/Partit</span>
                  <div className="w-7 h-7 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900">{mediaGols}</span>
                  <span className="text-[10px] text-slate-400 block font-medium mt-0.5">mitjana golejadora</span>
                </div>
              </div>

              {/* 7. Amarillas */}
              <div className="bg-amber-50/40 border border-amber-200/80 hover:border-amber-300 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Grogues</span>
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] shadow-sm">
                    🟨
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-amber-700">{grogues}</span>
                  <span className="text-[10px] text-amber-600/80 block font-medium mt-0.5">amonestacions</span>
                </div>
              </div>

              {/* 8. Doble amarilla */}
              <div className="bg-amber-50/40 border border-amber-200/80 hover:border-amber-300 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Doble Groga</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-white font-black text-[10px] shadow-sm">
                    🟨🟨
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-amber-800">{dobleGroga}</span>
                  <span className="text-[10px] text-amber-600/80 block font-medium mt-0.5">expulsió 2x groga</span>
                </div>
              </div>

              {/* 9. Rojas */}
              <div className="bg-rose-50/40 border border-rose-200/80 hover:border-rose-300 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-rose-800 tracking-wider">Rojes</span>
                  <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-black text-[10px] shadow-sm">
                    🟥
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-rose-600">{vermelles}</span>
                  <span className="text-[10px] text-rose-500/80 block font-medium mt-0.5">roja directa</span>
                </div>
              </div>

              {/* 10. Tarjeta verde */}
              <div className="bg-emerald-50/40 border border-emerald-200/80 hover:border-emerald-300 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Targeta Verda</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-white font-black text-[10px] shadow-sm">
                    🟩
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-emerald-700">{targetaVerda}</span>
                  <span className="text-[10px] text-emerald-600/80 block font-medium mt-0.5">premi Fair Play</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Dues columnes: Perfil Tècnic + Metadades Oficials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Informació Tècnica Ràpida */}
            <Card className="p-6 space-y-4 bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Edit className="w-5 h-5 text-[#ff6600]" />
                <h4 className="text-base font-black text-[#061338] uppercase tracking-wider">
                  Perfil Tècnic del Candidat
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-500 block font-semibold">Club Actual:</span>
                    <span className="text-slate-900 font-bold mt-0.5 block">{player.team?.name || 'Sense equip'}</span>
                  </div>
                  {player.team?.crest_url && (
                    <img
                      src={player.team.crest_url}
                      alt={player.team.name}
                      className="w-7 h-7 object-contain shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block font-semibold">Classificació Infantil:</span>
                  <span className="text-slate-900 font-bold mt-0.5 block">{player.infantil_year || 'Infantil'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block font-semibold">Posició:</span>
                  <span className="text-slate-900 font-black mt-0.5 block">{currentPosition}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block font-semibold">Peu Dominant:</span>
                  <span className="text-slate-900 font-bold mt-0.5 block">{player.dominant_foot || 'Diestro'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block font-semibold">Població:</span>
                  <span className="text-slate-900 font-bold mt-0.5 block">{player.city || 'Castelló'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 block font-semibold">Dorsal:</span>
                    <span className="text-slate-900 font-bold mt-0.5 block">
                      {player.jersey_number ? `Samarreta #${player.jersey_number}` : 'Sense dorsal'}
                    </span>
                  </div>
                  <JerseyBadge number={player.jersey_number} size="sm" variant="kit" color="blue" />
                </div>
              </div>
            </Card>

            {/* Metadades del Scraping */}
            <Card className="p-6 space-y-4 bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Database className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-black text-[#061338] uppercase tracking-wider">
                  Metadades FFCV
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Font de Dades:</span>
                  <span className="text-slate-900 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    {player.source === 'ffcv_scraping' ? 'Scraping Oficial FFCV' : player.source}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">ID Jugador FFCV:</span>
                  <span className="text-slate-900 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded">
                    {player.source_player_id || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Edició Manual:</span>
                  <span className={clsx("font-bold", player.is_manual_override ? "text-[#ff6600]" : "text-slate-700")}>
                    {player.is_manual_override ? 'Sí (Protegit)' : 'No (Automàtic)'}
                  </span>
                </div>
                {player.source_url && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-semibold">Fitxa Web FFCV:</span>
                    <a
                      href={player.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 hover:text-sky-800 font-bold inline-flex items-center gap-1"
                    >
                      <span>Veure fitxa</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {player.scraped_at && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-semibold">Darrera Sincro:</span>
                    <span className="text-slate-700 font-semibold">{new Date(player.scraped_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2.5">
                  <Award className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-sky-900 font-medium leading-relaxed">
                    Dades sincronitzades amb el registre oficial de llicències de la Federació de Futbol de la Comunitat Valenciana.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DADES ESPORTIVES & CONTACTE TAB */}
      {/* ========================================================================= */}
      {activeTab === 'datos' && (
        <form onSubmit={handleSaveContactAndNotes} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Edició de Fitxa Tècnica i Posició */}
            <Card className="p-6 space-y-4 bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Edit className="w-5 h-5 text-[#ff6600]" />
                <h3 className="text-base font-black text-[#061338] uppercase tracking-wider">
                  Fitxa Tècnica i Demarcació
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <CustomSelect
                    label="Posició Principal al Camp *"
                    value={positionInput || 'Sense definir'}
                    onChange={(val) => setPositionInput(val === 'Sense definir' ? '' : val)}
                    options={[
                      { value: 'Sense definir', label: 'Sense definir' },
                      ...PLAYER_POSITIONS.map((pos) => ({ value: pos, label: pos })),
                    ]}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <CustomSelect
                      label="Peu Preferent"
                      value={dominantFootInput}
                      onChange={(val) => setDominantFootInput(val as any)}
                      options={[
                        { value: 'Diestro', label: 'Diestro' },
                        { value: 'Zurdo', label: 'Zurdo' },
                        { value: 'Ambidextro', label: 'Ambidextro' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Club / Equip
                    </label>
                    <input
                      type="text"
                      disabled
                      value={player.team?.name || 'Sense equip'}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600 font-semibold cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Any Infantil
                    </label>
                    <input
                      type="text"
                      disabled
                      value={player.infantil_year || 'Infantil'}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600 font-semibold cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Edat
                    </label>
                    <input
                      type="text"
                      disabled
                      value={player.age ? `${player.age} anys` : 'N/A'}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600 font-semibold cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Dades de Contacte */}
            <Card className="p-6 space-y-4 bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Phone className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-[#061338] uppercase tracking-wider">
                  Dades de Contacte i Família
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Telèfon Jugador
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="Ex: 600 123 456"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#002568]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Email Jugador
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="Ex: jugador@email.com"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#002568]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                    Nom Mare / Pare / Tutor
                  </label>
                  <div className="relative">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={guardianNameInput}
                      onChange={(e) => setGuardianNameInput(e.target.value)}
                      placeholder="Ex: Joan Ribes (Pare)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#002568]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Telèfon Tutor / Família
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={guardianPhoneInput}
                        onChange={(e) => setGuardianPhoneInput(e.target.value)}
                        placeholder="Ex: 611 987 654"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#002568]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                      Email Tutor / Família
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={guardianEmailInput}
                        onChange={(e) => setGuardianEmailInput(e.target.value)}
                        placeholder="Ex: familia@email.com"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#002568]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Notes i Comentaris */}
          <Card className="p-6 space-y-4 bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="w-5 h-5 text-[#ff6600]" />
              <h3 className="text-base font-black text-[#061338] uppercase tracking-wider">
                Comentaris i Notes del Cos Tècnic
              </h3>
            </div>

            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              rows={4}
              placeholder="Observacions detallades sobre l'evolució, aspectes tècnics o tàctics a millorar, comportament i recomanacions per al cos de seleccionadors..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#002568] focus:bg-white transition-all font-medium leading-relaxed"
            />

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#ff6600] hover:bg-orange-600 text-white font-black uppercase tracking-wider text-xs rounded-full shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Guardant...' : 'Guardar Canvis del Perfil'}</span>
              </button>
            </div>
          </Card>
        </form>
      )}

      {/* ========================================================================= */}
      {/* 3. CONVOCATORIAS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'convocatorias' && (
        <Card className="p-6 space-y-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-[#061338] uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#ff6600]" />
              <span>Historial de Convocatòries de la Selecció</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">
              {callups.length > 0 ? `${callups.length} convocatòries registrades` : 'Sense convocatòries actives'}
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Convocat
                  </span>
                  <span className="text-xs font-bold text-slate-500">15/10/2026 • 17:30h</span>
                </div>
                <h4 className="text-sm font-black text-[#061338]">I Convocatòria Selecció Territorial Infantil</h4>
                <p className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Camp Municipal Gaetà Huguet (Castelló)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-black text-emerald-800">Assistència Confirmada</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 4. ENTRENAMENTS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'entrenamientos' && (
        <Card className="p-6 space-y-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-[#061338] uppercase tracking-wider flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-[#ff6600]" />
              <span>Sessions d'Entrenament de la Selecció</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">Temporada 2026/2027</span>
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-300">
                    Sessió Físic-Tàctica
                  </span>
                  <span className="text-xs font-bold text-slate-500">22/10/2026 • 18:00h - 19:30h</span>
                </div>
                <h4 className="text-sm font-black text-[#061338]">Entrenament de Preparació Provincial</h4>
                <p className="text-xs font-semibold text-slate-600">
                  Objectiu: Sortida de pilota i pressió alta en bloc mitjà.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-800">Completat (Rendiment 9/10)</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 5. INFORMES TÈCNICS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'informes' && (
        <div className="space-y-4">
          <Card className="p-6 space-y-4 bg-white border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-[#061338] uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#ff6600]" />
                <span>Informes de Seguiment i Scouting</span>
              </h3>
              <Badge variant="gold">Avaluació FFCV</Badge>
            </div>

            {playerReports.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-slate-600 font-bold text-sm">
                  Informe tècnic inicial registrat pel cos tècnic de la Selecció.
                </p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-3 mt-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Tècnica</span>
                      <span className="text-base font-black text-amber-600">8.5 / 10</span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Tàctica</span>
                      <span className="text-base font-black text-emerald-600">8.0 / 10</span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Física</span>
                      <span className="text-base font-black text-sky-600">7.5 / 10</span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Actitud</span>
                      <span className="text-base font-black text-purple-600">9.0 / 10</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    <strong className="text-slate-900 font-bold">Observacions de l'equip de selecció:</strong> Jugador amb gran visió de joc i capacitat d'associació en curt. Molt bona actitud en tasques defensives i recuperació de pilota.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {playerReports.map((report) => (
                  <div key={report.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs text-slate-500 font-semibold">{report.report_date}</span>
                        <h4 className="text-sm font-black text-[#061338]">Informe de Seguiment Tècnic</h4>
                      </div>
                      <Badge variant="gold">{report.recommendation}</Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Tècnica</span>
                        <span className="text-sm font-black text-amber-600">{report.scores?.TECNICA || 8}/10</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Tàctica</span>
                        <span className="text-sm font-black text-emerald-600">{report.scores?.TACTICA || 7}/10</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Física</span>
                        <span className="text-sm font-black text-sky-600">{report.scores?.FISICA || 8}/10</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Actitud</span>
                        <span className="text-sm font-black text-purple-600">{report.scores?.ACTITUD || 9}/10</span>
                      </div>
                    </div>

                    {report.technical_summary && (
                      <p className="text-xs text-slate-700 font-medium">
                        <strong className="text-slate-900 font-bold">Resum:</strong> {report.technical_summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. HISTÒRIC TAB (FFCV OFICIAL) */}
      {/* ========================================================================= */}
      {activeTab === 'historico' && (
        <div className="space-y-6">
          {/* Card Historial FFCV Oficial */}
          <Card className="p-6 md:p-8 space-y-6 bg-white border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#ff6600] flex items-center justify-center font-black shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#061338] uppercase tracking-wider">
                    Historial de Temporades (FFCV)
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    Trajectòria esportiva oficial extreta de la Federació de Futbol de la Comunitat Valenciana
                  </p>
                </div>
              </div>

              {player.infantil_year && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-bold text-slate-500">Classificació:</span>
                  <span
                    className={clsx(
                      "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm",
                      player.infantil_year === 'Infantil 1er año' && "bg-sky-50 text-sky-800 border-sky-300",
                      player.infantil_year === 'Infantil 2º año' && "bg-emerald-50 text-emerald-800 border-emerald-300",
                      player.infantil_year === 'Desconocido' && "bg-slate-100 text-slate-700 border-slate-300"
                    )}
                  >
                    {player.infantil_year}
                  </span>
                </div>
              )}
            </div>

            {/* Banner de explicació d'any infantil (Alt Contrast i Llegibilitat Total) */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200/90 rounded-2xl flex items-start gap-3.5 shadow-sm">
              <Award className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1.5">
                <p className="font-black text-blue-950 uppercase tracking-wide">
                  Criteri d'Assignació d'Any Infantil:
                </p>
                <p className="text-slate-700 font-medium leading-relaxed">
                  {prevSeason ? (
                    <>
                      A la temporada anterior (<strong className="text-blue-950 font-black">2025-2026</strong>) va militar a <strong className="text-blue-950 font-bold">{prevSeason.equipo}</strong> en la categoria <strong className="text-blue-950 font-bold">{prevSeason.categoria}</strong>.{' '}
                      {player.infantil_year === 'Infantil 1er año'
                        ? 'En haver competit com a Aleví 2n any a la 25/26, li correspon la categoria d\'Infantil de 1er any per a la 26/27.'
                        : (player.infantil_year === 'Infantil 2º año'
                          ? 'En haver competit ja en categoria Infantil a la 25/26, li correspon la categoria d\'Infantil de 2n any per a la 26/27.'
                          : 'Determinació basada en el registre federatiu oficial.')}
                    </>
                  ) : (
                    'No consta registre federatiu de la temporada 2025-2026 per a aquest jugador en el seu historial, per la qual cosa es classifica com a Desconegut.'
                  )}
                </p>
              </div>
            </div>

            {/* Taula de Trajectòria Oficial FFCV (Colors Nítids i Alt Contrast) */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#061338] text-white font-black uppercase text-xs tracking-wider border-b border-slate-200">
                    <th className="p-4">Temporada</th>
                    <th className="p-4 text-center">Escut</th>
                    <th className="p-4">Equip</th>
                    <th className="p-4">Categoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(!player.history || player.history.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 font-bold bg-slate-50">
                        Sense historial de temporades registrat.
                      </td>
                    </tr>
                  ) : (
                    player.history.map((h, idx) => {
                      const isTargetPrevSeason = (h.temporada || '').includes('2025-2026');
                      return (
                        <tr
                          key={idx}
                          className={clsx(
                            "transition-colors",
                            isTargetPrevSeason
                              ? "bg-sky-50/80 hover:bg-sky-100/80 font-bold"
                              : "hover:bg-slate-50 bg-white"
                          )}
                        >
                          <td className="p-4 text-slate-900 font-black">
                            <div className="flex items-center gap-2">
                              <span>{h.temporada}</span>
                              {isTargetPrevSeason && (
                                <span className="text-[10px] font-black bg-sky-200/80 text-sky-900 px-2 py-0.5 rounded-full border border-sky-300">
                                  Anterior (25/26)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            {h.escudo_url ? (
                              <img
                                src={h.escudo_url}
                                alt={h.equipo}
                                className="w-8 h-8 mx-auto object-contain drop-shadow-sm"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <span className="text-slate-400 font-bold">—</span>
                            )}
                          </td>
                          <td className="p-4 text-slate-900 font-bold text-xs">
                            {h.equipo}
                          </td>
                          <td className="p-4 text-slate-700 font-semibold text-xs">
                            {h.categoria}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Històric de Convocatòries i Assistència */}
          <Card className="p-6 md:p-8 space-y-4 bg-white border border-slate-200 shadow-sm">
            <h3 className="text-base font-black text-[#061338] uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Històric de Convocatòries i Assistència</span>
            </h3>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="space-y-1">
                  <span className="text-xs font-black text-[#ff6600]">15/10/2026 • Infantil Castelló</span>
                  <h4 className="text-sm font-black text-[#061338]">I Convocatòria Selecció Castelló</h4>
                  <p className="text-xs font-semibold text-slate-500">Seleccionador: Víctor Zandalinas</p>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                    Va Assistir
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
