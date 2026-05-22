# VoiceMemory Phase B — Query Lane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ask a question (typed or voice) → embed it → cosine-RAG over stored memos → answer it on-device with Gemma 4 (streamed) → speak the answer and show citations — all on-device, no cloud in the hot path.

**Architecture:** A second Web Worker (`llm-worker`) hosts MediaPipe `tasks-genai` `LlmInference`, loading the Gemma 4 `.task` model from **OPFS** (downloaded once via `model-store`) as a `modelAssetBuffer`. `inference.ts` is the streaming client to that worker. RAG becomes real cosine similarity over the `embedding` field added in Phase A (reusing the Phase A `embeddings.embed`). The Query tab streams tokens to the UI and to Web Speech TTS. A `ModelDownloadGate` handles first-run WebGPU detection + model download with progress, with a Chromebook-fallback message when WebGPU is absent.

**Tech Stack:** React 19, Vite 8, TypeScript, `@mediapipe/tasks-genai` (Gemma 4 + WebGPU), OPFS, Web Speech API, `@xenova/transformers` (MiniLM, from Phase A), `vitest`.

**Branch:** `phase-b-query` (stacked on Phase A's `9345fde`; PR will target the Phase A branch / `main`). All paths are relative to the worktree root; the app is in `app/`.

**Commit trailer (every commit):** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## CRITICAL git guardrails (carried from Phase A — a confused agent once contaminated the wrong repo)

Every implementer/fix subagent MUST:
1. First run `git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session branch --show-current` and confirm it prints **`phase-b-query`**. If not, STOP and report BLOCKED.
2. Do ALL git ops via `git -C <that worktree path> …`. NEVER touch the parent repo `/home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory`.
3. Allowed git: `rev-parse`, `branch --show-current`, `status`, `log`, `diff`, `add <specific files>`, `commit`. FORBIDDEN: `checkout`, `reset`, `stash`, `branch <new>`, `rebase`, `restore`, `switch`, any commit on `main`. If tempted, STOP/BLOCKED.
4. Only `git add` the exact files named in each commit step. Never `git add -A`/`.`. Never add `dist/`.
5. Prettier auto-formats on save (single→double quotes) — expected.

## Lesson from Phase A baked into gates

`npm test` (vitest/esbuild) does NOT typecheck. **Every task that changes a `.ts`/`.tsx` file MUST run `npm run build` (`tsc -b && vite build`) as its gate, not just `npm test`.** A green `npm test` with a red `npm run build` is a failure.

---

## File structure (Phase B)

| File | Responsibility |
|---|---|
| `app/src/lib/model-store.ts` | **Create.** WebGPU detection; OPFS download-once (streamed + progress); read model bytes back as `Uint8Array`. |
| `app/src/lib/gemma-prompt.ts` | **Create.** Pure: build the Gemma 4 prompt string from (query, context). |
| `app/src/lib/rag.ts` | **Modify.** Add pure `cosineSimilarity` + `retrieve(queryVec, memos, k)`; remove keyword `retrieveRelevantContext` in Task 6. |
| `app/src/lib/tts.ts` | **Create.** Web Speech `speak`/`cancel`. |
| `app/src/lib/llm-worker.ts` | **Create.** Worker entry: MediaPipe `LlmInference` from OPFS bytes; streaming generate. |
| `app/src/lib/inference.ts` | **Replace.** Streaming client to `llm-worker` (`init`, `generateResponse(query, context, onToken)`). |
| `app/src/components/ModelDownloadGate.tsx` | **Create.** First-run WebGPU check + model download UI (progress) + Chromebook fallback. |
| `app/src/pages/Spike.tsx` | **Create (Task 1), DELETE in Task 7.** Dev-only de-risk harness. |
| `app/src/App.tsx` | **Modify.** Query tab: embed → retrieve → stream answer → TTS + citations; mount `ModelDownloadGate`. |
| `app/src/lib/*.test.ts` | **Create.** Unit tests for the pure/logic layer. |

**Model config (single source of truth), used by `model-store.ts`:**
```ts
// E2B = phone-appropriate; E4B = Chromebook fallback (bigger, possibly more stable). Confirmed by Task 1.
export const GEMMA_VARIANTS = {
  E2B: {
    url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task',
    file: 'gemma-4-E2B-it-web.task',
  },
  E4B: {
    url: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.task',
    file: 'gemma-4-E4B-it-web.task',
  },
} as const
export type GemmaVariant = keyof typeof GEMMA_VARIANTS
```
(Task 1 confirms the exact resolvable URLs and which variant the demo/device tolerates.)

---

## Task 1 — On-device de-risk SPIKE (manual gate) ⚠️

**Purpose:** Before building the full lane, prove on a real device that Gemma 4 (E2B) downloads to OPFS, loads into MediaPipe via `modelAssetBuffer`, and produces coherent streamed output with our hand-formatted prompt — and measure size / latency / `mediapipe#6270` exposure. **This is a manual gate the human runs; a headless subagent cannot exercise WebGPU.**

**Files:**
- Create: `app/src/lib/model-store.ts`
- Create: `app/src/lib/model-store.test.ts`
- Create: `app/src/pages/Spike.tsx`
- Modify: `app/src/App.tsx` (mount `Spike` behind a `?spike` query param)

- [ ] **Step 1: Write the failing test `app/src/lib/model-store.test.ts`** (only the pure parts are unit-testable):

```ts
import { describe, it, expect } from 'vitest'
import { GEMMA_VARIANTS, isWebGPUAvailable } from './model-store'

describe('model-store pure parts', () => {
  it('exposes E2B and E4B variant configs with a url and file name', () => {
    expect(GEMMA_VARIANTS.E2B.file).toMatch(/E2B.*\.task$/)
    expect(GEMMA_VARIANTS.E4B.file).toMatch(/E4B.*\.task$/)
    expect(GEMMA_VARIANTS.E2B.url).toContain('huggingface.co')
  })

  it('isWebGPUAvailable returns false when navigator.gpu is absent', async () => {
    const original = (navigator as unknown as { gpu?: unknown }).gpu
    delete (navigator as unknown as { gpu?: unknown }).gpu
    expect(await isWebGPUAvailable()).toBe(false)
    if (original !== undefined) (navigator as unknown as { gpu?: unknown }).gpu = original
  })
})
```

- [ ] **Step 2: Run to verify it fails.** `cd app && npm test -- model-store`. Expected FAIL: module not found.

- [ ] **Step 3: Create `app/src/lib/model-store.ts`:**

```ts
export const GEMMA_VARIANTS = {
  E2B: {
    url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task',
    file: 'gemma-4-E2B-it-web.task',
  },
  E4B: {
    url: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.task',
    file: 'gemma-4-E4B-it-web.task',
  },
} as const
export type GemmaVariant = keyof typeof GEMMA_VARIANTS

const MODEL_DIR = 'models'

export interface DownloadProgress {
  loadedBytes: number
  totalBytes: number
}

/** True only if the browser exposes a usable WebGPU adapter. */
export async function isWebGPUAvailable(): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
  if (!gpu) return false
  try {
    const adapter = await gpu.requestAdapter()
    return adapter != null
  } catch {
    return false
  }
}

async function modelDir() {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(MODEL_DIR, { create: true })
}

/** Has this variant already been downloaded to OPFS? */
export async function isModelCached(variant: GemmaVariant): Promise<boolean> {
  try {
    const dir = await modelDir()
    await dir.getFileHandle(GEMMA_VARIANTS[variant].file)
    return true
  } catch {
    return false
  }
}

/** Download the model to OPFS once (streamed, with progress). No-op if already cached. */
export async function downloadModel(
  variant: GemmaVariant,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  if (await isModelCached(variant)) return
  const { url, file } = GEMMA_VARIANTS[variant]
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Model download failed: HTTP ${res.status}`)
  const totalBytes = Number(res.headers.get('content-length') ?? 0)

  const dir = await modelDir()
  const handle = await dir.getFileHandle(file, { create: true })
  const writable = await handle.createWritable()
  const reader = res.body.getReader()
  let loadedBytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      await writable.write(value)
      loadedBytes += value.byteLength
      onProgress?.({ loadedBytes, totalBytes })
    }
  } finally {
    await writable.close()
  }
}

