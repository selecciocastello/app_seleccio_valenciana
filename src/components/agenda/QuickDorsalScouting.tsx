import React, { useState, useEffect, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Star,
  CheckCircle2,
  UserPlus,
  UserCheck,
  Shield,
  RotateCcw,
  Volume2,
  Check,
  Search,
  Hash,
  Clock,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { useAppStore, dorsalScoutKey } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { StarRating } from '../ui/StarRating';
import { JerseyBadge } from '../ui/JerseyBadge';
import { AudioNotePlayer } from '../ui/AudioNotePlayer';
import { saveVoiceNote, getVoiceNotesForPlayer } from '../../utils/audioStorage';
import type { DorsalScoutItem, Player, PlayerStatus, ScoutingAgendaItem } from '../../types/models';

interface QuickDorsalScoutingProps {
  agendaItem: ScoutingAgendaItem;
  homePlayers: Player[];
  awayPlayers: Player[];
  onPlayerSaved?: (player: Player) => void;
}

// 'dorsal': l'analista no coneix el jugador i el valora pel dorsal; després del partit
// scripts/process_observed_matches.cjs mira l'acta de la FFCV i ho passa al jugador que el portava.
// 'player': l'analista coneix el jugador i el tria de la plantilla; es guarda directament a la seua fitxa.
type ScoutMode = 'dorsal' | 'player';

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const QuickDorsalScouting: React.FC<QuickDorsalScoutingProps> = ({
  agendaItem,
  homePlayers,
  awayPlayers,
  onPlayerSaved
}) => {
  const { updatePlayer, agenda, addDorsalScoutToAgenda, removeDorsalScoutFromAgenda } = useAppStore();
  const { showToast } = useToast();

  // 1. Equip seleccionat: Local ('home') o Visitant ('away')
  const [selectedTeamSide, setSelectedTeamSide] = useState<'home' | 'away'>('home');

  // 2. Com s'identifica el jugador: pel dorsal (no el conec) o triant-lo (el conec)
  const [mode, setMode] = useState<ScoutMode>('dorsal');
  const [dorsalInput, setDorsalInput] = useState<string>('');
  const [heardName, setHeardName] = useState<string>('');
  const [playerSearch, setPlayerSearch] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // 3. Camps del formulari de valoració (status null = no canviar l'estat del jugador)
  const [status, setStatus] = useState<PlayerStatus | null>('Interesante');
  const [rating, setRating] = useState<number>(3); // Per defecte 3 estrelles (Interessant)
  const [comment, setComment] = useState<string>('');

  // 4. Nota de veu prèvia existent del jugador triat
  const [existingAudioUrl, setExistingAudioUrl] = useState<string | null>(null);

  // Hook de gravació de veu
  const {
    isRecording,
    recordingTime,
    audioUrl,
    audioBase64,
    transcript,
    error: micError,
    startRecording,
    stopRecording,
    resetRecording
  } = useVoiceRecorder('ca-ES');

  // Actualitza el camp de comentari automàticament a mesura que es transcriu la veu
  useEffect(() => {
    if (transcript) setComment(transcript);
  }, [transcript]);

  // L'item de la prop és una còpia: les valoracions noves es llegeixen de l'agenda del store
  const liveItem = agenda.find((a) => a.id === agendaItem.id) || agendaItem;
  const matchScouts = liveItem.dorsal_scouts || [];

  const activeTeamName =
    selectedTeamSide === 'home' ? agendaItem.home_team_name : agendaItem.away_team_name;
  const activeTeamPlayers = selectedTeamSide === 'home' ? homePlayers : awayPlayers;

  // Per dorsal: qui el porta segons la plantilla (només orientatiu, el dia del partit pot ser un altre)
  const rosterPlayerWithDorsal = useMemo(() => {
    const num = parseInt(dorsalInput.trim(), 10);
    if (isNaN(num)) return null;
    return activeTeamPlayers.find((p) => p.jersey_number === num) || null;
  }, [dorsalInput, activeTeamPlayers]);

  const selectedPlayer = useMemo(
    () => (selectedPlayerId ? activeTeamPlayers.find((p) => p.id === selectedPlayerId) || null : null),
    [selectedPlayerId, activeTeamPlayers]
  );

  // Plantilla filtrada per nom o dorsal per a triar el jugador
  const searchResults = useMemo(() => {
    const q = normalize(playerSearch);
    return activeTeamPlayers
      .filter(
        (p) =>
          !q ||
          normalize(p.full_name || `${p.first_name} ${p.last_name}`).includes(q) ||
          String(p.jersey_number ?? '') === q
      )
      .sort(
        (a, b) =>
          (a.jersey_number ?? 999) - (b.jersey_number ?? 999) ||
          (a.full_name || '').localeCompare(b.full_name || '')
      );
  }, [playerSearch, activeTeamPlayers]);

  // En triar un jugador es precarrega el seu estat, estrelles i nota de veu
  useEffect(() => {
    if (!selectedPlayer) {
      setExistingAudioUrl(null);
      return;
    }
    setStatus(
      selectedPlayer.status === 'Preseleccionado' || selectedPlayer.status === 'Interesante'
        ? selectedPlayer.status
        : null
    );
    setRating(selectedPlayer.rating || 3);
    setComment('');

    const sportsVoice = (selectedPlayer.sports_data as any)?.voice_note;
    if (sportsVoice?.audioBase64) {
      setExistingAudioUrl(sportsVoice.audioBase64);
    } else {
      getVoiceNotesForPlayer(selectedPlayer.id).then((notes) => {
        const last = notes[notes.length - 1];
        setExistingAudioUrl(last?.audioBase64 || null);
      });
    }
  }, [selectedPlayer]);

  const resetForm = () => {
    setDorsalInput('');
    setHeardName('');
    setPlayerSearch('');
    setSelectedPlayerId(null);
    setComment('');
    setRating(3);
    setStatus('Interesante');
    resetRecording();
    setExistingAudioUrl(null);
  };

  const handleTeamChange = (side: 'home' | 'away') => {
    setSelectedTeamSide(side);
    setSelectedPlayerId(null);
  };

  const handleModeChange = (next: ScoutMode) => {
    setMode(next);
    resetForm();
  };

  // Des del mode dorsal: "és ell" passa a triar el jugador de la plantilla
  const pickRosterPlayer = (player: Player) => {
    setMode('player');
    setDorsalInput('');
    setHeardName('');
    setPlayerSearch('');
    setSelectedPlayerId(player.id);
  };

  const toggleStatus = (value: PlayerStatus) => setStatus((prev) => (prev === value ? null : value));

  // Acció de gravació (iniciar / aturar)
  const handleToggleRecord = async () => {
    if (isRecording) {
      const result = await stopRecording();
      if (result.transcript && !comment) {
        setComment(result.transcript);
      }
      showToast('Nota de veu enregistrada correctament', 'info');
    } else {
      await startRecording();
    }
  };

  const handleClearAudio = () => {
    resetRecording();
    setExistingAudioUrl(null);
  };

  const matchLabel = `${agendaItem.home_team_name} - ${agendaItem.away_team_name}`;

  const handleSave = async () => {
    const now = new Date().toISOString();
    const finalAudioBase64 = audioBase64 || (mode === 'player' ? existingAudioUrl : null);
    const voiceNoteData = finalAudioBase64
      ? {
          audioBase64: finalAudioBase64,
          transcript: comment || transcript,
          duration: recordingTime,
          matchId: agendaItem.match_id,
          date: now
        }
      : undefined;

    if (mode === 'dorsal') {
      const num = parseInt(dorsalInput.trim(), 10);
      if (isNaN(num) || num < 1 || num > 99) {
        showToast('Si us plau, indica un número de dorsal vàlid', 'error');
        return;
      }
      // No es toca cap fitxa: el dorsal de la plantilla pot no ser el del partit.
      // Quan es publique l'acta, el script ho passa al jugador que el portava.
      addDorsalScoutToAgenda(agendaItem.id, {
        identified_by: 'dorsal',
        team_name: activeTeamName,
        side: selectedTeamSide,
        dorsal: num,
        player_name: heardName.trim() || undefined,
        rating,
        status: status || undefined,
        comment: comment.trim(),
        voice_note: voiceNoteData,
        created_at: now
      });
      showToast(`#${num} de ${activeTeamName} valorat: ${rating}⭐. S'assignarà al jugador quan es publique l'acta.`, 'success');
      resetForm();
      return;
    }

    if (!selectedPlayer) {
      showToast('Tria el jugador de la plantilla', 'error');
      return;
    }

    const noteLine = comment.trim() ? `[${matchLabel}] ${comment.trim()}` : '';
    const notes = [selectedPlayer.notes?.trim(), noteLine].filter(Boolean).join('\n\n');

    updatePlayer(selectedPlayer.id, {
      ...(status ? { status } : {}),
      rating,
      notes,
      sports_data: {
        ...(selectedPlayer.sports_data || {}),
        ...(voiceNoteData ? { voice_note: voiceNoteData } : {}),
        match_scout: {
          match_id: agendaItem.match_id,
          agenda_id: agendaItem.id,
          team_name: activeTeamName,
          side: selectedTeamSide,
          dorsal: selectedPlayer.jersey_number,
          rating,
          status,
          notes: comment.trim(),
          created_at: now
        }
      }
    });

    addDorsalScoutToAgenda(agendaItem.id, {
      identified_by: 'player',
      team_name: activeTeamName,
      side: selectedTeamSide,
      dorsal: selectedPlayer.jersey_number ?? undefined,
      player_id: selectedPlayer.id,
      player_name: selectedPlayer.full_name,
      rating,
      status: status || undefined,
      comment: comment.trim(),
      voice_note: voiceNoteData,
      created_at: now
    });

    if (audioBase64) {
      await saveVoiceNote({
        id: `vn_${selectedPlayer.id}_${Date.now()}`,
        playerId: selectedPlayer.id,
        matchId: agendaItem.match_id,
        jerseyNumber: selectedPlayer.jersey_number ?? 0,
        teamName: activeTeamName,
        audioBase64,
        transcript: comment,
        createdAt: now
      });
    }

    showToast(`${selectedPlayer.full_name} valorat: ${rating}⭐${status ? ` (${status})` : ''}`, 'success');
    onPlayerSaved?.(selectedPlayer);
    resetForm();
  };

  const canSave =
    !isRecording && (mode === 'dorsal' ? dorsalInput.trim() !== '' : selectedPlayer !== null);

  const activeAudioSource = audioUrl || (mode === 'player' ? existingAudioUrl : null);

  const scoutState = (s: DorsalScoutItem) => {
    if (s.identified_by === 'player') {
      return { icon: <UserCheck className="w-3 h-3" />, text: 'Guardat a la fitxa', cls: 'text-emerald-300' };
    }
    if (s.status_resolution === 'not_in_acta') {
      return { icon: <AlertTriangle className="w-3 h-3" />, text: "Dorsal no trobat a l'acta", cls: 'text-rose-300' };
    }
    if (s.reconciled) {
      return {
        icon: <CheckCircle2 className="w-3 h-3" />,
        text: `Assignat per l'acta a ${s.reconciled_player_name || 'jugador'}`,
        cls: 'text-emerald-300'
      };
    }
    return { icon: <Clock className="w-3 h-3" />, text: "Pendent de l'acta FFCV", cls: 'text-amber-300' };
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* ── Capçalera del Formulari Ràpid ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff6600] to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-950/30">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>Seguiment per Dorsal i Veu en Directe</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Directe FFCV
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Valora pel dorsal si no el coneixes (es passa al jugador amb l'acta) o tria'l directament si el coneixes
            </p>
          </div>
        </div>

        {(dorsalInput || selectedPlayerId) && (
          <button
            type="button"
            onClick={resetForm}
            className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 self-end sm:self-auto"
          >
            <RotateCcw className="w-3 h-3" /> Netejar
          </button>
        )}
      </div>

      {/* ── PAS 1: SELECCIÓ D'EQUIP (Local vs Visitant) ───────────────────── */}
      <div>
        <label className="text-xs font-bold text-slate-300 block mb-2 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-sky-400" />
          <span>1. Tria l'equip del jugador:</span>
        </label>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => handleTeamChange('home')}
            className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
              selectedTeamSide === 'home'
                ? 'bg-sky-950/60 border-sky-400/80 shadow-md shadow-sky-950/30 ring-1 ring-sky-400/40'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] uppercase shrink-0 ${
                selectedTeamSide === 'home' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              LOC
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-sky-400 block uppercase tracking-wider">
                Equip Local
              </span>
              <p className="text-xs font-black text-white truncate">{agendaItem.home_team_name}</p>
              <span className="text-[10px] text-slate-400">{homePlayers.length} censats</span>
            </div>
            {selectedTeamSide === 'home' && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => handleTeamChange('away')}
            className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
              selectedTeamSide === 'away'
                ? 'bg-[#ff6600]/15 border-orange-500/80 shadow-md shadow-orange-950/30 ring-1 ring-orange-500/40'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] uppercase shrink-0 ${
                selectedTeamSide === 'away' ? 'bg-[#ff6600] text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              VIS
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-orange-400 block uppercase tracking-wider">
                Equip Visitant
              </span>
              <p className="text-xs font-black text-white truncate">{agendaItem.away_team_name}</p>
              <span className="text-[10px] text-slate-400">{awayPlayers.length} censats</span>
            </div>
            {selectedTeamSide === 'away' && <Check className="w-4 h-4 text-orange-400 shrink-0" />}
          </button>
        </div>
      </div>

      {/* ── PAS 2: IDENTIFICAR EL JUGADOR (per dorsal o triant-lo) ────────── */}
      <div>
        <label className="text-xs font-bold text-slate-300 block mb-2">2. Qui és el jugador?</label>

        <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-3">
          <button
            type="button"
            onClick={() => handleModeChange('dorsal')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'dorsal' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>No el conec · per dorsal</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('player')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'player' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>El conec · triar jugador</span>
          </button>
        </div>

        {mode === 'dorsal' ? (
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 sm:w-44 focus-within:border-sky-400">
                <span className="text-xs font-black text-slate-500 uppercase">DORSAL</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="99"
                  placeholder="Ex: 8"
                  value={dorsalInput}
                  onChange={(e) => setDorsalInput(e.target.value)}
                  className="w-full bg-transparent text-lg font-black text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
              <div className="flex-1 flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 focus-within:border-sky-400">
                <UserPlus className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Nom, si l'has sentit (opcional)"
                  value={heardName}
                  onChange={(e) => setHeardName(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {rosterPlayerWithDorsal && (
              <div className="bg-slate-950/90 border border-slate-700 rounded-xl p-2.5 flex items-center gap-3">
                <JerseyBadge
                  number={rosterPlayerWithDorsal.jersey_number}
                  size="sm"
                  variant="kit"
                  color={selectedTeamSide === 'home' ? 'blue' : 'orange'}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-400">A la plantilla, el #{dorsalInput} és:</p>
                  <p className="text-xs font-black text-white truncate">{rosterPlayerWithDorsal.full_name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => pickRosterPlayer(rosterPlayerWithDorsal)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-black bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 shrink-0"
                >
                  Sí, és ell
                </button>
              </div>
            )}

            <p className="text-[11px] text-slate-500">
              Es guarda només amb el dorsal. Quan la FFCV publique l'acta, s'assigna al jugador que el portava en
              este partit (encara que a la plantilla tinga un altre número).
            </p>
          </div>
        ) : selectedPlayer ? (
          <div className="bg-slate-950/90 border border-emerald-500/40 rounded-xl p-2.5 flex items-center gap-3 shadow-sm">
            <JerseyBadge
              number={selectedPlayer.jersey_number}
              size="sm"
              variant="kit"
              color={selectedTeamSide === 'home' ? 'blue' : 'orange'}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white truncate">{selectedPlayer.full_name}</p>
              <p className="text-[11px] text-slate-400 truncate">
                {selectedPlayer.position || 'Demarcació sense definir'} ·{' '}
                <span className="text-sky-300 font-semibold">{selectedPlayer.infantil_year || 'Infantil'}</span>
                {' · '}
                {selectedPlayer.status}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPlayerId(null)}
              className="text-[11px] font-bold text-slate-400 hover:text-white shrink-0"
            >
              Canviar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 focus-within:border-sky-400">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder={`Busca per nom o dorsal a ${activeTeamName}`}
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 pr-1">
              {searchResults.length === 0 ? (
                <p className="text-[11px] text-slate-500 p-2">
                  Cap jugador de {activeTeamName} coincideix. Si no està a la plantilla, valora'l per dorsal.
                </p>
              ) : (
                searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlayerId(p.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left"
                  >
                    <span className="w-8 text-xs font-black text-sky-300 shrink-0">
                      {p.jersey_number != null ? `#${p.jersey_number}` : '—'}
                    </span>
                    <span className="text-xs font-bold text-white truncate flex-1">{p.full_name}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">{p.position}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── PAS 3: MISSATGE DE VEU I COMENTARI ────────────────────────────── */}
      <div className="space-y-2.5 pt-1 border-t border-slate-800">
        <label className="text-xs font-bold text-slate-300 block flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-[#ff6600]" />
            <span>3. Missatge de veu i comentari:</span>
          </span>
          <span className="text-[10px] text-slate-400">Dicta o escriu les teues impressions</span>
        </label>

        {/* Panell de Gravació de Veu */}
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleToggleRecord}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-rose-950/50'
                  : 'bg-gradient-to-r from-[#ff6600] to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-orange-950/40'
              }`}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Aturar Gravació ({recordingTime}s)</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>{activeAudioSource ? 'Gravar Nova Nota de Veu' : 'Gravar Missatge de Veu'}</span>
                </>
              )}
            </button>

            {isRecording && (
              <div className="flex items-center gap-2 text-xs text-rose-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span>Dictant... (la veu es transcriu a sota)</span>
              </div>
            )}

            {!isRecording && !activeAudioSource && (
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Pots dictar en veu alta o escriure el comentari directament
              </span>
            )}
          </div>

          {micError && <p className="text-[11px] text-rose-400 font-semibold">{micError}</p>}
        </div>

        {/* Reproductor si hi ha àudio enregistrat */}
        {activeAudioSource && !isRecording && (
          <AudioNotePlayer src={activeAudioSource} duration={recordingTime || 0} onDelete={handleClearAudio} />
        )}

        {/* Caixa de Text del Comentari */}
        <div className="relative">
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentari tècnic sobre el jugador (jugades clau, velocitat, presa de decisions, perfil...)"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 resize-y"
          />
          {transcript && isRecording && (
            <div className="absolute right-3 bottom-3 flex items-center gap-1.5 bg-slate-900/90 border border-sky-500/40 px-2 py-0.5 rounded-md text-[10px] text-sky-300">
              <Volume2 className="w-3 h-3 animate-pulse" />
              <span>Transcribint veu...</span>
            </div>
          )}
        </div>
      </div>

      {/* ── PAS 4 & 5: SELECCIONAR INTERESSANT I VALORAR AMB ESTRELLES ───── */}
      <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">4. Estat de seguiment del jugador:</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleStatus('Interesante')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-sm ${
                status === 'Interesante'
                  ? 'bg-violet-600 text-white border-violet-400 shadow-violet-950/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-violet-300 hover:border-violet-500/40'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Interessant</span>
            </button>

            <button
              type="button"
              onClick={() => toggleStatus('Preseleccionado')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-sm ${
                status === 'Preseleccionado'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-950/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-amber-300 hover:border-amber-500/40'
              }`}
            >
              <Star className="w-4 h-4 fill-current" />
              <span>Preseleccionat</span>
            </button>
          </div>
          {!status && (
            <p className="text-[10px] text-slate-500 mt-1">Sense marcar: no es canvia l'estat del jugador.</p>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
            <span>5. Estrelles a valorar:</span>
            <span className="text-[11px] font-black text-amber-400">
              {rating === 1 && '1/5 · Discret'}
              {rating === 2 && '2/5 · Correcte'}
              {rating === 3 && '3/5 · Interessant'}
              {rating === 4 && '4/5 · Molt bo'}
              {rating === 5 && '5/5 · Top / Destacat'}
              {rating === 0 && 'Sense valorar'}
            </span>
          </label>
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
            <StarRating rating={rating} onChange={setRating} size="lg" theme="dark" />
            <span className="text-xs font-black text-slate-400">({rating} estrelles)</span>
          </div>
        </div>
      </div>

      {/* ── BOTÓ DESAR VALORACIÓ ─────────────────────────────────────────── */}
      <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400">
          {mode === 'dorsal' && dorsalInput ? (
            <span>
              Desar valoració per al <strong className="text-white">#{dorsalInput}</strong> de{' '}
              <strong className="text-sky-300">{activeTeamName}</strong>
            </span>
          ) : mode === 'player' && selectedPlayer ? (
            <span>
              Desar valoració a la fitxa de <strong className="text-white">{selectedPlayer.full_name}</strong>
            </span>
          ) : (
            <span>{mode === 'dorsal' ? 'Indica un dorsal per a guardar' : 'Tria el jugador per a guardar'}</span>
          )}
        </p>

        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer hover:scale-[1.02]"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Guardar Valoració</span>
        </button>
      </div>

      {/* ── VALORACIONS GUARDADES EN AQUEST PARTIT ───────────────────────── */}
      {matchScouts.length > 0 && (
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-wider">
            Valoracions d'aquest partit ({matchScouts.length})
          </h4>
          {matchScouts.map((s) => {
            const state = scoutState(s);
            const key = dorsalScoutKey(s);
            const pending = s.identified_by !== 'player' && !s.reconciled;
            return (
              <div key={key} className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-start gap-2.5">
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                    s.side === 'home' ? 'bg-sky-500/20 text-sky-300' : 'bg-orange-500/20 text-orange-300'
                  }`}
                >
                  {s.side === 'home' ? 'LOC' : 'VIS'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-white truncate">
                    {s.dorsal != null && `#${s.dorsal} `}
                    {s.identified_by === 'player' ? s.player_name : s.player_name && `(${s.player_name})`}
                    <span className="text-amber-400 font-bold ml-1.5">{'★'.repeat(s.rating || 0)}</span>
                    {s.status && <span className="text-[10px] text-violet-300 font-bold ml-1.5">{s.status}</span>}
                  </p>
                  {s.comment && <p className="text-[11px] text-slate-400 line-clamp-2">{s.comment}</p>}
                  <p className={`text-[10px] font-bold flex items-center gap-1 mt-0.5 ${state.cls}`}>
                    {state.icon}
                    <span>{state.text}</span>
                  </p>
                </div>
                {pending && (
                  <button
                    type="button"
                    title="Esborrar valoració"
                    onClick={() => removeDorsalScoutFromAgenda(agendaItem.id, key)}
                    className="p-1 text-slate-500 hover:text-rose-400 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
