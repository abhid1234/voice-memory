# VoiceMemory Phase D — Weekly LoRA Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Once a week, fine-tune a LoRA adapter on the user's own transcripts (Vertex AI, triggered by Anti-gravity cron), convert it to a MediaPipe-loadable `lora.bin`, ship it to the phone via a signed URL, and hot-swap it into the on-device Gemma 4 so answers gradually adopt the user's voice/style — **without an app restart**, and **without transcripts leaving the device for inference** (training is the only, user-controlled, cloud touch).

**Architecture:** App exports the user's transcripts as training JSONL → uploads to the user's GCS bucket → an **Anti-gravity weekly cron** launches a **Vertex AI** LoRA fine-tune of Gemma 4 → the resulting PEFT adapter is **converted to FlatBuffers `lora.bin`** with the MediaPipe genai converter → published to GCS, fetched by the app via signed URL into **OPFS** → the `llm-worker` (initialized with `loraRanks`) calls `loadLoraModel(...)` and passes the adapter to `generateResponse`.

**Tech Stack:** Vertex AI custom training (PEFT/transformers LoRA), MediaPipe genai `converter.convert_checkpoint`, `@mediapipe/tasks-genai` web LoRA (`loadLoraModel`), Anti-gravity CLI cron, GCS signed URLs, OPFS. App side reuses Phase B `inference`/`llm-worker`/`model-store`.

**Branch:** `phase-d-training` (stacked on Phase C `d72b33f`).

**Commit trailer:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## ⚠️ Read this first — Phase D is NOT like A–C

Most of Phase D is **cloud/infra and cannot be built or verified by a headless agent** (no GCP project, no Anti-gravity runtime, no GPU, and the Gemma-4 LoRA→web path is unproven). This plan is therefore **research-first** and explicitly separates:

- **Autonomous + build-gated** (subagent-doable now): Task 2 (export util), Task 3 (app-side hot-swap wiring — typechecks, real LoRA load verified later).
- **Research gate** (human/cloud): Task 1 — **nothing downstream is real until this passes.**
- **Scaffold + manual run** (human, with GCP/Anti-gravity): Tasks 4, 5.
- **Manual acceptance** (human): Task 6.

**Do NOT mark Tasks 4–6 "done" from an agent** — they require cloud execution. An agent may only scaffold the files and STOP at the run steps.

## CRITICAL git guardrails (carried)
Every subagent: confirm `git -C <worktree> branch --show-current` == `phase-d-training` first; all git via `git -C <worktree-path>`; never touch the parent repo; allowed git = rev-parse/branch/status/log/diff/add named files/commit; FORBIDDEN = checkout/reset/stash/branch/rebase/restore/switch and any commit on `main`; never `git add -A`; never add `dist/`. **Build gate:** any `.ts`/`.tsx` change runs BOTH `npm run build` and `npm test` green before commit.

---

## File structure (Phase D)

| File | Responsibility | Autonomy |
|---|---|---|
| `docs/superpowers/phase-d-conversion-findings.md` | **Create (Task 1).** The research gate's findings. | Human/research |
| `app/src/lib/training-export.ts` | **Create (Task 2).** Pure: memos → training JSONL. | Autonomous |
| `app/src/lib/training-export.test.ts` | **Create (Task 2).** | Autonomous |
| `app/src/lib/model-store.ts` | **Modify (Task 3).** Add LoRA download/cache in OPFS. | Autonomous |
| `app/src/lib/llm-worker.ts` | **Modify (Task 3).** `loraRanks` at init; LOAD_LORA; pass adapter to generate. | Autonomous |
| `app/src/lib/inference.ts` | **Modify (Task 3).** `loadLoRA(url)` on the client. | Autonomous |
| `infra/train_config.yaml`, `infra/deploy_pipeline.py` | **Modify (Task 4).** Gemma 2 → Gemma 4 LoRA. | Scaffold / manual run |
| `infra/agent-config.yaml` | **Create (Task 4).** Anti-gravity weekly cron + job def. | Scaffold / manual run |
| `infra/convert_lora.py` | **Create (Task 5).** PEFT adapter → MediaPipe `lora.bin`. | Scaffold / manual run |

---

## Task 1 — RESEARCH GATE: Gemma 4 LoRA → MediaPipe web (HUMAN/cloud) ⛔

**Nothing downstream is real until this is confirmed.** Deliverable: `docs/superpowers/phase-d-conversion-findings.md` recording concrete answers (with versions/links). An agent may draft the doc's question scaffold, but the **answers require running the conversion and a web load** on a real environment.