/** Read the cached model back as bytes for MediaPipe's `modelAssetBuffer`. */
export async function getModelBytes(variant: GemmaVariant): Promise<Uint8Array> {
  const dir = await modelDir()
  const handle = await dir.getFileHandle(GEMMA_VARIANTS[variant].file)
  const fileObj = await handle.getFile()
  return new Uint8Array(await fileObj.arrayBuffer())
}
```

- [ ] **Step 4: Run to verify the pure tests pass.** `cd app && npm test -- model-store`. Expected PASS, 2 tests.

- [ ] **Step 5: Create `app/src/pages/Spike.tsx`** (dev-only harness — wires the real model end-to-end with a hand-formatted Gemma prompt):

```tsx
import { useState } from 'react'
import { LlmInference, FilesetResolver } from '@mediapipe/tasks-genai'
import { downloadModel, getModelBytes, isWebGPUAvailable, type GemmaVariant } from '../lib/model-store'

export default function Spike() {
  const [log, setLog] = useState<string[]>([])
  const [variant, setVariant] = useState<GemmaVariant>('E2B')
  const append = (s: string) => setLog((l) => [...l, s])

  const run = async () => {
    setLog([])
    const t0 = performance.now()
    append(`WebGPU available: ${await isWebGPUAvailable()}`)
    append(`Downloading ${variant} to OPFS…`)
    await downloadModel(variant, ({ loadedBytes, totalBytes }) =>
      append(`  ${(loadedBytes / 1e6).toFixed(0)} / ${(totalBytes / 1e6).toFixed(0)} MB`),
    )
    const bytes = await getModelBytes(variant)
    append(`Model bytes: ${(bytes.byteLength / 1e6).toFixed(0)} MB. Loading MediaPipe…`)

    const fileset = await FilesetResolver.forGenAiTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm',
    )
    const llm = await LlmInference.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: bytes },
      maxTokens: 256,
      topK: 40,
      temperature: 0.7,
    })
    append(`Loaded in ${((performance.now() - t0) / 1000).toFixed(1)}s. Generating…`)

    const prompt =
      '<start_of_turn>user\nAnswer in one sentence: what is on-device AI?<end_of_turn>\n<start_of_turn>model\n'
    const tGen = performance.now()
    let last = ''
    let tokens = 0
    const final = await llm.generateResponse(prompt, (partial: string) => {
      const delta = partial.slice(last.length)
      last = partial
      if (delta) {
        tokens += 1
        append(`token: ${delta}`)
      }
    })
    const secs = (performance.now() - tGen) / 1000
    append(`DONE in ${secs.toFixed(1)}s (~${(tokens / secs).toFixed(1)} tok/s)`) 
    append(`FINAL: ${final}`)
  }

  return (
    <div style={{ padding: 16, fontFamily: 'monospace' }}>
      <h2>Gemma 4 spike</h2>
      <select value={variant} onChange={(e) => setVariant(e.target.value as GemmaVariant)}>
        <option value="E2B">E2B</option>
        <option value="E4B">E4B</option>
      </select>
      <button onClick={run} style={{ marginLeft: 8 }}>Run spike</button>
      <pre>{log.join('\n')}</pre>
    </div>
  )
}
```

- [ ] **Step 6: Mount the spike behind `?spike` in `app/src/App.tsx`.** At the top of the `App` component body, add an early return. Find:
```tsx
function App() {
```
Insert immediately after the opening brace:
```tsx
  if (window.location.search.includes('spike')) {
    const Spike = lazy(() => import('./pages/Spike'))
    return (
      <Suspense fallback={<p>Loading spike…</p>}>
        <Spike />
      </Suspense>
    )
  }
```
And add to the React import at the top of the file (find `import { useState, useEffect } from 'react'` and replace):
```tsx
import { useState, useEffect, lazy, Suspense } from 'react'
```

- [ ] **Step 7: Build gate.** `cd app && npm run build`. MUST pass. Then `npm test` — 17 tests (15 + 2 model-store).

- [ ] **Step 8: Commit (worktree):**
```bash
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session add app/src/lib/model-store.ts app/src/lib/model-store.test.ts app/src/pages/Spike.tsx app/src/App.tsx
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session commit -m "feat(model-store): OPFS download-once + WebGPU detect + Gemma 4 spike harness

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 9: MANUAL GATE (human runs on a real device).** `cd app && npm run dev`, open `<url>?spike` in Chrome (desktop/Chromebook first; then iOS Safari if testing the fallback). Click **Run spike** with **E2B**. Record:
  - WebGPU available? Model download size (MB)? Load time? Tokens/sec? Coherent answer?
  - Any `RuntimeError: memory access out of bounds` (`mediapipe#6270`)? If E2B crashes, try **E4B**.
  - **Decision:** confirm the working `{variant, prompt-format}` before proceeding. If neither variant loads on any available device → STOP and revisit the design (Chromebook-only? different model). Tasks 5–6 assume the spike-confirmed variant + that the `<start_of_turn>` prompt produces coherent output.

---

## Task 2 — RAG: cosine retrieval (pure, TDD)

**Files:**
- Modify: `app/src/lib/rag.ts`
- Create: `app/src/lib/rag.test.ts`

Adds pure functions; leaves the existing `retrieveRelevantContext` in place so `App.tsx` keeps building (it's removed in Task 6).

- [ ] **Step 1: Write `app/src/lib/rag.test.ts`:**

```ts
import { describe, it, expect } from 'vitest'
import { cosineSimilarity, retrieve } from './rag'
import type { VoiceMemo } from './storage'

function memo(transcript: string, embedding: number[], timestamp = 1): VoiceMemo {
  return { transcript, embedding: new Float32Array(embedding), timestamp }
}

describe('cosineSimilarity', () => {
  it('is 1 for identical direction, 0 for orthogonal', () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([2, 0]))).toBeCloseTo(1)
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0)
  })
  it('returns 0 when either vector is zero-length', () => {
    expect(cosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 1]))).toBe(0)
  })
})

describe('retrieve', () => {
  const query = new Float32Array([1, 0])
  const memos = [
    memo('aligned', [1, 0]),
    memo('orthogonal', [0, 1]),
    memo('opposite', [-1, 0]),
  ]
  it('ranks by cosine similarity and returns top-k citations', () => {
    const { citations } = retrieve(query, memos, 2)
    expect(citations.map((m) => m.transcript)).toEqual(['aligned', 'orthogonal'])
  })
  it('builds a numbered context string from the citations', () => {
    const { context } = retrieve(query, memos, 1)
    expect(context).toContain('[1]')
    expect(context).toContain('aligned')
  })
  it('returns a no-memories message when there are no memos', () => {
    const { context, citations } = retrieve(query, [], 5)
    expect(citations).toHaveLength(0)
    expect(context).toMatch(/no relevant memories/i)
  })
})
```

- [ ] **Step 2: Run to verify it fails.** `cd app && npm test -- rag`. Expected FAIL: `cosineSimilarity`/`retrieve` not exported.

- [ ] **Step 3: Edit `app/src/lib/rag.ts` — add these exports (keep the existing `retrieveRelevantContext` and its imports):**

```ts
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function retrieve(
  queryVec: Float32Array,
  memos: VoiceMemo[],
  k = 5,
): { context: string; citations: VoiceMemo[] } {
  const ranked = memos
    .map((memo) => ({ memo, score: cosineSimilarity(queryVec, memo.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => r.memo)

  const context = ranked.length
    ? ranked
        .map((m, i) => `[${i + 1}] Captured ${new Date(m.timestamp).toLocaleString()}: ${m.transcript}`)
        .join('\n\n')
    : 'No relevant memories found.'

  return { context, citations: ranked }
}
```
(If `VoiceMemo` is not already imported in `rag.ts`, ensure `import type { VoiceMemo } from './storage'` is present.)

- [ ] **Step 4: Run to verify it passes.** `cd app && npm test -- rag`. Expected PASS (5 tests).

- [ ] **Step 5: Build gate.** `cd app && npm run build`. MUST pass.

- [ ] **Step 6: Commit:**
```bash
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session add app/src/lib/rag.ts app/src/lib/rag.test.ts
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session commit -m "feat(rag): add cosine similarity retrieval over embeddings

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — Gemma 4 prompt builder (pure, TDD)

**Files:**
- Create: `app/src/lib/gemma-prompt.ts`
- Create: `app/src/lib/gemma-prompt.test.ts`

Format confirmed by the Task 1 spike: a single `user` turn carrying the instruction + retrieved context + question, then an open `model` turn. (Gemma has no separate system role.)

- [ ] **Step 1: Write `app/src/lib/gemma-prompt.test.ts`:**

```ts
import { describe, it, expect } from 'vitest'
import { buildGemmaPrompt } from './gemma-prompt'

describe('buildGemmaPrompt', () => {
  const p = buildGemmaPrompt('What did I say about X?', '[1] I said X is good.')
  it('wraps a single user turn and opens a model turn', () => {
    expect(p).toContain('<start_of_turn>user\n')
    expect(p.trimEnd()).toMatch(/<start_of_turn>model$/)
  })
  it('embeds the context and the question, and instructs memory-only answers', () => {
    expect(p).toContain('[1] I said X is good.')
    expect(p).toContain('What did I say about X?')
    expect(p.toLowerCase()).toContain('only')
  })
})
```

- [ ] **Step 2: Run to verify it fails.** `cd app && npm test -- gemma-prompt`. Expected FAIL.

- [ ] **Step 3: Create `app/src/lib/gemma-prompt.ts`:**

```ts
/**
 * Builds the Gemma 4 prompt for a RAG answer. MediaPipe expects the
 * hand-formatted turn string (verified by the Task 1 spike): one user turn
 * holding the instruction + retrieved context + question, then an open model turn.
 */
export function buildGemmaPrompt(query: string, context: string): string {
  const instruction =
    'You are VoiceMemory, the user’s personal memory assistant. ' +
    'Answer the question using ONLY the memories below. ' +
    'If the memories do not contain the answer, say you do not have a memory of it. ' +
    'Be concise.'
  return (
    '<start_of_turn>user\n' +
    `${instruction}\n\nMemories:\n${context}\n\nQuestion: ${query}<end_of_turn>\n` +
    '<start_of_turn>model\n'
  )
}
```

- [ ] **Step 4: Run to verify it passes.** `cd app && npm test -- gemma-prompt`. Expected PASS (2 tests).

- [ ] **Step 5: Build gate.** `cd app && npm run build`. MUST pass.

- [ ] **Step 6: Commit:**
```bash
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session add app/src/lib/gemma-prompt.ts app/src/lib/gemma-prompt.test.ts
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session commit -m "feat(inference): add Gemma 4 RAG prompt builder

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — TTS wrapper (TDD with a mock)

**Files:**
- Create: `app/src/lib/tts.ts`
- Create: `app/src/lib/tts.test.ts`

- [ ] **Step 1: Write `app/src/lib/tts.test.ts`:**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { speak, cancel } from './tts'

beforeEach(() => {
  vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn() })
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class { text: string; constructor(t: string) { this.text = t } },
  )
})

