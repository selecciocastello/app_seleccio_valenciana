import React, { useEffect, useState } from 'react';
import { Star, Sparkles, Mic, MicOff } from 'lucide-react';
import { JerseyBadge } from '../ui/JerseyBadge';
import { AudioNotePlayer } from '../ui/AudioNotePlayer';
import { useAppStore } from '../../hooks/useAppStore';
import { useToast } from '../../contexts/ToastContext';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { saveVoiceNote, getVoiceNotesForPlayer } from '../../utils/audioStorage';
import { PLAYER_POSITIONS, type Player, type PlayerStatus } from '../../types/models';

const NO_POSITION = 'Sense definir';

const canonicalPosition = (pos?: string | null) => {
  if (!pos || pos === 'Candidato' || pos === NO_POSITION) return NO_POSITION;
  return PLAYER_POSITIONS.find((p) => p.toLowerCase() === pos.trim().toLowerCase()) || pos;
};

/** Opcions del desplegable: les posicions de l'app i, si cal, la posició actual de la FFCV. */
const positionOptions = (current: string) =>
  current === NO_POSITION || (PLAYER_POSITIONS as readonly string[]).includes(current)
    ? [NO_POSITION, ...PLAYER_POSITIONS]
    : [NO_POSITION, current, ...PLAYER_POSITIONS];

const selectClass =
  'w-full bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-sky-500 transition-colors cursor-pointer';