- [ ] **Q1 — Vertex/Anti-gravity LoRA output format.** Confirm a Vertex (or Anti-gravity-launched) Gemma 4 PEFT/transformers LoRA fine-tune produces a standard adapter (`adapter_model.safetensors` + `adapter_config.json`). Record the base model id used (e.g. `google/gemma-4-...`) and that LoRA targets attention layers (MediaPipe applies LoRA to attention only).
- [ ] **Q2 — Converter supports Gemma 4 LoRA.** Run the MediaPipe genai converter on a tiny test adapter:
  ```python
  from mediapipe.tasks.python.genai import converter
  converter.convert_checkpoint(converter.ConversionConfig(
      lora_ckpt="/path/to/adapter", lora_rank=8,
      lora_output_tflite_file="/out/lora.bin"))
  ```
  Confirm it accepts a **Gemma 4** adapter and emits `lora.bin`. Record the converter package version and the **resulting file size** (design target: LoRA delta < 5 MB).
- [ ] **Q3 — Web `loadLoraModel` works with the Gemma 4 web model.** In a throwaway page, init the **Gemma 4 E2B web `.task`** with `loraRanks: [8]`, then:
  ```js
  const lora = await llmInference.loadLoraModel(loraBinUrl);
  const out = await llmInference.generateResponse(prompt, lora, (p, done) => {...});
  ```
  Confirm: (a) the base model still loads with `loraRanks` set; (b) `loadLoraModel` accepts the converted `lora.bin` (URL — and check whether a bytes/`Blob` form is supported for OPFS); (c) generation runs with the adapter. Record exact signatures.
- [ ] **Q4 — Cost + size.** Confirm a weekly Vertex T4 LoRA run lands under ~$5 and the shipped `lora.bin` is small enough for a phone fetch (< ~5 MB target).
- [ ] **Decision:** If Q2 or Q3 fails for Gemma 4, record the fallback (e.g., E4B only; or defer LoRA to a later milestone) BEFORE building Tasks 4–5. Tasks 3–5 assume the signatures/sizes recorded here.

- [ ] **Commit the findings doc** (agent may commit the drafted scaffold; human fills answers):
```bash
git -C <worktree> add docs/superpowers/phase-d-conversion-findings.md
git -C <worktree> commit -m "docs(training): Phase D conversion-path research gate findings

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 — Training-data export util (autonomous, TDD)

**Files:**
- Create: `app/src/lib/training-export.ts`
- Create: `app/src/lib/training-export.test.ts`

Produces the JSONL the Vertex container trains on. Format: one `{ "text": <transcript> }` object per line (causal-LM style — the adapter learns the user's phrasing). The existing `storage.exportTranscriptsForTraining` stays; this adds a pure, tested formatter the export/upload flow uses.

- [ ] **Step 1: Write `app/src/lib/training-export.test.ts`:**
```ts
import { describe, it, expect } from 'vitest'
import { toTrainingJsonl } from './training-export'
import type { VoiceMemo } from './storage'

function memo(transcript: string): VoiceMemo {
  return { transcript, timestamp: 1, embedding: new Float32Array([0]) }
}

describe('toTrainingJsonl', () => {
  it('emits one JSON object per memo with a text field, newline-separated', () => {
    const out = toTrainingJsonl([memo('hello'), memo('world')])
    const lines = out.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toEqual({ text: 'hello' })
    expect(JSON.parse(lines[1])).toEqual({ text: 'world' })
  })
  it('skips empty/whitespace-only transcripts', () => {
    const out = toTrainingJsonl([memo('  '), memo('keep')])
    expect(out.trim().split('\n')).toEqual([JSON.stringify({ text: 'keep' })])
  })
  it('returns an empty string for no memos', () => {
    expect(toTrainingJsonl([])).toBe('')
  })
})
```

- [ ] **Step 2: Run to verify it fails.** `cd app && npm test -- training-export`. Expected FAIL (module missing).

- [ ] **Step 3: Create `app/src/lib/training-export.ts`:**
```ts
import type { VoiceMemo } from './storage'

/**
 * Build the weekly LoRA training set as JSONL ({"text": <transcript>} per line).
 * Causal-LM style: the adapter learns the user's own phrasing/voice.
 */
export function toTrainingJsonl(memos: VoiceMemo[]): string {
  return memos
    .map((m) => m.transcript.trim())
    .filter((t) => t.length > 0)
    .map((text) => JSON.stringify({ text }))
    .join('\n')
}
```

- [ ] **Step 4: Run + build gate.** `cd app && npm test -- training-export` (3 pass) and `npm run build` (green).

- [ ] **Step 5: Commit:**
```bash
git -C <worktree> add app/src/lib/training-export.ts app/src/lib/training-export.test.ts
git -C <worktree> commit -m "feat(training): pure transcripts->training JSONL formatter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — App-side LoRA hot-swap wiring (autonomous; real load verified in Task 6)

