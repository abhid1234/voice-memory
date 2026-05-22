# Design — VoiceMemory canonical build (all four subsystems)

**Date:** 2026-05-20
**Owner:** Abhi Das
**Branch:** `worktree-claude-session` (isolated worktree; original dir left to the Antigravity session)
**Status:** Design approved; ready for implementation plan
**Supersedes scaffold:** builds the canonical version forward from commit `69f6749`, replacing the mock STT and stub inference in that scaffold.

> This is the holistic design across all four subsystems. **Implementation lands incrementally** (Capture → Query → Demo → Training); `writing-plans` will phase it. Reads alongside `docs/spec.md` (locked v1 scope) and `STATUS.md` (phase status, decisions log). Where this design and the older `docs/spec.md` disagree on a mechanism, **this document wins** (it reflects live research as of 2026-05-20).

---

## 1. Scope and subsystems

One design covering the full v1 system, four subsystems, built in order:

| Lane | What it does | Phase |
|---|---|---|
| **Capture** | Record memo → chunked near-live Whisper → embed → save to IndexedDB → timeline + replay | A (first) |
| **Query** | Query → embed → cosine RAG → Gemma 4 answer (new prompt template) → TTS + citations | B |
| **Demo** | Zero-cloud, zero-permission tap-to-query over synthetic memory on ondeviceml.space | C |
| **Training** | Weekly Anti-gravity LoRA on Vertex → quantized adapter → OPFS hot-swap | D |

**Hard constraint preserved:** all inference is on-device. The only cloud touch is the weekly LoRA training job (Lane D). This is non-negotiable per `CLAUDE.md` constraint #1 and is the entire launch thesis.

## 2. Key decisions (this session)