describe('tts', () => {
  it('speak() cancels any in-flight speech then speaks the text', () => {
    speak('hello world')
    expect(speechSynthesis.cancel).toHaveBeenCalledOnce()
    expect(speechSynthesis.speak).toHaveBeenCalledOnce()
    const utter = (speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(utter.text).toBe('hello world')
  })
  it('cancel() stops speech', () => {
    cancel()
    expect(speechSynthesis.cancel).toHaveBeenCalledOnce()
  })
  it('speak() with empty text does nothing', () => {
    speak('   ')
    expect(speechSynthesis.speak).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails.** `cd app && npm test -- tts`. Expected FAIL.

- [ ] **Step 3: Create `app/src/lib/tts.ts`:**

```ts
/** Speak text via the browser's on-device Web Speech API. Cancels any in-flight utterance first. */
export function speak(text: string): void {
  const trimmed = text.trim()
  if (!trimmed) return
  if (typeof speechSynthesis === 'undefined') return
  speechSynthesis.cancel()
  speechSynthesis.speak(new SpeechSynthesisUtterance(trimmed))
}

/** Stop any in-flight speech. */
export function cancel(): void {
  if (typeof speechSynthesis === 'undefined') return
  speechSynthesis.cancel()
}
```

- [ ] **Step 4: Run to verify it passes.** `cd app && npm test -- tts`. Expected PASS (3 tests).

- [ ] **Step 5: Build gate.** `cd app && npm run build`. MUST pass.

- [ ] **Step 6: Commit:**
```bash
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session add app/src/lib/tts.ts app/src/lib/tts.test.ts
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session commit -m "feat(tts): add on-device Web Speech wrapper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 — LLM worker + streaming inference client

**Depends on:** Task 1 spike confirming `modelAssetBuffer` load + `<start_of_turn>` prompt + working variant. **Real generation is verified on-device in Task 7; this task's gate is `npm run build` + a unit test of the streaming protocol with a fake worker.**

**Files:**
- Create: `app/src/lib/llm-worker.ts`
- Replace: `app/src/lib/inference.ts`
- Create: `app/src/lib/inference.test.ts`

- [ ] **Step 1: Create `app/src/lib/llm-worker.ts`** (worker entry — loads Gemma 4 from OPFS, streams tokens):

```ts
import { LlmInference, FilesetResolver } from '@mediapipe/tasks-genai'
import { getModelBytes, type GemmaVariant } from './model-store'
import { buildGemmaPrompt } from './gemma-prompt'

type InMsg =
  | { type: 'INIT'; variant: GemmaVariant }
  | { type: 'GENERATE'; id: number; query: string; context: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let llm: any = null
let initPromise: Promise<void> | null = null

async function doInit(variant: GemmaVariant) {
  const bytes = await getModelBytes(variant)
  const fileset = await FilesetResolver.forGenAiTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm',
  )
  llm = await LlmInference.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: bytes },
    maxTokens: 512,
    topK: 40,
    temperature: 0.7,
  })
}

/** Idempotent: starts init once and returns the same promise for concurrent callers. */
function ensureInit(variant: GemmaVariant) {
  if (!initPromise) initPromise = doInit(variant)
  return initPromise
}

const post = (m: unknown) => (self as unknown as Worker).postMessage(m)

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data as InMsg
  try {
    if (msg.type === 'INIT') {
      await ensureInit(msg.variant)
      post({ type: 'READY' })
    } else if (msg.type === 'GENERATE') {
      // A GENERATE can arrive while INIT's model load is still in flight; wait for it.
      if (!initPromise) throw new Error('LLM not initialized (INIT not sent)')
      await initPromise
      const prompt = buildGemmaPrompt(msg.query, msg.context)
      let last = ''
      const final: string = await llm.generateResponse(prompt, (partial: string) => {
        const delta = partial.slice(last.length)
        last = partial
        if (delta) post({ type: 'TOKEN', id: msg.id, text: delta })
      })
      post({ type: 'DONE', id: msg.id, text: final })
    }
  } catch (e) {
    post({ type: 'ERROR', id: (msg as { id?: number }).id ?? -1, error: e instanceof Error ? e.message : String(e) })
  }
}
```

- [ ] **Step 2: Write the failing test `app/src/lib/inference.test.ts`** (streaming client protocol via a fake worker):

```ts
import { describe, it, expect } from 'vitest'
import { InferenceClient } from './inference'
import type { LlmWorkerLike } from './inference'

class FakeWorker implements LlmWorkerLike {
  posted: unknown[] = []
  onmessage: ((ev: { data: unknown }) => void) | null = null
  postMessage(m: unknown) {
    this.posted.push(m)
  }
  emit(m: unknown) {
    this.onmessage?.({ data: m })
  }
}

describe('InferenceClient', () => {
  it('streams tokens then resolves with the final text', async () => {
    const fake = new FakeWorker()
    const client = new InferenceClient(fake)
    const tokens: string[] = []
    const promise = client.generateResponse('q', 'ctx', (t) => tokens.push(t))
    // first GENERATE message carries an id
    const sent = fake.posted[0] as { type: string; id: number }
    expect(sent.type).toBe('GENERATE')
    fake.emit({ type: 'TOKEN', id: sent.id, text: 'Hel' })
    fake.emit({ type: 'TOKEN', id: sent.id, text: 'lo' })
    fake.emit({ type: 'DONE', id: sent.id, text: 'Hello' })
    expect(await promise).toBe('Hello')
    expect(tokens).toEqual(['Hel', 'lo'])
  })

  it('rejects on ERROR for that id', async () => {
    const fake = new FakeWorker()
    const client = new InferenceClient(fake)
    const promise = client.generateResponse('q', 'ctx', () => {})
    const sent = fake.posted[0] as { id: number }
    fake.emit({ type: 'ERROR', id: sent.id, error: 'load failed' })
    await expect(promise).rejects.toThrow('load failed')
  })
})
```

- [ ] **Step 3: Run to verify it fails.** `cd app && npm test -- inference`. Expected FAIL: `InferenceClient` not exported.

- [ ] **Step 4: Replace `app/src/lib/inference.ts`:**

```ts
import type { GemmaVariant } from './model-store'

export interface LlmWorkerLike {
  postMessage(message: unknown): void
  onmessage: ((ev: { data: unknown }) => void) | null
}

type Pending = { resolve: (s: string) => void; reject: (e: Error) => void; onToken: (t: string) => void }

export class InferenceClient {
  private nextId = 1
  private pending = new Map<number, Pending>()
  private worker: LlmWorkerLike
  private ready = false

  constructor(worker: LlmWorkerLike) {
    this.worker = worker
    this.worker.onmessage = (ev) => this.dispatch(ev.data)
  }

  private dispatch(m: unknown) {
    const msg = m as { type: string; id?: number; text?: string; error?: string }
    if (msg.type === 'READY') {
      this.ready = true
      return
    }
    if (msg.id == null) return
    const p = this.pending.get(msg.id)
    if (!p) return
    if (msg.type === 'TOKEN') {
      p.onToken(msg.text ?? '')
    } else if (msg.type === 'DONE') {
      this.pending.delete(msg.id)
      p.resolve(msg.text ?? '')
    } else if (msg.type === 'ERROR') {
      this.pending.delete(msg.id)
      p.reject(new Error(msg.error ?? 'inference error'))
    }
  }

  init(variant: GemmaVariant) {
    if (!this.ready) this.worker.postMessage({ type: 'INIT', variant })
  }

  generateResponse(query: string, context: string, onToken: (t: string) => void): Promise<string> {
    const id = this.nextId++
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onToken })
      this.worker.postMessage({ type: 'GENERATE', id, query, context })
    })
  }
}

