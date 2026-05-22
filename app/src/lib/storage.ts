import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

export interface VoiceMemo {
  id?: number;
  timestamp: number;
  transcript: string;
  rawTranscript?: string;
  audioBlob?: Blob;
  tags?: string[];
}

const DB_NAME = 'VoiceMemoryDB';
const STORE_NAME = 'memos';

let dbPromise: Promise<IDBPDatabase>;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveMemo(memo: VoiceMemo): Promise<number> {
  const db = await getDB();
  return (await db.add(STORE_NAME, memo)) as number;
}

export async function getAllMemos(): Promise<VoiceMemo[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function deleteMemo(id: number): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function exportTranscriptsForTraining(): Promise<string> {
  const allMemos = await getAllMemos();
  return allMemos
    .map(memo => JSON.stringify({
      text: memo.transcript,
      timestamp: memo.timestamp
    }))
    .join('\n');
}

export async function wipeAllMemos(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

