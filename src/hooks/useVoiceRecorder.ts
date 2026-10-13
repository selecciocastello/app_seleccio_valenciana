import { useState, useRef, useEffect, useCallback } from 'react';
import { blobToBase64 } from '../utils/audioStorage';

interface VoiceRecorderResult {
  audioBlob: Blob | null;
  audioUrl: string | null;
  audioBase64: string | null;
  transcript: string;
  duration: number;
}

export function useVoiceRecorder(initialLang: 'ca-ES' | 'es-ES' = 'ca-ES') {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  const isSupported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  // Neteja recursos en desmuntar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioUrl(null);
    setAudioBlob(null);
    setAudioBase64(null);
    setTranscript('');
    setRecordingTime(0);
    audioChunksRef.current = [];

    if (!isSupported) {
      setError('El navegador no suporta la gravació de veu.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Selecció de format suportat pel navegador (Safari suporta mp4/webm segons versió)
      let options: MediaRecorderOptions | undefined;
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        options = { mimeType: 'audio/ogg' };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250); // Recull dades cada 250ms
      setIsRecording(true);

      // Temporitzador de durada
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Inicialitza SpeechRecognition si està disponible al navegador
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = initialLang;

          let finalTrans = '';
          recognition.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i];
              if (res.isFinal) {
                finalTrans += res[0].transcript + ' ';
              } else {
                interim += res[0].transcript;
              }
            }
            setTranscript((finalTrans + interim).trim());
          };

          recognition.onerror = (e: any) => {
            console.warn('SpeechRecognition warning:', e.error);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.warn('No ha sigut possible iniciar SpeechRecognition:', e);
        }
      }
    } catch (err: any) {
      console.error('Error al sol·licitar el micròfon:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Accés al micròfon denegat. Permet el micròfon al navegador.');
      } else {
        setError('No s\'ha pogut accedir al micròfon.');
      }
      setIsRecording(false);
    }
  }, [initialLang, isSupported]);

  const stopRecording = useCallback(async (): Promise<VoiceRecorderResult> => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        setIsRecording(false);
        resolve({
          audioBlob: null,
          audioUrl: null,
          audioBase64: null,
          transcript,
          duration: recordingTime
        });
        return;
      }

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        let base64: string | null = null;
        try {
          base64 = await blobToBase64(blob);
        } catch (e) {
          console.warn('Error al convertir blob a base64:', e);
        }

        setAudioBlob(blob);
        setAudioUrl(url);
        setAudioBase64(base64);
        setIsRecording(false);

        // Atura els tracks del micròfon
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        resolve({
          audioBlob: blob,
          audioUrl: url,
          audioBase64: base64,
          transcript,
          duration: recordingTime
        });
      };

      mediaRecorder.stop();
    });
  }, [transcript, recordingTime]);

  const resetRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
    setAudioUrl(null);
    setAudioBlob(null);
    setAudioBase64(null);
    setTranscript('');
    setError(null);
  }, []);

  return {
    isRecording,
    recordingTime,
    audioUrl,
    audioBlob,
    audioBase64,
    transcript,
    error,
    isSupported,
    setTranscript,
    startRecording,
    stopRecording,
    resetRecording
  };
}
