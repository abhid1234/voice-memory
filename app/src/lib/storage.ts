import { openDB } from "idb";
import type { IDBPDatabase } from "idb";

// IndexedDB object stores are schemaless, so the `embedding` field was added
// without a DB version bump or migration. New memos always include it (the app
// embeds the transcript before saving); any record written before the field
// existed simply lacks it and is skipped by RAG (see rag.retrieve). No backfill
// is possible without re-running the embedding model, so none is attempted.
export interface VoiceMemo {
  id?: number;
  timestamp: number;
  transcript: string;
  embedding: Float32Array;
  audioBlob?: Blob;
}

const DB_NAME = "VoiceMemoryDB";
const STORE_NAME = "memos";

let dbPromise: Promise<IDBPDatabase> | undefined;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
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

export async function getMemo(id: number): Promise<VoiceMemo | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

export async function deleteMemo(id: number): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function exportTranscriptsForTraining(): Promise<string> {
  const allMemos = await getAllMemos();
  return allMemos
    .map((memo) =>
      JSON.stringify({ text: memo.transcript, timestamp: memo.timestamp }),
    )
    .join("\n");
}