/** Targeta d'un jugador a la plantilla d'un partit de l'agenda, amb edició ràpida de seguiment. */
export const PlayerScoutingCard: React.FC<{ player: Player }> = ({ player }) => {
  const { updatePlayer } = useAppStore();
  const { showToast } = useToast();
  const [note, setNote] = useState(player.notes || '');
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);

  const {
    isRecording,
    recordingTime,
    audioUrl,
    transcript,
    startRecording,
    stopRecording,
    resetRecording
  } = useVoiceRecorder('ca-ES');

  useEffect(() => {
    setNote(player.notes || '');
    const sportsVoice = (player.sports_data as any)?.voice_note;
    if (sportsVoice?.audioBase64) {
      setVoiceAudioUrl(sportsVoice.audioBase64);
    } else {
      getVoiceNotesForPlayer(player.id).then((notes) => {
        if (notes.length > 0 && notes[notes.length - 1].audioBase64) {
          setVoiceAudioUrl(notes[notes.length - 1].audioBase64);
        } else {
          setVoiceAudioUrl(null);
        }
      });
    }
  }, [player.id, player.notes, player.sports_data]);

  useEffect(() => {
    if (transcript && isRecording) {
      setNote(transcript);
    }
  }, [transcript, isRecording]);

  const isPreselected = player.status === 'Preseleccionado';
  const isInteresting = player.status === 'Interesante';
  const rating = player.rating ?? 0;
  const position = canonicalPosition(player.position);
  const secondaryPosition = canonicalPosition(player.secondary_position);

  // Tornar a clicar l'estat actiu el desmarca (torna a Candidat)
  const handleStatus = (status: PlayerStatus) => {
    const next: PlayerStatus = player.status === status ? 'Candidato' : status;
    updatePlayer(player.id, { status: next });
    const label = next === 'Interesante' ? 'INTERESSANT' : next === 'Preseleccionado' ? 'PRESELECCIONAT' : 'candidat';
    showToast(`${player.full_name} marcat com a ${label}`, next === 'Candidato' ? 'info' : 'success');
  };

  // Clicar l'estrella actual esborra la valoració
  const handleRating = (n: number) => {
    const next = rating === n ? 0 : n;
    updatePlayer(player.id, { rating: next });
    showToast(next > 0 ? `${player.full_name}: ${next} ${next === 1 ? 'estrella' : 'estrelles'}` : `Valoració de ${player.full_name} esborrada`, 'success');
  };

  const handlePosition = (field: 'position' | 'secondary_position', value: string) => {
    updatePlayer(player.id, { [field]: value === NO_POSITION ? '' : value });
    showToast(`${field === 'position' ? 'Demarcació' : 'Demarcació alternativa'} de ${player.full_name}: ${value}`, 'success');
  };

  const handleNoteBlur = () => {
    if (note === (player.notes || '')) return;
    updatePlayer(player.id, { notes: note });
    showToast(`Comentari de ${player.full_name} desat`, 'success');
  };

  const handleToggleVoice = async () => {
    if (isRecording) {
      const res = await stopRecording();
      const finalNote = (note || res.transcript || '').trim();
      if (res.audioBase64) {
        setVoiceAudioUrl(res.audioBase64);
        const updatedSports = {
          ...(player.sports_data || {}),
          voice_note: {
            audioBase64: res.audioBase64,
            transcript: finalNote,
            duration: res.duration,
            date: new Date().toISOString()
          }
        };
        updatePlayer(player.id, {
          notes: finalNote,
          sports_data: updatedSports
        });
        await saveVoiceNote({
          id: `vn_${player.id}_${Date.now()}`,
          playerId: player.id,
          jerseyNumber: player.jersey_number,
          teamName: player.team?.name,
          audioBase64: res.audioBase64,
          transcript: finalNote,
          createdAt: new Date().toISOString()
        });
        showToast(`Nota de veu desada per a ${player.full_name}`, 'success');
      }
    } else {
      await startRecording();
    }
  };

  const handleDeleteAudio = () => {
    resetRecording();
    setVoiceAudioUrl(null);
    const updatedSports = { ...(player.sports_data || {}) };
    delete (updatedSports as any).voice_note;
    updatePlayer(player.id, { sports_data: updatedSports });
    showToast(`Nota de veu de ${player.full_name} eliminada`, 'info');
  };

  const activeAudio = audioUrl || voiceAudioUrl;

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
        isPreselected
          ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/20'
          : isInteresting
          ? 'bg-violet-950/20 border-violet-500/40'
          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Dorsal, foto, nom, equip */}
        <div className="flex items-center gap-3 min-w-0">
          <JerseyBadge
            number={player.jersey_number}
            size="sm"
            variant="kit"
            color={player.infantil_year === 'Infantil 1er año' ? 'orange' : 'blue'}
            className="shrink-0"
          />
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300 shrink-0 overflow-hidden shadow">
            {player.photo_url ? (
              <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{player.first_name?.[0] || 'J'}{player.last_name?.[0] || ''}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-black text-white break-words">{player.full_name}</h4>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span className="text-slate-300 font-bold">{player.team?.name || 'Sense equip'}</span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border whitespace-nowrap ${
                  player.infantil_year === 'Infantil 1er año'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : player.infantil_year === 'Infantil 2º año'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {player.infantil_year === 'Infantil 1er año'
                  ? '1r Any (2014)'
                  : player.infantil_year === 'Infantil 2º año'
                  ? '2n Any (2013)'
                  : 'Infantil'}
              </span>
            </div>
          </div>
        </div>

        {/* Estat: Interessant / Preseleccionat */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => handleStatus('Interesante')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${
              isInteresting
                ? 'bg-violet-500 text-white border-violet-400'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-violet-500/20 hover:text-violet-300 hover:border-violet-500/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interessant</span>
          </button>
          <button
            type="button"
            onClick={() => handleStatus('Preseleccionado')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${
              isPreselected
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/40'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${isPreselected ? 'fill-current' : ''}`} />
            <span>Preseleccionat</span>
          </button>
        </div>
      </div>

      {/* Valoració i demarcacions */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-3 items-end">
        <div>
          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Valoració</span>
          <div className="flex items-center gap-0.5 h-[30px]">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleRating(n)}
                className="p-0.5 rounded hover:scale-125 transition-transform"
                aria-label={`${n} ${n === 1 ? 'estrella' : 'estrelles'}`}
              >
                <Star className={`w-5 h-5 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
              </button>
            ))}
          </div>
        </div>
        <label className="block min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Demarcació</span>
          <select value={position} onChange={(e) => handlePosition('position', e.target.value)} className={selectClass}>
            {positionOptions(position).map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Demarcació alternativa</span>
          <select
            value={secondaryPosition}
            onChange={(e) => handlePosition('secondary_position', e.target.value)}
            className={selectClass}
          >
            {positionOptions(secondaryPosition).map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Nota de veu si n'hi ha */}
      {activeAudio && !isRecording && (
        <div className="mt-2.5">
          <AudioNotePlayer
            src={activeAudio}
            duration={recordingTime}
            onDelete={handleDeleteAudio}
            compact
          />
        </div>
      )}

      {/* Comentari i botó de micròfon */}
      <div className="mt-3 flex items-start gap-2">
        <button
          type="button"
          onClick={handleToggleVoice}
          className={`p-2 rounded-xl border shrink-0 transition-all ${
            isRecording
              ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-sky-300 hover:border-sky-500/50'
          }`}
          title={isRecording ? 'Aturar gravació' : 'Gravar / dictar nota de veu'}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <div className="flex-1 relative">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={handleNoteBlur}
            rows={2}
            placeholder={
              isRecording
                ? `Dictant veu (${recordingTime}s)...`
                : "Comentari / informe tècnic sobre el jugador (es desa en eixir del camp)..."
            }
            className="w-full bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors resize-y"
          />
        </div>
      </div>
    </div>
  );
};
