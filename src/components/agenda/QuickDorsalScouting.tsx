import React, { useState, useEffect, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Star,
  CheckCircle2,
  UserPlus,
  Shield,
  RotateCcw,
  Volume2,
  Check
} from 'lucide-react';
import { useAppStore } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { StarRating } from '../ui/StarRating';
import { JerseyBadge } from '../ui/JerseyBadge';
import { AudioNotePlayer } from '../ui/AudioNotePlayer';
import { saveVoiceNote, getVoiceNotesForPlayer } from '../../utils/audioStorage';
import type { Player, PlayerStatus, ScoutingAgendaItem } from '../../types/models';

interface QuickDorsalScoutingProps {
  agendaItem: ScoutingAgendaItem;
  homePlayers: Player[];
  awayPlayers: Player[];
  onPlayerSaved?: (player: Player) => void;
}

export const QuickDorsalScouting: React.FC<QuickDorsalScoutingProps> = ({
  agendaItem,
  homePlayers,
  awayPlayers,
  onPlayerSaved
}) => {
  const { updatePlayer, addPlayer, teams, addDorsalScoutToAgenda } = useAppStore();
  const { showToast } = useToast();

  // 1. Equip seleccionat: Local ('home') o Visitant ('away')
  const [selectedTeamSide, setSelectedTeamSide] = useState<'home' | 'away'>('home');

  // 2. Dorsal introduït o seleccionat
  const [dorsalInput, setDorsalInput] = useState<string>('');

  // 3. Camps del formulari de valoració
  const [status, setStatus] = useState<PlayerStatus>('Interesante');
  const [rating, setRating] = useState<number>(3); // Per defecte 3 estrelles (Interessant)
  const [comment, setComment] = useState<string>('');
  const [newPlayerName, setNewPlayerName] = useState<string>('');

  // 4. Nota de veu prèvia existent (si ja en tenia una guardada)
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
    if (transcript) {
      setComment((prev) => {
        // Si el comentari no té la transcripció, afegeix-la
        if (!prev) return transcript;
        return transcript;
      });
    }
  }, [transcript]);

  // Equip actual seleccionat
  const activeTeamName =
    selectedTeamSide === 'home' ? agendaItem.home_team_name : agendaItem.away_team_name;

  const activeTeamPlayers = selectedTeamSide === 'home' ? homePlayers : awayPlayers;

  // Cerca de l'objecte Team complet
  const activeTeamObj = useMemo(() => {
    return teams.find(
      (t) =>
        t.name.trim().toLowerCase() === activeTeamName.trim().toLowerCase() ||
        (selectedTeamSide === 'home' && t.id === agendaItem.match?.home_team_id) ||
        (selectedTeamSide === 'away' && t.id === agendaItem.match?.away_team_id)
    );
  }, [teams, activeTeamName, selectedTeamSide, agendaItem]);

  // Cerca si ja hi ha un jugador amb este dorsal a la plantilla de l'equip
  const matchedPlayer = useMemo(() => {
    const num = parseInt(dorsalInput.trim(), 10);
    if (isNaN(num)) return null;
    return activeTeamPlayers.find((p) => p.jersey_number === num) || null;
  }, [dorsalInput, activeTeamPlayers]);

  // Quan canvia el jugador trobat o el dorsal, precarreguem les dades si existeix
  useEffect(() => {
    if (matchedPlayer) {
      setStatus(
        matchedPlayer.status === 'Preseleccionado' || matchedPlayer.status === 'Interesante'
          ? matchedPlayer.status
          : 'Interesante'
      );
      setRating(matchedPlayer.rating || 3);
      setComment(matchedPlayer.notes || '');

      // Comprova si té nota de veu a sports_data
      const sportsVoice = (matchedPlayer.sports_data as any)?.voice_note;
      if (sportsVoice?.audioBase64) {
        setExistingAudioUrl(sportsVoice.audioBase64);
      } else {
        // Cerca a IndexedDB
        getVoiceNotesForPlayer(matchedPlayer.id).then((notes) => {
          if (notes.length > 0 && notes[notes.length - 1].audioBase64) {
            setExistingAudioUrl(notes[notes.length - 1].audioBase64);
          } else {
            setExistingAudioUrl(null);
          }
        });
      }
    } else {
      setExistingAudioUrl(null);
    }
  }, [matchedPlayer]);

  // Quan canvia d'equip, neteja o adapta el dorsal si cal
  const handleTeamChange = (side: 'home' | 'away') => {
    setSelectedTeamSide(side);
  };

  // Selecció ràpida de dorsal des dels botons de la plantilla
  const handleSelectDorsal = (num: number) => {
    setDorsalInput(String(num));
    resetRecording();
  };

  // Toggle de marcatge com a Interessant
  const toggleInteressant = () => {
    if (status === 'Interesante') {
      setStatus('Candidato');
    } else {
      setStatus('Interesante');
    }
  };

  // Toggle de marcatge com a Preseleccionat
  const togglePreseleccionat = () => {
    if (status === 'Preseleccionado') {
      setStatus('Candidato');
    } else {
      setStatus('Preseleccionado');
    }
  };

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

  // Netejar la nota de veu actual
  const handleClearAudio = () => {
    resetRecording();
    setExistingAudioUrl(null);
  };

  // Guardar valoració del jugador
  const handleSaveObservation = async () => {
    const num = parseInt(dorsalInput.trim(), 10);
    if (isNaN(num)) {
      showToast('Si us plau, indica un número de dorsal vàlid', 'error');
      return;
    }

    let targetPlayer: Player | null = matchedPlayer;
    const finalAudioBase64 = audioBase64 || existingAudioUrl;

    const voiceNoteData = finalAudioBase64
      ? {
          audioBase64: finalAudioBase64,
          transcript: comment || transcript,
          duration: recordingTime,
          matchId: agendaItem.match_id,
          date: new Date().toISOString()
        }
      : undefined;

    const matchScoutData = {
      match_id: agendaItem.match_id,
      agenda_id: agendaItem.id,
      team_name: activeTeamName,
      side: selectedTeamSide,
      dorsal: num,
      rating,
      status,
      notes: comment.trim(),
      created_at: new Date().toISOString()
    };

    if (targetPlayer) {
      // Actualitzar jugador existent
      const updatedSportsData = {
        ...(targetPlayer.sports_data || {}),
        ...(voiceNoteData ? { voice_note: voiceNoteData } : {}),
        match_scout: matchScoutData
      };

      updatePlayer(targetPlayer.id, {
        status,
        rating,
        notes: comment.trim(),
        sports_data: updatedSportsData
      });

      // Registrar seguiment de dorsal a l'agenda
      addDorsalScoutToAgenda(agendaItem.id, {
        team_name: activeTeamName,
        side: selectedTeamSide,
        dorsal: num,
        player_id: targetPlayer.id,
        rating,
        status,
        comment: comment.trim(),
        voice_note: voiceNoteData,
        created_at: new Date().toISOString()
      });

      // Desa a IndexedDB
      if (finalAudioBase64) {
        await saveVoiceNote({
          id: `vn_${targetPlayer.id}_${Date.now()}`,
          playerId: targetPlayer.id,
          matchId: agendaItem.match_id,
          jerseyNumber: num,
          teamName: activeTeamName,
          audioBase64: finalAudioBase64,
          transcript: comment,
          createdAt: new Date().toISOString()
        });
      }

      showToast(
        `Jugador ${targetPlayer.full_name} (#${num}) valorat: ${rating}⭐ (${status})`,
        'success'
      );
      if (onPlayerSaved) onPlayerSaved(targetPlayer);
    } else {
      // Crear nou jugador amb este dorsal per a l'equip
      const playerName = newPlayerName.trim() || `Dorsal #${num} (${activeTeamName})`;
      const created = await addPlayer({
        full_name: playerName,
        first_name: playerName,
        last_name: '',
        jersey_number: num,
        team_id: activeTeamObj?.id,
        team: activeTeamObj || {
          id: `team_${activeTeamName.toLowerCase().replace(/\s+/g, '_')}`,
          name: activeTeamName,
          club: activeTeamName,
          city: 'Castelló'
        },
        status,
        rating,
        notes: comment.trim(),
        sports_data: {
          ...(voiceNoteData ? { voice_note: voiceNoteData } : {}),
          match_scout: matchScoutData
        }
      });

      // Registrar seguiment de dorsal a l'agenda per a la reconciliació posterior
      addDorsalScoutToAgenda(agendaItem.id, {
        team_name: activeTeamName,
        side: selectedTeamSide,
        dorsal: num,
        player_id: created?.id,
        rating,
        status,
        comment: comment.trim(),
        voice_note: voiceNoteData,
        created_at: new Date().toISOString()
      });

      if (finalAudioBase64 && created) {
        await saveVoiceNote({
          id: `vn_${created.id}_${Date.now()}`,
          playerId: created.id,
          matchId: agendaItem.match_id,
          jerseyNumber: num,
          teamName: activeTeamName,
          audioBase64: finalAudioBase64,
          transcript: comment,
          createdAt: new Date().toISOString()
        });
      }

      showToast(
        `Nou jugador registrat: #${num} ${playerName} valorat: ${rating}⭐ (es conciliarà amb l'acta FFCV)`,
        'success'
      );
      if (onPlayerSaved && created) onPlayerSaved(created);
    }

    // Reinicia els camps per a poder valorar el següent jugador ràpidament
    setDorsalInput('');
    setComment('');
    setNewPlayerName('');
    setRating(3);
    setStatus('Interesante');
    resetRecording();
    setExistingAudioUrl(null);
  };

  // Llista de jugadors amb dorsal de l'equip actual
  const existingRosterWithDorsal = useMemo(() => {
    return activeTeamPlayers
      .filter((p) => p.jersey_number !== undefined && p.jersey_number !== null)
      .sort((a, b) => (Number(a.jersey_number) || 0) - (Number(b.jersey_number) || 0));
  }, [activeTeamPlayers]);

  const activeAudioSource = audioUrl || existingAudioUrl;

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
              Relaciona dorsal amb l'equip, grava nota de veu o dictat, marca interessant i valora
            </p>
          </div>
        </div>

        {dorsalInput && (
          <button
            type="button"
            onClick={() => {
              setDorsalInput('');
              resetRecording();
              setComment('');
              setExistingAudioUrl(null);
            }}
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

      {/* ── PAS 2: DORSAL I AUTO-DETECCIÓ DE JUGADOR ──────────────────────── */}
      <div>
        <label className="text-xs font-bold text-slate-300 block mb-2 flex items-center justify-between">
          <span>2. Número de Dorsal vist al camp:</span>
          {matchedPlayer && (
            <span className="text-[11px] font-black text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Jugador identificat a la plantilla
            </span>
          )}
        </label>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Caixa d'entrada del número */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 sm:w-44 focus-within:border-sky-400">
            <span className="text-xs font-black text-slate-500 uppercase">DORSAL</span>
            <input
              type="number"
              min="1"
              max="99"
              placeholder="Ex: 8"
              value={dorsalInput}
              onChange={(e) => setDorsalInput(e.target.value)}
              className="w-full bg-transparent text-lg font-black text-white placeholder-slate-600 focus:outline-none"
            />
          </div>

          {/* Detecció de Jugador */}
          {matchedPlayer ? (
            <div className="flex-1 bg-slate-950/90 border border-emerald-500/40 rounded-xl p-2.5 flex items-center gap-3 shadow-sm">
              <JerseyBadge
                number={matchedPlayer.jersey_number}
                size="sm"
                variant="kit"
                color={selectedTeamSide === 'home' ? 'blue' : 'orange'}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-white truncate">{matchedPlayer.full_name}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {matchedPlayer.position || 'Demarcació sense definir'} ·{' '}
                  <span className="text-sky-300 font-semibold">{matchedPlayer.infantil_year || 'Infantil'}</span>
                </p>
              </div>
              <span
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  matchedPlayer.status === 'Preseleccionado'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : matchedPlayer.status === 'Interesante'
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {matchedPlayer.status}
              </span>
            </div>
          ) : dorsalInput.trim() ? (
            <div className="flex-1 bg-slate-950/90 border border-amber-500/30 rounded-xl p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <UserPlus className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-[11px] text-amber-200 font-semibold">
                  Dorsal #{dorsalInput} nou a {activeTeamName}:
                </span>
              </div>
              <input
                type="text"
                placeholder="Nom del jugador (opcional)"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          ) : null}
        </div>

        {/* Drecera de dorsals de la plantilla existent */}
        {existingRosterWithDorsal.length > 0 && (
          <div className="mt-2.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Dorsals disponibles a la plantilla de {activeTeamName}:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1">
              {existingRosterWithDorsal.map((p) => {
                const isSelected = String(p.jersey_number) === dorsalInput;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectDorsal(p.jersey_number!)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-sky-500 text-slate-950 font-black shadow-md scale-105'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <span>#{p.jersey_number}</span>
                    <span className="text-[10px] opacity-75 truncate max-w-[80px]">
                      {p.last_name || p.first_name}
                    </span>
                  </button>
                );
              })}
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

          {micError && (
            <p className="text-[11px] text-rose-400 font-semibold">{micError}</p>
          )}
        </div>

        {/* Reproductor si hi ha àudio enregistrat */}
        {activeAudioSource && !isRecording && (
          <AudioNotePlayer
            src={activeAudioSource}
            duration={recordingTime || 0}
            onDelete={handleClearAudio}
          />
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
        {/* Seleccionar Interessant / Preseleccionat */}
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">
            4. Estat de seguiment del jugador:
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleInteressant}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-sm ${
                status === 'Interesante'
                  ? 'bg-violet-600 text-white border-violet-400 shadow-violet-950/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-violet-300 hover:border-violet-500/40'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Marcar Interessant</span>
            </button>

            <button
              type="button"
              onClick={togglePreseleccionat}
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
        </div>

        {/* Estrelles a valorar */}
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
            <StarRating
              rating={rating}
              onChange={setRating}
              size="lg"
              theme="dark"
            />
            <span className="text-xs font-black text-slate-400">({rating} estrelles)</span>
          </div>
        </div>
      </div>

      {/* ── BOTÓ DESAR VALORACIÓ ─────────────────────────────────────────── */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400">
          {dorsalInput ? (
            <span>
              Desar valoració per a <strong className="text-white">#{dorsalInput}</strong> de{' '}
              <strong className="text-sky-300">{activeTeamName}</strong>
            </span>
          ) : (
            <span>Indica un dorsal per a activar el guardat</span>
          )}
        </p>

        <button
          type="button"
          disabled={!dorsalInput.trim() || isRecording}
          onClick={handleSaveObservation}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer hover:scale-[1.02]"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Guardar Valoració de Jugador</span>
        </button>
      </div>
    </div>
  );
};
