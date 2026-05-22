# VoiceMemory Phase A — Capture Lane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record a voice memo, transcribe it on-device with chunked near-live Whisper, embed it, save it to IndexedDB, and see/replay it in the timeline — fully offline, no cloud.

**Architecture:** A single shared Web Worker (`ai-worker`) hosts both transformers.js models — `whisper-tiny.en` (STT) and `all-MiniLM-L6-v2` (embeddings). This is the design doc's "transformers.js worker" (the design names it `stt.worker`, but since it also runs embeddings, `ai-worker` is the clearer name); the separate MediaPipe `llm.worker` for Gemma 4 arrives in Phase B. The main thread talks to it through a typed `WorkerClient`. The worker's message handling is a pure function (`createAiWorkerHandler`) so it is unit-testable without loading real models. `lib/stt.ts` drives `MediaRecorder` + `AudioContext` and emits cumulative partial transcripts every ~8 s; on stop it returns one authoritative transcript plus the audio blob. `App.tsx` wires the Record tab and timeline replay.

**Tech Stack:** React 19, Vite 8, TypeScript, `@xenova/transformers` (Whisper + MiniLM in a Worker), `idb` (IndexedDB), `vitest` + `fake-indexeddb` (tests). Web Audio + MediaRecorder for capture.

**Scope note:** This is Phase A of four (Capture → Query → Demo → Training) from `docs/superpowers/specs/2026-05-20-voicememory-canonical-build-design.md`. Phases B/C/D get their own plans. This plan does **not** touch `Demo.tsx`, `inference.ts`, or `rag.ts` (those are Phase B/C). It only adds the `embedding` field to the shared `VoiceMemo` type.

**Branch:** `worktree-claude-session` (isolated worktree). All paths below are relative to the worktree root; the app lives in `app/`.