| # | Decision | Rationale |
|---|---|---|
| D-1 | **Model = Gemma 4** (verified available 2026-05-20), not Gemma 2 | Research confirmed a public, Apache-2.0, MediaPipe-compatible web build exists. See §5. Honors the "I beat the I/O keynote" narrative with the real model. |
| D-2 | **E2B on phone / E4B on Chromebook**, behind one config switch | E4B web `.task` is ~2.9 GB; E2B is smaller and phone-appropriate. Chromebook fallback was already locked in D2 (`STATUS.md`). |
| D-3 | **STT = chunked near-live Whisper, on-device** | The spec promised a "live scroll." Browser `SpeechRecognition` would deliver that but streams **raw audio to the cloud** — a direct violation of constraint #1 and the "transcripts never leave your phone" promise. Rejected. Chunked Whisper approximates the live feel while staying fully on-device. |
| D-4 | **RAG = real embeddings (MiniLM-L6) + cosine**, not keyword `includes()` | "Canonical" version; keyword matching does not scale past a handful of memos. |
| D-5 | **Architecture = two Web Workers + `lib/` service modules + existing tab shell** | Keeps the UI responsive during multi-GB model load and inference; testable units; minimal churn from the scaffold. Main-thread-everything and a heavier router/state shell were rejected (jank; YAGNI). |
| D-6 | **Demo lane = precomputed real answers + optional live** | The 5 sample questions are fixed. Pre-generate their answers with the real on-device model, ship as static JSON, play instantly via TTS (hits the <1.5 s, zero-permission bar in LinkedIn's in-app browser). Add an optional "▶ Run live on-device" button for WebGPU-capable browsers. Answers are genuinely model-produced, just precomputed — honest. |
| D-7 | **Tests = vitest** | Matches `CLAUDE.md` (`npm test # vitest`). Pure-logic layer is unit-tested in CI; model/WebGPU paths are manual device tests. |
| D-8 | **Storage = IndexedDB via `idb`**, no Dexie | Per `STATUS.md` guidance — don't over-engineer storage in v1. |

## 3. Architecture

```
main thread (React)
  ├─ Pages: Record / Query / Timeline tabs + Demo route + ModelDownloadGate
  └─ lib/ typed service modules:
       ├─ stt.ts          ──postMessage──► stt.worker   (Whisper chunked transcription)
       ├─ embeddings.ts   ──postMessage──► stt.worker    (MiniLM-L6, co-located)
       ├─ inference.ts    ──postMessage──► llm.worker    (Gemma 4 via @mediapipe/tasks-genai + WebGPU)
       ├─ model-store.ts  (OPFS: download-once, persist, integrity, LoRA hot-swap; WebGPU detection)
       ├─ rag.ts          (cosine top-k over IndexedDB — pure function)
       ├─ storage.ts      (IndexedDB via idb: memos + embeddings + audio blobs)
       └─ tts.ts          (Web Speech API output)
```

Two workers: `stt.worker` hosts the transformers.js models (Whisper + MiniLM); `llm.worker` hosts MediaPipe Gemma 4. Rationale: a ~GB model load plus token generation must not block the UI thread; STT and LLM in separate workers avoid serializing against each other.

## 4. Component interfaces

Each module has one purpose, a typed interface, and stated dependencies.

### `storage.ts` (extends the scaffold)
```ts
interface VoiceMemo {
  id?: number;
  timestamp: number;
  transcript: string;
  embedding: Float32Array;   // NEW — for cosine RAG
  audioBlob?: Blob;
}
saveMemo(m: VoiceMemo): Promise<number>
getAllMemos(): Promise<VoiceMemo[]>
deleteMemo(id: number): Promise<void>
exportTranscriptsForTraining(): Promise<string>   // JSONL for Lane D
```
Depends on: `idb`. IndexedDB version bump to add the `embedding` field (migration in `upgrade`).

### `stt.ts` + `stt.worker`
```ts
start(onPartial: (text: string) => void): Promise<void>
stop(): Promise<{ transcript: string; audioBlob: Blob }>
```
Behavior: buffer mic audio; every ~8 s re-transcribe the **accumulated** buffer with `whisper-tiny.en` and emit the cumulative text as a partial (whisper-tiny is fast enough for <2-min memos; re-transcribing the growing buffer is simpler and more accurate than sliding windows). On `stop`, run one authoritative full pass — that result is the saved transcript. Depends on: `@xenova/transformers`, `MediaRecorder`, `AudioContext`.

### `embeddings.ts` (in `stt.worker`)
```ts
embed(text: string): Promise<Float32Array>   // MiniLM-L6 (all-MiniLM-L6-v2)
```
Used by Capture (embed each memo), Query (embed the query), and the Demo build step (precompute synthetic embeddings). Depends on: `@xenova/transformers`.

### `rag.ts` (pure)
```ts
retrieve(queryVec: Float32Array, memos: VoiceMemo[], k = 5):
  { context: string; citations: VoiceMemo[] }
```
Cosine similarity, top-k, builds the context block. No I/O — fully unit-tested.

### `inference.ts` + `llm.worker`
```ts
init(variant: 'E2B' | 'E4B'): Promise<void>
loadLoRAAdapter(url: string): Promise<void>            // Lane D hot-swap
generateResponse(query: string, context: string): AsyncIterable<string>   // streams tokens
```
Builds the **Gemma 4 prompt template** (new format — differs from Gemma 2/3; see §5). Depends on: `@mediapipe/tasks-genai`, `model-store`, WebGPU.

### `model-store.ts`
```ts
isWebGPUAvailable(): Promise<boolean>
ensureModel(variant): Promise<File>     // download-once → OPFS → return handle, with progress events
swapLoRA(url: string): Promise<void>
```
OPFS download-once with a progress bar and integrity check; persists for offline reuse. Depends on: OPFS, `fetch`.

### `tts.ts`
```ts
speak(text: string): void
cancel(): void
```
Web Speech API output. On-device/local.

## 5. Model loading and fallback (Gemma 4)

Research findings (2026-05-20):
- Gemma 4 web build `gemma-4-E4B-it-web.task` is published on the LiteRT-Community HF org, Apache-2.0, runs via `@mediapipe/tasks-genai` + WebGPU. A smaller **E2B** variant exists.
- E4B web `.task` ≈ **2.9 GB**; E2B is smaller (phone-appropriate). Format is `.task`, **not** the scaffold's `.bin` — the loader URL/format must change.
- Remote-URL `modelAssetPath` is **not** confirmed by the docs (only local paths are demonstrated). The working reference (`koji/gemma4-on-browser`) fetches once → persists in **OPFS** → loads offline. We adopt that pattern (`model-store.ts`).
- Gemma 4 uses a **new prompt template** vs Gemma 2/3 — `inference.ts` must build it correctly.
- Live risk: open bug `google-ai-edge/mediapipe#6270` — `memory access out of bounds` loading `gemma-4-E2B-it-web.task` on Chrome 146 / Apple M4. Combined with the unverified iOS-Safari WebGPU support, the **Chromebook fallback is load-bearing**.

Flow: first run → `ModelDownloadGate` → `isWebGPUAvailable()`. If yes → `ensureModel(variant)` downloads to OPFS with progress → persisted offline. If no (likely iOS Safari) → show Chromebook-fallback guidance; **Capture and Timeline still work without inference**.

Config: `MODEL_URL` + `variant` behind one config object; switching E2B↔E4B is a one-line change.

## 6. Data flow

- **Capture:** `Record` → `stt.start` (partials stream to UI) → `stop` → final transcript → `embeddings.embed` → `storage.saveMemo({transcript, embedding, audioBlob, ts})` → timeline refresh.
- **Query:** input (typed, or voice via the same STT) → `embeddings.embed(query)` → `rag.retrieve` top-k → `inference.generateResponse` (streams tokens to UI) → `tts.speak` + citation chips (tap → jump to memo / replay audio).
- **Demo:** static synthetic JSON with precomputed embeddings → tap sample → instant precomputed answer + TTS (zero permission). Optional "▶ Run live on-device" mirrors the Query flow for WebGPU-capable browsers.
- **Training (Lane D):** `exportTranscriptsForTraining` → JSONL → GCS → Anti-gravity weekly cron → Vertex `CustomJob` (existing `infra/`) → LoRA → quantize/convert → signed URL → `model-store.swapLoRA` into OPFS → `llm.worker` hot-reload, no app restart.

## 7. Error handling

| Condition | Handling |
|---|---|
| No WebGPU | Detect up front; inference disabled gracefully; Capture/Timeline still work; show Chromebook-fallback message |
| Model load crash (`mediapipe#6270`) | Catch; surface retry + variant fallback (E2B↔E4B) |
| Mic permission denied | Clear prompt, no crash |
| OPFS unavailable / quota exceeded | Detect; message; offer re-download path |
| iOS IndexedDB 7-day purge (known) | PWA-install mitigation; documented, not solved in v1 |

## 8. Testing (vitest)

CI (no GPU) unit-tests the pure/logic layer:
- `rag` cosine similarity + top-k ordering
- Gemma 4 prompt builder (exact template)
- `storage` CRUD + migration via `fake-indexeddb`
- embedding vector shape (mocked pipeline)
- synthetic-data integrity (shape, embedding dimensions)

Worker message protocols tested with mocked workers. Model download / WebGPU / real inference are **manual device tests** against the `STATUS.md` acceptance criteria (cannot run in CI). TDD for the pure functions.

## 9. Build order (incremental)

- **Phase A — Capture:** chunked Whisper `stt.worker` + `embeddings` + IndexedDB (embedding field) + timeline/replay.
- **Phase B — Query:** `model-store` (OPFS) + `llm.worker` + Gemma 4 prompt + `rag` cosine + query UI + `tts`. **Start with a Gemma-4-load spike to de-risk** (validates OPFS download, WebGPU, the `#6270` risk) before building the rest of the lane.
- **Phase C — Demo:** synthetic dataset (20–30 transcripts) + precompute embeddings + precompute the 5 sample answers with the real model + zero-cloud demo route + optional live button.
- **Phase D — Training:** Anti-gravity weekly LoRA cron + Vertex job (existing `infra/`) + **research the unconfirmed LoRA → MediaPipe-Gemma-4 conversion/quantization path at phase start** + signed-URL fetch + OPFS hot-swap.

## 10. Constraints honored (`CLAUDE.md`)

- On-device inference only ✅ (cloud = weekly training only)
- PWA, not native ✅
- No live meeting capture ✅ (voice memos only)
- No social/launch drafts in repo ✅
- No employer / 20% / colleague refs in public artifacts ✅ — **action:** audit `Demo.tsx` copy and the synthetic dataset before they ship publicly
- IndexedDB not over-engineered (no Dexie) ✅
- RAG and LoRA kept separate (recall vs voice/style) ✅

## 11. Open risks carried into implementation

1. **iOS Safari WebGPU** for Gemma 4 — unverified on real devices; Chromebook fallback is the backup.
2. **`mediapipe#6270`** loader crash on some Chrome/Apple configs — may force E2B↔E4B fallback logic.
3. **Anti-gravity LoRA → MediaPipe-Gemma-4 format** — conversion path unconfirmed (Lane D research gate).
4. **E2B vs E4B exact size / quality on phone** — confirm E2B download size and answer quality during the Phase B spike.