let singleton: InferenceClient | null = null

/** Lazily creates the real llm-worker-backed client (not used in unit tests). */
export function getInference(): InferenceClient {
  if (!singleton) {
    const worker = new Worker(new URL('./llm-worker.ts', import.meta.url), { type: 'module' })
    singleton = new InferenceClient(worker as unknown as LlmWorkerLike)
  }
  return singleton
}
```
NOTE: this replaces the old scaffold `inference.ts` (which exported `inference.generateResponse(prompt, context): Promise<string>` and `loadLoRAAdapter`). `Demo.tsx` still imports the old `inference` — Task 6 leaves `Demo.tsx` for Phase C, so add a temporary compatibility export at the bottom of `inference.ts` to keep the build green:
```ts
// TEMP shim so the Phase C Demo page keeps compiling until it is reworked in Phase C.
export const inference = {
  async generateResponse(prompt: string, _context: string): Promise<string> {
    void _context
    return `(demo placeholder) ${prompt}`
  },
}
```

- [ ] **Step 5: Run to verify it passes.** `cd app && npm test -- inference`. Expected PASS (2 tests).

- [ ] **Step 6: Build gate.** `cd app && npm run build`. MUST pass (llm-worker bundles; `Demo.tsx` still compiles via the shim).

- [ ] **Step 7: Commit:**
```bash
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session add app/src/lib/llm-worker.ts app/src/lib/inference.ts app/src/lib/inference.test.ts
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session commit -m "feat(inference): MediaPipe Gemma 4 worker + streaming client

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 — Query UI + ModelDownloadGate (App.tsx)