**Conventions for every commit:** end the message with the trailer
`Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## File structure (created/modified in Phase A)

| File | Responsibility |
|---|---|
| `app/vitest.config.ts` | **Create.** Vitest config (jsdom, globals, setup file). |
| `app/src/test/setup.ts` | **Create.** Loads `fake-indexeddb/auto` for storage tests. |
| `app/src/lib/ai-worker-protocol.ts` | **Create.** Shared message types between main thread and worker. |
| `app/src/lib/ai-worker-handler.ts` | **Create.** Pure request handler (testable, no models). |
| `app/src/lib/ai-worker.ts` | **Create.** Worker entry: wires real transformers.js models to the handler. |
| `app/src/lib/worker-client.ts` | **Create.** `WorkerClient` (request/response matching) + `getAiWorker()` singleton. |
| `app/src/lib/embeddings.ts` | **Create.** `embed(text)` thin wrapper over the worker. |
| `app/src/lib/stt.ts` | **Replace.** Chunked recording + cumulative partials + final transcript. (Currently mock.) |
| `app/src/lib/storage.ts` | **Modify.** Add `embedding` to `VoiceMemo`; add `getMemo(id)`. |
| `app/src/App.tsx` | **Modify.** Record handler (embed + save, race fixed), timeline audio replay. |
| `app/src/lib/*.test.ts` | **Create.** Unit tests for storage, handler, worker-client. |
| `app/package.json` | **Modify.** Add deps + `test` scripts. |

---

## Task 1: Test harness (vitest + fake-indexeddb)

**Files:**
- Modify: `app/package.json`
- Create: `app/vitest.config.ts`
- Create: `app/src/test/setup.ts`
- Create: `app/src/lib/sanity.test.ts`

- [ ] **Step 1: Install dependencies**

Run from `app/`:
```bash
npm i @xenova/transformers@^2.17.2
npm i -D vitest jsdom fake-indexeddb
```
Expected: packages added, no peer-dep errors that block install.

- [ ] **Step 2: Add test scripts to `package.json`**

In `app/package.json`, add two lines to `"scripts"` (keep the existing ones):
```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Create `app/vitest.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Deliberately omits vite-plugin-pwa so the service worker is not generated during tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 4: Create `app/src/test/setup.ts`**

```ts
// Provides a working IndexedDB implementation in the jsdom test environment.
import 'fake-indexeddb/auto'
```

- [ ] **Step 5: Write the sanity test `app/src/lib/sanity.test.ts`**

```ts
import { describe, it, expect } from 'vitest'

describe('test harness', () => {
  it('runs assertions', () => {
    expect(1 + 1).toBe(2)
  })

  it('provides indexedDB via fake-indexeddb', () => {
    expect(typeof indexedDB).not.toBe('undefined')
  })
})
```

- [ ] **Step 6: Run the test**

Run from `app/`: `npm test`
Expected: PASS, 2 tests in `sanity.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add app/package.json app/package-lock.json app/vitest.config.ts app/src/test/setup.ts app/src/lib/sanity.test.ts
git commit -m "test: add vitest + fake-indexeddb harness

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Storage — add `embedding` field and `getMemo(id)`

**Files:**
- Modify: `app/src/lib/storage.ts`
- Create: `app/src/lib/storage.test.ts`

The IndexedDB object store is schemaless, so adding `embedding` to stored objects needs **no** version bump — only a type change. The real red-green target is the new `getMemo(id)` lookup used by timeline replay.

- [ ] **Step 1: Write the failing test `app/src/lib/storage.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveMemo, getAllMemos, getMemo, deleteMemo, exportTranscriptsForTraining } from './storage'
import type { VoiceMemo } from './storage'

function makeMemo(overrides: Partial<VoiceMemo> = {}): VoiceMemo {
  return {
    timestamp: 1_716_150_000_000,
    transcript: 'hello world',
    embedding: new Float32Array([0.1, 0.2, 0.3]),
    ...overrides,
  }
}

beforeEach(async () => {
  for (const m of await getAllMemos()) {
    await deleteMemo(m.id!)
  }
})

describe('storage', () => {
  it('saves a memo and reads it back with its embedding intact', async () => {
    const id = await saveMemo(makeMemo())
    const all = await getAllMemos()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(id)
    expect(all[0].transcript).toBe('hello world')
    expect(all[0].embedding).toBeInstanceOf(Float32Array)
    expect(Array.from(all[0].embedding)).toEqual([
      expect.closeTo(0.1), expect.closeTo(0.2), expect.closeTo(0.3),
    ])
  })

  it('getMemo returns the memo by id, or undefined when absent', async () => {
    const id = await saveMemo(makeMemo({ transcript: 'find me' }))
    const found = await getMemo(id)
    expect(found?.transcript).toBe('find me')
    expect(await getMemo(999_999)).toBeUndefined()
  })

  it('deleteMemo removes the memo', async () => {
    const id = await saveMemo(makeMemo())
    await deleteMemo(id)
    expect(await getAllMemos()).toHaveLength(0)
  })

  it('exportTranscriptsForTraining emits one JSON line per memo', async () => {
    await saveMemo(makeMemo({ transcript: 'a', timestamp: 1 }))
    await saveMemo(makeMemo({ transcript: 'b', timestamp: 2 }))
    const jsonl = await exportTranscriptsForTraining()
    const lines = jsonl.trim().split('\n').map((l) => JSON.parse(l))
    expect(lines).toEqual(
      expect.arrayContaining([
        { text: 'a', timestamp: 1 },
        { text: 'b', timestamp: 2 },
      ]),
    )
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- storage`
Expected: FAIL — `getMemo` is not exported (TypeError / import error), and the `embedding` field type does not exist on `VoiceMemo`.

- [ ] **Step 3: Update `app/src/lib/storage.ts`**

Replace the file with:
```ts
import { openDB } from 'idb'
import type { IDBPDatabase } from 'idb'

export interface VoiceMemo {
  id?: number
  timestamp: number
  transcript: string
  embedding: Float32Array
  audioBlob?: Blob
}

const DB_NAME = 'VoiceMemoryDB'
const STORE_NAME = 'memos'

let dbPromise: Promise<IDBPDatabase> | undefined

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        }
      },
    })
  }
  return dbPromise
}

export async function saveMemo(memo: VoiceMemo): Promise<number> {
  const db = await getDB()
  return (await db.add(STORE_NAME, memo)) as number
}

export async function getAllMemos(): Promise<VoiceMemo[]> {
  const db = await getDB()
  return db.getAll(STORE_NAME)
}

export async function getMemo(id: number): Promise<VoiceMemo | undefined> {
  const db = await getDB()
  return db.get(STORE_NAME, id)
}

export async function deleteMemo(id: number): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}

export async function exportTranscriptsForTraining(): Promise<string> {
  const allMemos = await getAllMemos()
  return allMemos
    .map((memo) => JSON.stringify({ text: memo.transcript, timestamp: memo.timestamp }))
    .join('\n')
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- storage`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/storage.ts app/src/lib/storage.test.ts
git commit -m "feat(storage): add embedding field and getMemo lookup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: AI worker protocol + pure handler

**Files:**
- Create: `app/src/lib/ai-worker-protocol.ts`
- Create: `app/src/lib/ai-worker-handler.ts`
- Create: `app/src/lib/ai-worker-handler.test.ts`

- [ ] **Step 1: Create `app/src/lib/ai-worker-protocol.ts`**

```ts
// Messages sent FROM the main thread TO the worker.
export interface TranscribeRequest { id: number; type: 'TRANSCRIBE'; audio: Float32Array }
export interface EmbedRequest { id: number; type: 'EMBED'; text: string }
export type WorkerRequest = TranscribeRequest | EmbedRequest

// Messages sent FROM the worker TO the main thread.
export interface ResultMessage { id: number; type: 'RESULT'; text?: string; vector?: Float32Array }
export interface ProgressMessage { id: number; type: 'PROGRESS'; file: string; progress: number }
export interface ErrorMessage { id: number; type: 'ERROR'; error: string }
export type WorkerResponse = ResultMessage | ProgressMessage | ErrorMessage
```

- [ ] **Step 2: Write the failing test `app/src/lib/ai-worker-handler.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { createAiWorkerHandler } from './ai-worker-handler'
import type { WorkerResponse } from './ai-worker-protocol'

describe('createAiWorkerHandler', () => {
  it('handles TRANSCRIBE by posting the transcribed text', async () => {
    const handle = createAiWorkerHandler({
      transcribe: async () => 'hello there',
      embed: async () => new Float32Array(),
    })
    const posted: WorkerResponse[] = []
    await handle({ id: 7, type: 'TRANSCRIBE', audio: new Float32Array([0]) }, (r) => posted.push(r))
    expect(posted).toEqual([{ id: 7, type: 'RESULT', text: 'hello there' }])
  })

  it('handles EMBED by posting the vector', async () => {
    const vec = new Float32Array([1, 2, 3])
    const handle = createAiWorkerHandler({
      transcribe: async () => '',
      embed: async () => vec,
    })
    const posted: WorkerResponse[] = []
    await handle({ id: 9, type: 'EMBED', text: 'hi' }, (r) => posted.push(r))
    expect(posted).toEqual([{ id: 9, type: 'RESULT', vector: vec }])
  })

  it('posts ERROR (with the request id) when a dependency throws', async () => {
    const handle = createAiWorkerHandler({
      transcribe: async () => { throw new Error('model load failed') },
      embed: async () => new Float32Array(),
    })
    const posted: WorkerResponse[] = []
    await handle({ id: 3, type: 'TRANSCRIBE', audio: new Float32Array() }, (r) => posted.push(r))
    expect(posted).toEqual([{ id: 3, type: 'ERROR', error: 'model load failed' }])
  })

  it('routes EMBED to embed, not transcribe', async () => {
    const transcribe = vi.fn(async () => 'x')
    const embed = vi.fn(async () => new Float32Array([5]))
    const handle = createAiWorkerHandler({ transcribe, embed })
    await handle({ id: 1, type: 'EMBED', text: 'q' }, () => {})
    expect(embed).toHaveBeenCalledOnce()
    expect(transcribe).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- ai-worker-handler`
Expected: FAIL — `createAiWorkerHandler` is not defined.

- [ ] **Step 4: Create `app/src/lib/ai-worker-handler.ts`**

```ts
import type { WorkerRequest, WorkerResponse } from './ai-worker-protocol'

export interface AiWorkerDeps {
  transcribe: (audio: Float32Array) => Promise<string>
  embed: (text: string) => Promise<Float32Array>
}

/**
 * Pure message handler for the AI worker. Given dependency functions and a
 * `post` callback, it processes one request and posts exactly one response
 * (RESULT or ERROR). Kept free of `self`/transformers.js so it is unit-testable.
 */