**Depends on Task 1's recorded signatures.** This typechecks and bundles now; the real `loadLoraModel` against a Gemma 4 model + real `lora.bin` is verified on-device in Task 6. If Task 1 recorded a different `loadLoraModel` shape (e.g., bytes instead of URL), adjust these snippets to match before implementing.

**Files:**
- Modify: `app/src/lib/model-store.ts`
- Modify: `app/src/lib/llm-worker.ts`
- Modify: `app/src/lib/inference.ts`

- [ ] **Step 1: `model-store.ts` — add LoRA OPFS cache.** Append:
```ts
const LORA_FILE = 'active-lora.bin'

/** Download the latest LoRA adapter to OPFS (overwrites the previous one). */
export async function downloadLoRA(signedUrl: string): Promise<void> {
  const res = await fetch(signedUrl)
  if (!res.ok) throw new Error(`LoRA download failed: HTTP ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const dir = await modelDir()
  const handle = await dir.getFileHandle(LORA_FILE, { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(bytes)
    await writable.close()
  } catch (e) {
    try { await writable.close() } catch { /* ignore */ }
    await dir.removeEntry(LORA_FILE).catch(() => {})
    throw e
  }
}

/** A blob: URL for the cached LoRA, or null if none downloaded. */
export async function getLoRAUrl(): Promise<string | null> {
  try {
    const dir = await modelDir()
    const handle = await dir.getFileHandle(LORA_FILE)
    const file = await handle.getFile()
    return URL.createObjectURL(file)
  } catch {
    return null
  }
}
```
(`modelDir` is the existing private helper — reuse it; if it is not exported, add these functions in the same module so they can call it.)

- [ ] **Step 2: `llm-worker.ts` — accept `loraRanks` at init and a LOAD_LORA message.**
  - In `doInit`, add `loraRanks: [8]` to the `createFromOptions` options (alongside `maxTokens`/`topK`/`temperature`). *(Task 1 Q3 confirms this rank + that the base still loads.)*
  - Add module state `let loraModel: unknown = null` and an `InMsg` variant `{ type: 'LOAD_LORA'; id: number; url: string }`.
  - In `onmessage`, handle it:
    ```ts
    } else if (msg.type === 'LOAD_LORA') {
      if (!initPromise) throw new Error('LLM not initialized')
      await initPromise
      loraModel = await llm.loadLoraModel(msg.url)
      post({ type: 'LORA_READY', id: msg.id })
    }
    ```
  - In the GENERATE branch, pass the adapter when present:
    ```ts
    const final: string = loraModel
      ? await llm.generateResponse(prompt, loraModel, onToken)
      : await llm.generateResponse(prompt, onToken)
    ```
    where `onToken` is the existing cumulative-delta callback. *(If Task 1 recorded that `generateResponse(prompt, lora, cb)` differs, match it.)*

- [ ] **Step 3: `inference.ts` — `loadLoRA(url)` on the client.** Add to `InferenceClient`:
```ts
  loadLoRA(url: string): Promise<void> {
    const id = this.nextId++
    return new Promise<void>((resolve, reject) => {
      this.pending.set(id, { resolve: () => resolve(), reject, onToken: () => {} })
      this.worker.postMessage({ type: 'LOAD_LORA', id, url })
    })
  }
```
and in `dispatch`, treat `LORA_READY` like a terminal success: `if (msg.type === 'LORA_READY') { this.pending.delete(msg.id); p.resolve(''); return }` (place alongside DONE/ERROR handling). Keep types consistent with the existing `Pending`.

- [ ] **Step 4: Build gate.** `cd app && npm run build` (MUST pass — confirms the worker LoRA wiring + client typecheck) and `npm test` (all prior green; no new unit tests — the LoRA path is verified on-device in Task 6). If MediaPipe's TS types reject `loraRanks`/`loadLoraModel`, use a localized `any` cast like the existing `llm` (do not broaden).

- [ ] **Step 5: Commit:**
```bash
git -C <worktree> add app/src/lib/model-store.ts app/src/lib/llm-worker.ts app/src/lib/inference.ts
git -C <worktree> commit -m "feat(training): app-side LoRA hot-swap wiring (OPFS + loadLoraModel)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — Infra: Vertex Gemma 4 LoRA job + Anti-gravity weekly cron (SCAFFOLD; manual run) ⛔

An agent may write these files, then STOP (they require GCP/Anti-gravity to run).

**Files:**
- Modify: `infra/train_config.yaml` and `infra/deploy_pipeline.py` — change `--base_model=google/gemma-2b-it` to the **Gemma 4** base id recorded in Task 1 (Q1), keep `--lora_rank=8` consistent with Task 1 Q2/Q3, and confirm `target_modules` are attention-only (`q_proj,v_proj`) since MediaPipe applies LoRA to attention layers only.
- Create: `infra/agent-config.yaml` — Anti-gravity weekly cron that (a) waits for the user's `weekly_export.jsonl` in GCS, (b) launches the Vertex job from `deploy_pipeline.py`, (c) on success runs `convert_lora.py` (Task 5), (d) publishes `lora.bin` + a signed URL. Use a weekly schedule (e.g., `cron: "0 3 * * 0"`). Keep the actual project/bucket ids as `${ENV}` placeholders — do NOT hardcode secrets.

