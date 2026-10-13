import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, Trash2 } from 'lucide-react';

interface AudioNotePlayerProps {
  src: string; // URL o base64
  duration?: number;
  onDelete?: () => void;
  className?: string;
  compact?: boolean;
}

export const AudioNotePlayer: React.FC<AudioNotePlayerProps> = ({
  src,
  duration,
  onDelete,
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((e) => {
        console.warn('Audio play error:', e);
      });
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 rounded-xl p-2 sm:p-2.5 transition-all shadow-inner ${className}`}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Botó Play / Pause */}
      <button
        type="button"
        onClick={togglePlay}
        className="w-8 h-8 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center justify-center shrink-0 shadow-md transition-transform hover:scale-105"
        title={isPlaying ? 'Pausar nota de veu' : 'Reproduir nota de veu'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      {/* Barra de Progrés i Temps */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-semibold">
          <span className="flex items-center gap-1 text-sky-300">
            <Volume2 className="w-3 h-3" />
            <span>Nota de veu</span>
          </span>
          <span>
            {formatTime(currentTime)} / {formatTime(audioDuration || currentTime)}
          </span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-sky-400 h-full rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Botons auxiliars */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleRestart}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Reiniciar"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
            title="Eliminar gravació"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