export function createAiWorkerHandler(deps: AiWorkerDeps) {
  return async function handle(
    req: WorkerRequest,
    post: (res: WorkerResponse) => void,
  ): Promise<void> {
    try {
      if (req.type === 'TRANSCRIBE') {
        const text = await deps.transcribe(req.audio)
        post({ id: req.id, type: 'RESULT', text })
      } else if (req.type === 'EMBED') {
        const vector = await deps.embed(req.text)
        post({ id: req.id, type: 'RESULT', vector })
      }
    } catch (e) {
      post({ id: req.id, type: 'ERROR', error: e instanceof Error ? e.message : String(e) })
    }
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- ai-worker-handler`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/ai-worker-protocol.ts app/src/lib/ai-worker-handler.ts app/src/lib/ai-worker-handler.test.ts
git commit -m "feat(worker): add AI worker protocol and pure handler

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: WorkerClient (request/response matching)

**Files:**
- Create: `app/src/lib/worker-client.ts`
- Create: `app/src/lib/worker-client.test.ts`

- [ ] **Step 1: Write the failing test `app/src/lib/worker-client.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { WorkerClient } from './worker-client'
import type { WorkerLike } from './worker-client'
import type { WorkerResponse } from './ai-worker-protocol'

class FakeWorker implements WorkerLike {
  posted: Array<{ id: number; type: string; text?: string; audio?: Float32Array }> = []
  onmessage: ((ev: { data: WorkerResponse }) => void) | null = null
  postMessage(message: unknown) {
    this.posted.push(message as never)
  }
  emit(res: WorkerResponse) {
    this.onmessage?.({ data: res })
  }
}

describe('WorkerClient', () => {
  it('embed: posts an EMBED request and resolves with the matching vector', async () => {
    const fake = new FakeWorker()
    const client = new WorkerClient(fake)
    const promise = client.embed('hello')
    expect(fake.posted[0]).toMatchObject({ id: 1, type: 'EMBED', text: 'hello' })
    fake.emit({ id: 1, type: 'RESULT', vector: new Float32Array([1, 2]) })
    expect(Array.from(await promise)).toEqual([1, 2])
  })

  it('transcribe: posts a TRANSCRIBE request and resolves with the matching text', async () => {
    const fake = new FakeWorker()
    const client = new WorkerClient(fake)
    const promise = client.transcribe(new Float32Array([0.5]))
    expect(fake.posted[0]).toMatchObject({ id: 1, type: 'TRANSCRIBE' })
    fake.emit({ id: 1, type: 'RESULT', text: 'transcribed' })
    expect(await promise).toBe('transcribed')
  })

  it('rejects when the worker posts an ERROR for that id', async () => {
    const fake = new FakeWorker()
    const client = new WorkerClient(fake)
    const promise = client.embed('x')
    fake.emit({ id: 1, type: 'ERROR', error: 'boom' })
    await expect(promise).rejects.toThrow('boom')
  })

  it('forwards PROGRESS to onProgress without resolving, then resolves on RESULT', async () => {
    const fake = new FakeWorker()
    const client = new WorkerClient(fake)
    const progress: number[] = []
    const promise = client.transcribe(new Float32Array([0]), (p) => progress.push(p.progress))
    fake.emit({ id: 1, type: 'PROGRESS', file: 'whisper', progress: 42 })
    fake.emit({ id: 1, type: 'RESULT', text: 'done' })
    expect(await promise).toBe('done')
    expect(progress).toEqual([42])
  })

  it('matches concurrent requests by id', async () => {
    const fake = new FakeWorker()
    const client = new WorkerClient(fake)
    const a = client.embed('a') // id 1
    const b = client.embed('b') // id 2
    fake.emit({ id: 2, type: 'RESULT', vector: new Float32Array([2]) })
    fake.emit({ id: 1, type: 'RESULT', vector: new Float32Array([1]) })
    expect(Array.from(await a)).toEqual([1])
    expect(Array.from(await b)).toEqual([2])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- worker-client`
Expected: FAIL — `WorkerClient` is not defined.

- [ ] **Step 3: Create `app/src/lib/worker-client.ts`**

```ts
import type { WorkerRequest, WorkerResponse, ResultMessage } from './ai-worker-protocol'

/** Minimal structural type so tests can supply a fake worker. */
export interface WorkerLike {
  postMessage(message: unknown): void
  onmessage: ((ev: { data: WorkerResponse }) => void) | null
}

type ProgressFn = (p: { file: string; progress: number }) => void

interface Pending {
  resolve: (r: ResultMessage) => void
  reject: (e: Error) => void
  onProgress?: ProgressFn
}

export class WorkerClient {
  private nextId = 1
  private pending = new Map<number, Pending>()

  constructor(private worker: WorkerLike) {
    this.worker.onmessage = (ev) => this.dispatch(ev.data)
  }

  private dispatch(res: WorkerResponse) {
    const p = this.pending.get(res.id)
    if (!p) return
    if (res.type === 'PROGRESS') {
      p.onProgress?.({ file: res.file, progress: res.progress })
      return
    }
    this.pending.delete(res.id)
    if (res.type === 'ERROR') {
      p.reject(new Error(res.error))
      return
    }
    p.resolve(res)
  }

  private request(req: Omit<WorkerRequest, 'id'>, onProgress?: ProgressFn): Promise<ResultMessage> {
    const id = this.nextId++
    return new Promise<ResultMessage>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress })
      this.worker.postMessage({ ...req, id } as WorkerRequest)
    })
  }

  async transcribe(audio: Float32Array, onProgress?: ProgressFn): Promise<string> {
    const res = await this.request({ type: 'TRANSCRIBE', audio }, onProgress)
    return res.text ?? ''
  }

  async embed(text: string, onProgress?: ProgressFn): Promise<Float32Array> {
    const res = await this.request({ type: 'EMBED', text }, onProgress)
    return res.vector ?? new Float32Array()
  }
}

let singleton: WorkerClient | null = null

/** Lazily creates the real worker-backed client (not used in unit tests). */
export function getAiWorker(): WorkerClient {
  if (!singleton) {
    const worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' })
    singleton = new WorkerClient(worker as unknown as WorkerLike)
  }
  return singleton
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- worker-client`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/worker-client.ts app/src/lib/worker-client.test.ts
git commit -m "feat(worker): add WorkerClient with id-matched request/response

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Worker entry + embeddings wrapper (real models)

**Files:**
- Create: `app/src/lib/ai-worker.ts`
- Create: `app/src/lib/embeddings.ts`

These load real transformers.js models, so they are verified manually (Step 4), not in CI. The protocol they depend on is already covered by Tasks 3–4.

- [ ] **Step 1: Create `app/src/lib/ai-worker.ts`**

```ts
import { pipeline, env } from '@xenova/transformers'
import { createAiWorkerHandler } from './ai-worker-handler'
import type { WorkerRequest } from './ai-worker-protocol'

// Always fetch models from the HuggingFace CDN (one-time download, then cached).
env.allowLocalModels = false

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null

async function getTranscriber() {
  if (!transcriber) {
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en')
  }
  return transcriber
}

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  return embedder
}

const handle = createAiWorkerHandler({
  transcribe: async (audio) => {
    const t = await getTranscriber()
    const out = await t(audio, { chunk_length_s: 30, stride_length_s: 5 })
    return out.text as string
  },
  embed: async (text) => {
    const e = await getEmbedder()
    const out = await e(text, { pooling: 'mean', normalize: true })
    return out.data as Float32Array
  },
})

// Annotate as a plain MessageEvent and cast `.data` — avoids needing the
// WebWorker lib in tsconfig (where `self` would otherwise type as Window).
self.onmessage = (ev: MessageEvent) => {
  void handle(ev.data as WorkerRequest, (res) => (self as unknown as Worker).postMessage(res))
}
```

- [ ] **Step 2: Create `app/src/lib/embeddings.ts`**

```ts
import { getAiWorker } from './worker-client'

/** Returns a 384-dim normalized embedding for `text` (MiniLM-L6, on-device). */
export async function embed(text: string): Promise<Float32Array> {
  return getAiWorker().embed(text)
}
```

- [ ] **Step 3: Run the build to confirm it compiles**

Run from `app/`: `npm run build`
Expected: `tsc -b` and `vite build` both succeed (the worker is bundled).

- [ ] **Step 4: Manual smoke test of the worker**

Add a temporary line at the bottom of `app/src/main.tsx`:
```ts
import { embed } from './lib/embeddings'
;(window as unknown as { __embed: typeof embed }).__embed = embed
```
Run `npm run dev`, open the app, then in the browser console:
```js
const v = await window.__embed('hello world'); console.log(v.length, v.slice(0, 3))
```
Expected: first call downloads the MiniLM model (network tab shows HF fetch), then logs `384` and three float values. **Remove the temporary lines from `main.tsx` afterward.**

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/ai-worker.ts app/src/lib/embeddings.ts
git commit -m "feat(worker): wire real Whisper + MiniLM models in the AI worker

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Chunked near-live STT (`stt.ts`)

**Files:**
- Replace: `app/src/lib/stt.ts`

Replaces the mock. Uses `MediaRecorder` to capture audio, decodes the accumulated buffer every ~8 s at 16 kHz mono, sends it to the worker for a cumulative partial transcript, and on stop returns one authoritative transcript plus the audio blob. Real-device behavior is verified in Task 8.

- [ ] **Step 1: Replace `app/src/lib/stt.ts`**

```ts
import { getAiWorker } from './worker-client'

export interface SttPartial {
  text: string
}

const PARTIAL_INTERVAL_MS = 8000
const SAMPLE_RATE = 16000

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let audioCtx: AudioContext | null = null
let chunks: Blob[] = []
let partialTimer: ReturnType<typeof setInterval> | null = null

/** Decodes accumulated webm chunks to 16 kHz mono Float32 PCM. */
async function decodeAccumulated(): Promise<Float32Array | null> {
  if (!audioCtx || chunks.length === 0) return null
  const blob = new Blob(chunks, { type: 'audio/webm' })
  const buf = await blob.arrayBuffer()
  // decodeAudioData detaches its input buffer, so pass a copy.
  const decoded = await audioCtx.decodeAudioData(buf.slice(0))
  return new Float32Array(decoded.getChannelData(0))
}

export const stt = {
  /** Start recording. `onPartial` fires roughly every 8s with the cumulative transcript. */
  async start(onPartial: (p: SttPartial) => void): Promise<void> {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
    chunks = []
    recorder = new MediaRecorder(stream)
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.start(1000) // emit a chunk every second

    partialTimer = setInterval(async () => {
      if (!recorder || recorder.state !== 'recording') return
      try {
        const audio = await decodeAccumulated()
        if (audio && audio.length > 0) {
          const text = await getAiWorker().transcribe(audio)
          onPartial({ text })
        }
      } catch {
        // A mid-stream decode can fail; ignore and retry on the next tick.
      }
    }, PARTIAL_INTERVAL_MS)
  },

  /** Stop recording; returns the authoritative full-pass transcript and the audio blob. */
  async stop(): Promise<{ transcript: string; audioBlob: Blob }> {
    if (partialTimer) {
      clearInterval(partialTimer)
      partialTimer = null
    }
    const audioBlob = await new Promise<Blob>((resolve) => {
      if (!recorder) return resolve(new Blob([], { type: 'audio/webm' }))
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }))
      recorder.stop()
      stream?.getTracks().forEach((t) => t.stop())
    })

    let transcript = ''
    const audio = await decodeAccumulated()
    if (audio && audio.length > 0) {
      transcript = await getAiWorker().transcribe(audio)
    }

    await audioCtx?.close()
    recorder = null
    stream = null
    audioCtx = null
    chunks = []
    return { transcript: transcript.trim(), audioBlob }
  },
}
```

- [ ] **Step 2: Run the build to confirm it compiles**

Run from `app/`: `npm run build`
Expected: success. (Note: `App.tsx` still references the old `stt` API at this point and is fixed in Task 7 — if `tsc` flags `App.tsx` here, that is expected and resolved next.)

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/stt.ts
git commit -m "feat(stt): replace mock with chunked on-device Whisper transcription

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire the Record tab + timeline replay (`App.tsx`)

**Files:**
- Modify: `app/src/App.tsx`

Fixes the save race (saves the transcript **returned by `stop()`**, not React state), embeds before saving, and adds offline audio replay in the timeline. Leaves the Query tab and `Demo` untouched (Phase B/C).

- [ ] **Step 1: Update the imports**

In `app/src/App.tsx`, change the STT import and add the embeddings import. Replace:
```ts
import { stt } from './lib/stt'
```
with:
```ts
import { stt } from './lib/stt'
import { embed } from './lib/embeddings'
```

- [ ] **Step 2: Replace `handleRecordToggle`**

Replace the existing `handleRecordToggle` function with:
```tsx
  const handleRecordToggle = async () => {
    if (isRecording) {
      const { transcript, audioBlob } = await stt.stop()
      setIsRecording(false)
      setCurrentTranscript(transcript)

      if (transcript) {
        const embedding = await embed(transcript)
        await saveMemo({
          timestamp: Date.now(),
          transcript,
          embedding,
          audioBlob,
        })
        loadHistory()
      }
    } else {
      setCurrentTranscript('')
      setIsRecording(true)
      await stt.start((result) => {
        setCurrentTranscript(result.text)
      })
    }
  }