**Files:**
- Create: `app/src/components/ModelDownloadGate.tsx`
- Modify: `app/src/App.tsx`

Wires the Query tab to the real on-device pipeline and gates inference behind a one-time model download. Uses the spike-confirmed variant (default `E2B`).

- [ ] **Step 1: Create `app/src/components/ModelDownloadGate.tsx`:**

```tsx
import { useEffect, useState } from 'react'
import { downloadModel, isModelCached, isWebGPUAvailable, type GemmaVariant } from '../lib/model-store'
import { getInference } from '../lib/inference'

const VARIANT: GemmaVariant = 'E2B' // Chromebook can switch to 'E4B' (Task 1 spike)

type State = 'checking' | 'no-webgpu' | 'needs-download' | 'downloading' | 'ready'

export default function ModelDownloadGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>('checking')
  const [pct, setPct] = useState(0)

  useEffect(() => {
    void (async () => {
      if (!(await isWebGPUAvailable())) return setState('no-webgpu')
      setState((await isModelCached(VARIANT)) ? 'ready' : 'needs-download')
    })()
  }, [])

  useEffect(() => {
    if (state === 'ready') getInference().init(VARIANT)
  }, [state])

  const download = async () => {
    setState('downloading')
    try {
      await downloadModel(VARIANT, ({ loadedBytes, totalBytes }) =>
        setPct(totalBytes ? Math.round((loadedBytes / totalBytes) * 100) : 0),
      )
      setState('ready')
    } catch {
      setState('needs-download')
    }
  }

  if (state === 'ready') return <>{children}</>
  if (state === 'checking') return <p className="status-text">Checking device…</p>
  if (state === 'no-webgpu')
    return (
      <p className="status-text">
        On-device AI needs WebGPU, which this browser doesn’t support. Try Chrome on a laptop/Chromebook.
        Recording and your timeline still work.
      </p>
    )
  if (state === 'downloading') return <p className="status-text">Downloading on-device model… {pct}%</p>
  return (
    <div className="card">
      <p className="status-text">A one-time on-device AI model download is needed to answer questions.</p>
      <button className="record-btn" onClick={download}>Download model</button>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the Query handler + imports in `app/src/App.tsx`.**

Replace the imports block. Find:
```tsx
import { retrieveRelevantContext } from './lib/rag'
import { inference } from './lib/inference'
```
Replace with:
```tsx
import { retrieve } from './lib/rag'
import { getInference } from './lib/inference'
import { embed } from './lib/embeddings'
import { speak } from './lib/tts'
import ModelDownloadGate from './components/ModelDownloadGate'
```
(Note: `embed` may already be imported from Phase A — if so, do not duplicate the import.)

Replace the entire `handleQuery` function with:
```tsx
  const handleQuery = async () => {
    if (!query.trim() || isAnswering) return
    setIsAnswering(true)
    setAnswer('Searching memories…')
    setCitations([])
    try {
      const queryVec = await embed(query)
      const memos = await getAllMemos()
      const { context, citations } = retrieve(queryVec, memos, 5)
      setCitations(citations)
      setAnswer('')
      let acc = ''
      const final = await getInference().generateResponse(query, context, (token) => {
        acc += token
        setAnswer(acc)
      })
      setAnswer(final)
      speak(final)
    } catch (error) {
      console.error('Query failed:', error)
      setAnswer('Sorry, I hit an error answering from your memories.')
    } finally {
      setIsAnswering(false)
    }
  }
