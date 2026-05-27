import type { VoiceMemo } from "./storage";

const COLLECTION_NAME = "memos";

// Helper to convert primitive types to Firestore fields
function toFirestoreValue(val: unknown): unknown {
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === "boolean") return { booleanValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (val instanceof Float32Array) {
    return { arrayValue: { values: Array.from(val).map(toFirestoreValue) } };
  }
  return { stringValue: JSON.stringify(val) };
}

// Helper to parse Firestore fields back into standard JavaScript types
function fromFirestoreValue(field: Record<string, any>): any {
  if (!field) return undefined;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return parseInt(field.integerValue, 10);
  if ("doubleValue" in field) return parseFloat(field.doubleValue);
  if ("booleanValue" in field) return field.booleanValue;
  if ("arrayValue" in field) {
    const vals = field.arrayValue.values || [];
    return vals.map(fromFirestoreValue);
  }
  return undefined;
}

// Derive a cryptographic key from user password using PBKDF2
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt plaintext locally via Web Crypto API (AES-GCM)
export async function encryptText(text: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );

  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

// Decrypt ciphertext locally via Web Crypto API (AES-GCM)
export async function decryptText(encryptedBase64: string, password: string): Promise<string> {
  const dec = new TextDecoder();
  const combined = new Uint8Array(
    atob(encryptedBase64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);

  const key = await deriveKey(password, salt);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return dec.decode(decrypted);
}

// Check if credentials are valid by contacting Firestore endpoint
export async function testFirebaseConnection(apiKey: string, projectId: string): Promise<boolean> {
  if (!apiKey || !projectId) return false;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents?key=${apiKey}&pageSize=1`;
  try {
    const res = await fetch(url);
    // 200 OK or 404 (indicating project exists but collection/route is empty/not found) are valid
    return res.status < 400 || res.status === 404;
  } catch (err) {
    console.error("Firebase connection test failed:", err);
    return false;
  }
}

// Pushes local database memos to remote Firestore database using REST batch writes
export async function pushMemosToFirestore(
  apiKey: string,
  projectId: string,
  memos: VoiceMemo[],
  encryptionPassword?: string
): Promise<void> {
  if (memos.length === 0) return;

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`;

  const writes = await Promise.all(
    memos.map(async (memo) => {
      const docId = `memo_${memo.id}`;
      const docPath = `projects/${projectId}/databases/(default)/documents/${COLLECTION_NAME}/${docId}`;

      let transcript = memo.transcript;
      let rawTranscript = memo.rawTranscript || "";
      let isEncrypted = false;

      if (encryptionPassword) {
        transcript = await encryptText(transcript, encryptionPassword);
        if (rawTranscript) {
          rawTranscript = await encryptText(rawTranscript, encryptionPassword);
        }
        isEncrypted = true;
      }

      const fields: Record<string, unknown> = {
        id: toFirestoreValue(memo.id),
        timestamp: toFirestoreValue(memo.timestamp),
        transcript: toFirestoreValue(transcript),
        rawTranscript: toFirestoreValue(rawTranscript),
        isEncrypted: toFirestoreValue(isEncrypted),
      };

      if (memo.tags) {
        fields.tags = toFirestoreValue(memo.tags);
      }

      if (memo.embedding && !isEncrypted) {
        fields.embedding = toFirestoreValue(memo.embedding);
      }

      return {
        update: {
          name: docPath,
          fields,
        },
      };
    })
  );

  // Firestore REST batch size limit is 500 writes
  const BATCH_SIZE = 400;
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const chunk = writes.slice(i, i + BATCH_SIZE);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ writes: chunk }),
    });

    if (!res.ok) {
      throw new Error(`Firebase batch push failed: ${res.statusText}`);
    }
  }
}

// Pulls remote Firestore database memos and optionally decrypts them
export async function pullMemosFromFirestore(
  apiKey: string,
  projectId: string,
  encryptionPassword?: string
): Promise<VoiceMemo[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${COLLECTION_NAME}?key=${apiKey}`;
  const res = await fetch(url);

  if (res.status === 404) {
    // Collection doesn't exist yet, return empty array
    return [];
  }

  if (!res.ok) {
    throw new Error(`Firebase pull failed: ${res.statusText}`);
  }

  const data = await res.json();
  const documents = data.documents || [];
  const memos: VoiceMemo[] = [];

  for (const doc of documents) {
    const fields = doc.fields || {};
    const id = fromFirestoreValue(fields.id);
    const timestamp = fromFirestoreValue(fields.timestamp);
    let transcript = fromFirestoreValue(fields.transcript) || "";
    let rawTranscript = fromFirestoreValue(fields.rawTranscript) || "";
    const isEncrypted = fromFirestoreValue(fields.isEncrypted) || false;
    const tags = fromFirestoreValue(fields.tags);
    const embeddingArray = fromFirestoreValue(fields.embedding);

    if (isEncrypted) {
      if (!encryptionPassword) {
        throw new Error("Pulled memories are encrypted. Please configure an encryption password to decrypt.");
      }
      try {
        transcript = await decryptText(transcript, encryptionPassword);
        if (rawTranscript) {
          rawTranscript = await decryptText(rawTranscript, encryptionPassword);
        }
      } catch (err) {
        console.error(`Failed to decrypt memo ID ${id}:`, err);
        throw new Error("Decryption failed. Please check your encryption password.");
      }
    }

    const memo: VoiceMemo = {
      id,
      timestamp,
      transcript,
    };

    if (rawTranscript) {
      memo.rawTranscript = rawTranscript;
    }
    if (tags) {
      memo.tags = tags;
    }
    if (embeddingArray && Array.isArray(embeddingArray)) {
      memo.embedding = new Float32Array(embeddingArray);
    }

    memos.push(memo);
  }

  return memos.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}