```

- [ ] **Step 3: Add audio replay to the timeline memo items**

In the timeline `.map((memo) => ...)` block, add an audio element after the transcript paragraph. Replace the memo item block:
```tsx
                <div key={memo.id} className="memo-item">
                  <span className="memo-date">
                    {new Date(memo.timestamp).toLocaleTimeString()}
                  </span>
                  <p className="memo-text">{memo.transcript}</p>
                </div>
```
with:
```tsx
                <div key={memo.id} className="memo-item">
                  <span className="memo-date">
                    {new Date(memo.timestamp).toLocaleTimeString()}
                  </span>
                  <p className="memo-text">{memo.transcript}</p>
                  {memo.audioBlob && (
                    <audio
                      className="memo-audio"
                      controls
                      src={URL.createObjectURL(memo.audioBlob)}
                    />
                  )}
                </div>
```

- [ ] **Step 4: Run the build**

Run from `app/`: `npm run build`
Expected: `tsc -b` and `vite build` succeed with no errors.

- [ ] **Step 5: Run the full test suite**

Run from `app/`: `npm test`
Expected: PASS — sanity (2), storage (4), ai-worker-handler (4), worker-client (5).

- [ ] **Step 6: Commit**

```bash
git add app/src/App.tsx
git commit -m "feat(capture): wire record->embed->save with audio replay; fix save race

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Phase A acceptance (manual device test)