```

- [ ] **Step 3: Wrap the Query tab content with the gate.** Find the line that renders the query view:
```tsx
      {activeTab === 'query' && (
        <main className="card query-view">
```
Replace with:
```tsx
      {activeTab === 'query' && (
        <ModelDownloadGate>
        <main className="card query-view">
```
and find the matching close of that `<main>` block (the `</main>` that ends the query view, immediately before `)}`) and replace:
```tsx
        </main>
      )}

      {activeTab === 'demo' && <Demo />}
```
with:
```tsx
        </main>
        </ModelDownloadGate>
      )}

      {activeTab === 'demo' && <Demo />}
```

- [ ] **Step 4: Build gate.** `cd app && npm run build`. MUST pass (this confirms `retrieveRelevantContext` is no longer referenced and the new wiring typechecks). If `tsc` reports `retrieveRelevantContext` is now unused in `rag.ts`, remove that function and its now-unused imports from `rag.ts` and rebuild.

- [ ] **Step 5: Tests.** `cd app && npm test`. Expected: all green (22 tests: 15 Phase A + 2 model-store + 5 rag + 2 gemma-prompt + 3 tts + 2 inference — note rag total is 5, adjust count to actual).

- [ ] **Step 6: Commit:**
```bash
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session add app/src/components/ModelDownloadGate.tsx app/src/App.tsx app/src/lib/rag.ts
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session commit -m "feat(query): wire embed->cosine RAG->Gemma 4 stream->TTS with model-download gate

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 — Phase B acceptance (manual) + cleanup

