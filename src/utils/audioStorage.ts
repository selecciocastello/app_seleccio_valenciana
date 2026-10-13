// Utilitat per a emmagatzemar i recuperar notes de veu de seguiment a IndexedDB

export interface VoiceNoteRecord {
  id: string;
  playerId?: string;
  matchId?: string;
  jerseyNumber?: number;
  teamName?: string;
  audioBase64: string;
  duration?: number;
  transcript?: string;
  createdAt: string;
}

const DB_NAME = 'seleccio_audio_db';
const STORE_NAME = 'voice_notes';

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('playerId', 'playerId', { unique: false });
        store.createIndex('matchId', 'matchId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveVoiceNote(note: VoiceNoteRecord): Promise<void> {
  try {
    const db = await openAudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(note);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Error al desar nota de veu a IndexedDB:', err);
  }
}

export async function getVoiceNote(id: string): Promise<VoiceNoteRecord | null> {
  try {
    const db = await openAudioDb();
    return await new Promise<VoiceNoteRecord | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getVoiceNotesForPlayer(playerId: string): Promise<VoiceNoteRecord[]> {
  try {
    const db = await openAudioDb();
    return await new Promise<VoiceNoteRecord[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const index = tx.objectStore(STORE_NAME).index('playerId');
      const req = index.getAll(playerId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deleteVoiceNote(id: string): Promise<void> {
  try {
    const db = await openAudioDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