**Files:** none (verification + checklist).

- [ ] **Step 1: Build and serve**

Run from `app/`:
```bash
npm run build && npm run preview
```
Open the printed URL in Chrome (desktop is fine for first pass; phone per the STATUS acceptance criteria).

- [ ] **Step 2: Walk the capture flow**

Verify each, in order:
1. On the **Record** tab, tap **Record** → browser asks for mic permission → grant.
2. Speak for ~15–20 s. Within ~8 s, partial text appears in the live transcript area.
3. Tap **Stop**. Status settles; the final transcript is saved.
4. The memo appears under **Recent Memories** with a timestamp.
5. The memo has an audio player; pressing play replays the clip.
6. Switch to the **Timeline** tab → the memo is listed there too.
7. Reload the page (still offline-capable) → the memo persists (IndexedDB).

- [ ] **Step 3: Confirm no cloud calls during transcription**

With DevTools → Network open during a recording: after the initial one-time model downloads from the HuggingFace CDN, **no audio is uploaded anywhere** during Stop/transcribe. (This guards Hard Constraint #1.)

- [ ] **Step 4: Record the result in STATUS.md**

Update `STATUS.md` Phase 2 line to ✅ with the date, and note any device quirks observed (e.g., partial-transcript flicker, decode latency).

- [ ] **Step 5: Commit**

```bash
git add STATUS.md
git commit -m "docs(status): Phase A capture lane verified on-device

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase A Definition of Done

- `npm test` green (15 tests across 4 files).
- `npm run build` green (typecheck + production bundle).
- Manual: record → near-live partials → stop → transcript + audio saved → persists across reload → replays offline.
- No audio leaves the device during transcription (only one-time model downloads).
- `STATUS.md` Phase 2 marked ✅.

## What Phase A intentionally does NOT do (later phases)

- **Query / RAG / Gemma 4 answers / TTS** → Phase B (includes the Gemma-4-load OPFS/WebGPU spike).
- **Public demo lane** + the `Demo.tsx` / synthetic-data employer-reference audit → Phase C.
- **Weekly LoRA training + hot-swap** → Phase D.
- **OPFS model store, WebGPU detection, model-download gate** → Phase B (not needed for capture).