**Files:**
- Delete: `app/src/pages/Spike.tsx` and its `?spike` branch in `App.tsx`
- Modify: `STATUS.md`

- [ ] **Step 1: Remove the spike.** Delete `app/src/pages/Spike.tsx`. In `app/src/App.tsx`, remove the `if (window.location.search.includes('spike')) { … }` block; if `lazy`/`Suspense` are now unused, revert the React import to `import { useState, useEffect } from 'react'`.

- [ ] **Step 2: Build + tests.** `cd app && npm run build` (green) and `npm test` (green).

- [ ] **Step 3: MANUAL on-device acceptance** (`npm run build && npm run preview`, Chrome with WebGPU):
  1. Record 2–3 short memos (Phase A flow).
  2. Go to **Query**, accept the one-time model download (progress shows), wait for ready.
  3. Ask a question answerable from a memo → answer **streams** in, a **citation** chip shows the source memo, and the answer is **spoken** via TTS.
  4. Ask something not in memory → model says it has no memory of it.
  5. DevTools → Network: confirm **no inference traffic** during answering (only the one-time model + wasm/CDN fetches).
  6. Note latency (end-of-query → first token) against the <1.5s target.

- [ ] **Step 4: Update `STATUS.md`** Phase 3 line → code-complete with the spike findings (working variant, tok/s, any `#6270` notes) and "manual on-device verification: <result>".

- [ ] **Step 5: Commit:**
```bash
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session add app/src/App.tsx STATUS.md
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session commit -m "chore(query): remove spike harness; Phase B query lane code-complete

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase B Definition of Done

- `npm run build` green; `npm test` green (all pure-logic tasks unit-tested).
- Spike confirmed Gemma 4 (E2B or E4B) loads from OPFS and generates coherent output on a real device.
- Manual: download gate → ask question → streamed Gemma 4 answer + citation + spoken TTS, on-device, no inference network traffic.
- Spike harness removed; `STATUS.md` Phase 3 updated.

## Carried risks / notes

- **`mediapipe#6270`** (E2B load crash on some Chrome/Apple configs): if the spike hits it, default `ModelDownloadGate` + `inference` to `E4B`, or add a variant fallback.
- **iOS Safari WebGPU**: if unavailable, the gate shows the Chromebook-fallback message; capture/timeline still work (Phase A).
- **`Demo.tsx`** keeps a temporary `inference` shim until Phase C reworks the public demo lane (precomputed answers).
- **LoRA hot-swap** (`loadLoraModel` + `loraRanks` at init) is Phase D — not wired here.