- [ ] **Step 1:** Update the two infra files (Gemma 4 base id + rank consistent with Task 1).
- [ ] **Step 2:** Write `infra/agent-config.yaml` (weekly cron → train → convert → publish).
- [ ] **Step 3 (MANUAL, human):** `antigravity` register/run from `~/Core/Workspace/AntigravityCLI/` (inherit parent registration per STATUS); do a **one-off manual trigger** of the job before enabling the weekly cron.
- [ ] **Step 4: Commit the configs** (NOT a run): `git -C <worktree> add infra/train_config.yaml infra/deploy_pipeline.py infra/agent-config.yaml && git -C <worktree> commit -m "feat(training): Vertex Gemma 4 LoRA job + Anti-gravity weekly cron config"` (+ trailer).

---

## Task 5 — LoRA conversion script (SCAFFOLD; depends on Task 1; manual run) ⛔

**Files:**
- Create: `infra/convert_lora.py`

- [ ] **Step 1: Write `infra/convert_lora.py`** (grounded in Task 1 Q2):
```python
"""Convert a Vertex PEFT LoRA adapter to a MediaPipe-loadable lora.bin.
Run after the Vertex job, before publishing. Requires the mediapipe genai converter."""
import argparse
from mediapipe.tasks.python.genai import converter

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lora_ckpt", required=True, help="dir with adapter_model.safetensors")
    ap.add_argument("--lora_rank", type=int, default=8)
    ap.add_argument("--out", default="lora.bin")
    a = ap.parse_args()
    converter.convert_checkpoint(converter.ConversionConfig(
        lora_ckpt=a.lora_ckpt, lora_rank=a.lora_rank, lora_output_tflite_file=a.out))
    print(f"Wrote {a.out}")

if __name__ == "__main__":
    main()
```
- [ ] **Step 2 (MANUAL, human):** Run it on a real Vertex adapter; confirm `lora.bin` size < ~5 MB (Task 1 Q4) and that it loads via Task 3's `loadLoRA`.
- [ ] **Step 3: Commit the script** (not a run): `git -C <worktree> add infra/convert_lora.py && git -C <worktree> commit -m "feat(training): PEFT LoRA -> MediaPipe lora.bin converter script"` (+ trailer).

---

## Task 6 — End-to-end acceptance (MANUAL, cloud + device) ⛔ + STATUS

- [ ] **Step 1 (human):** Export transcripts (Task 2 JSONL) → upload to GCS → trigger the weekly job once → confirm it completes on Vertex **under ~$5**.
- [ ] **Step 2 (human):** Convert (Task 5) → `lora.bin` **< 5 MB** → publish + signed URL.
- [ ] **Step 3 (human, device):** In the app, call `getInference().loadLoRA(signedUrl)` (wire a temporary trigger or settings action), then ask a question → confirm the adapter loads and answers shift toward the user's style **without an app restart**.
- [ ] **Step 4:** Update `STATUS.md` Phase 4 with the result (cost, lora.bin size, hot-swap confirmed) and the Task 1 findings summary.
- [ ] **Step 5: Commit STATUS.**

---

## Phase D Definition of Done

- Task 1 findings doc records a **confirmed** Gemma 4 LoRA→web path (or a recorded fallback).
- App side: `toTrainingJsonl` tested; LoRA hot-swap wiring builds + typechecks (`npm run build` green, tests green).
- Infra: Vertex Gemma 4 LoRA job + Anti-gravity weekly cron + converter script committed.
- Manual acceptance: weekly job runs end-to-end (< $5), `lora.bin` < 5 MB, phone hot-swaps the adapter without restart.
- `STATUS.md` Phase 4 updated.

## Carried risks

- **The whole phase is gated on Task 1.** If Gemma 4 web LoRA isn't supported by the shipped MediaPipe/converter versions, LoRA hot-swap defers to a later milestone — RAG (Phase B) already delivers fact recall; LoRA only adds voice/style.
- **Privacy:** training is the ONLY cloud touch and uses the user's own transcripts on their own signed job — keep it opt-in and user-triggered; never auto-upload.
- **Anti-gravity is new** — its cron/job CLI surface may differ from `agent-config.yaml` assumptions; confirm against its docs during Task 4.
- `loadLoraModel` URL-vs-bytes and the `generateResponse(prompt, lora, cb)` overload are confirmed in Task 1 Q3 — Task 3 snippets may need to match.
