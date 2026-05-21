# VoiceMemory Phase C — Public Demo Lane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A zero-permission public demo: a stranger taps a sample question and instantly hears a spoken answer grounded in a synthetic memory — no mic, no model download, no permission prompts — with an optional "run it live on-device" button for WebGPU-capable browsers.

**Architecture:** Two answer paths in the Demo route. **Default (zero-permission):** tap a fixed sample question → look up a shipped **precomputed answer** → display + speak via Web Speech TTS. Needs nothing but the static JSON. **Optional live:** embed the question (MiniLM, Phase A worker) → cosine RAG over a **pre-embedded** synthetic memory → Gemma 4 (Phase B `inference`) → stream + TTS, behind the same WebGPU/download gate as the Query lane. Synthetic-memory embeddings are precomputed at build time by a Node script (transformers.js runs in Node — no GPU needed).

**Tech Stack:** React 19, Vite 8, TypeScript, `@xenova/transformers` (MiniLM in Node for the build script + in the Phase A worker for live), Phase B `inference`/`rag`/`tts`/`model-store`, `vitest`.

**Branch:** `phase-c-demo` (stacked on Phase B `5aa828d`; PR targets `phase-b-query`, auto-retargets to `main` as the stack merges).

**Commit trailer (every commit):** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

---

## CRITICAL git guardrails (carried — a confused agent once committed to the wrong repo)

Every subagent MUST:
1. First run `git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session branch --show-current` and confirm it prints **`phase-c-demo`**. If not, STOP/BLOCKED.
2. Do ALL git ops via `git -C <that worktree path> …`. NEVER touch the parent repo `/home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory`.
3. Allowed git: `rev-parse`, `branch --show-current`, `status`, `log`, `diff`, `add <specific files>`, `rm <specific file>`, `commit`. FORBIDDEN: `checkout`, `reset`, `stash`, `branch`, `rebase`, `restore`, `switch`, commits on `main`. If tempted, STOP/BLOCKED.
4. Only `git add` the exact files named per task. Never `git add -A`/`.`. Never add `dist/`.
5. **Build gate (Phase A lesson):** every code task runs BOTH `npm run build` AND `npm test` green before commit. `npm test` alone does NOT typecheck.

## Constraint audit (CLAUDE.md #6 / `feedback_no_employer_in_launch_materials.md`) — applies to ALL Phase C content

The demo is a **public launch artifact**. The synthetic data and Demo copy MUST NOT contain: the user's employer, "Google"/"Google Cloud", "20%", named real colleagues, or internal-product references (including "Anti-gravity"/"Gemma"-as-employer-product framing). Use clearly-fictional first names and generic open-source / on-device-AI industry topics (WebGPU, LiteRT-class runtimes, quantization, edge inference, weekly fine-tuning). This audit is built into Task 1 and re-checked in Task 4.

---

## File structure (Phase C)

| File | Responsibility |
|---|---|
| `app/src/data/synthetic-source.json` | **Create.** Hand-authored, audited synthetic transcripts (no embeddings). |
| `app/src/data/demo-questions.json` | **Create.** The fixed sample questions + curated precomputed answers. |
| `app/src/data/synthetic-memory.json` | **Generated (Task 2 script).** transcripts + 384-dim embeddings, for the live path's RAG. |
| `app/scripts/precompute-synthetic.mjs` | **Create.** Node script: reads `synthetic-source.json`, computes MiniLM embeddings, writes `synthetic-memory.json`. |
| `app/src/data/demo-data.test.ts` | **Create.** Integrity + audit tests over the JSON. |
| `app/src/pages/Demo.tsx` | **Replace.** Zero-permission precomputed path + optional live path; audited copy. |
| `public-demo/synthetic_memory.json` | **Delete.** Superseded by `app/src/data/*` (5-entry stub, no embeddings). |

---

## Task 1 — Synthetic dataset + curated answers (authored, audited)

**Files:**
- Create: `app/src/data/synthetic-source.json`
- Create: `app/src/data/demo-questions.json`
- Create: `app/src/data/demo-data.test.ts`

- [ ] **Step 1: Create `app/src/data/synthetic-source.json`** (12 audited transcripts — fictional names, generic on-device-AI industry talk, NO employer/internal-product refs):

```json
[
  { "id": "s1", "timestamp": 1716150000000, "transcript": "Priya walked through the model scaling results — dense models are still tracking the scaling curves, but she wants us watching compute efficiency on the older accelerators before we commit to a bigger run." },
  { "id": "s2", "timestamp": 1716153600000, "transcript": "The launch is blocked right now because the on-device runtime integration on the main branch hasn't been verified on the older Android builds. Marcus owns getting that green." },
  { "id": "s3", "timestamp": 1716157200000, "transcript": "In this week's on-device runtime discussion we decided to prioritize WebGPU support for the browser path so inference can run client-side without a server round trip." },
  { "id": "s4", "timestamp": 1716160800000, "transcript": "I committed in standup to finishing the weekly fine-tuning pipeline by Friday so we can start the internal dogfood round next week." },
  { "id": "s5", "timestamp": 1716164400000, "transcript": "Priya keeps making the case that weekly on-device fine-tuning is the unlock — personalized models per user without anyone's data leaving their device." },
  { "id": "s6", "timestamp": 1716168000000, "transcript": "Marcus benchmarked int4 quantization on the edge build: about a 4x memory drop with only a small quality hit on the eval set. Good enough to ship to phones." },
  { "id": "s7", "timestamp": 1716171600000, "transcript": "We argued about RAG versus fine-tuning again. Consensus: retrieval for fact recall, fine-tuning for voice and style. Stop conflating them." },
  { "id": "s8", "timestamp": 1716175200000, "transcript": "Latency target for the voice loop is under one and a half seconds from end of question to start of spoken answer. Streaming the tokens is what makes it feel instant." },
  { "id": "s9", "timestamp": 1716178800000, "transcript": "Dana raised the storage durability problem — some mobile browsers evict local storage after about a week of non-use. Installing to the home screen bumps it to a more durable class." },
  { "id": "s10", "timestamp": 1716182400000, "transcript": "Decision: the public demo ships zero-permission. Pre-recorded synthetic memory, tap a question, hear the answer. No microphone prompt so it survives in-app browsers." },
  { "id": "s11", "timestamp": 1716186000000, "transcript": "Marcus flagged a loader crash on one of the smaller edge models on certain GPUs — tracking upstream. Fallback is the larger variant on a laptop until it's fixed." },
  { "id": "s12", "timestamp": 1716189600000, "transcript": "Dana summarized the week: WebGPU browser path prioritized, int4 quantization validated, launch still blocked on the older-Android verification." }
]
```

- [ ] **Step 2: Create `app/src/data/demo-questions.json`** (5 fixed sample questions + curated, grounded precomputed answers — these are the zero-permission default answers; regenerable on-device in Task 4):

```json
[
  {
    "id": "q1",
    "question": "What did Priya say about model scaling?",
    "answer": "Priya said dense models are still tracking the scaling curves, but she wants the team watching compute efficiency on the older accelerators before committing to a bigger training run."
  },
  {
    "id": "q2",
    "question": "Who flagged the launch as blocked, and why?",
    "answer": "The launch is blocked on the on-device runtime integration, which hasn't been verified on the older Android builds. Marcus owns getting that check green."
  },
  {
    "id": "q3",
    "question": "Summarize this week's on-device runtime discussion.",
    "answer": "This week the team prioritized WebGPU support for the browser path so inference runs client-side, validated int4 quantization on the edge build (about a 4x memory drop), and noted the launch is still blocked on older-Android verification."
  },
  {
    "id": "q4",
    "question": "What did I commit to in standup?",
    "answer": "You committed to finishing the weekly fine-tuning pipeline by Friday so the team can start the internal dogfood round next week."
  },
  {
    "id": "q5",
    "question": "What's the case for weekly fine-tuning?",
    "answer": "Priya's argument is that weekly on-device fine-tuning gives each user a personalized model without their data ever leaving their device — retrieval handles fact recall, fine-tuning handles voice and style."
  }
]
```

- [ ] **Step 3: Write `app/src/data/demo-data.test.ts`** (integrity + the launch-materials audit as an executable test):

```ts
import { describe, it, expect } from 'vitest'
import source from './synthetic-source.json'
import questions from './demo-questions.json'

// Launch-materials audit (CLAUDE.md #6): no employer / internal-product / 20% references.
// NOTE: "Gemma" is intentionally allowed — it's a public OSS model and the launch hook.
// We forbid employer + internal-product references only.
const FORBIDDEN = [/google/i, /\bgcp\b/i, /20\s*%/, /anti-?gravity/i]

function corpus(): string {
  return [
    ...source.map((s) => s.transcript),
    ...questions.flatMap((q) => [q.question, q.answer]),
  ].join('\n')
}

describe('synthetic demo data', () => {
  it('has at least 10 transcripts with unique ids', () => {
    expect(source.length).toBeGreaterThanOrEqual(10)
    expect(new Set(source.map((s) => s.id)).size).toBe(source.length)
  })

  it('has exactly 5 sample questions, each with a non-empty answer', () => {
    expect(questions).toHaveLength(5)
    for (const q of questions) {
      expect(q.question.trim().length).toBeGreaterThan(0)
      expect(q.answer.trim().length).toBeGreaterThan(0)
    }
  })

  it('contains NO employer / internal-product / 20% references (launch audit)', () => {
    const text = corpus()
    for (const pattern of FORBIDDEN) {
      expect(text).not.toMatch(pattern)
    }
  })
})
```

- [ ] **Step 4: Run.** `cd app && npm test -- demo-data`. Expected PASS, 3 tests. (If the audit test fails, an authored string contains a forbidden term — fix the content, not the test.)

- [ ] **Step 5: Build gate.** `cd app && npm run build`. MUST pass (JSON imports typecheck).

- [ ] **Step 6: Commit:**
```bash
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session add app/src/data/synthetic-source.json app/src/data/demo-questions.json app/src/data/demo-data.test.ts
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session commit -m "feat(demo): add audited synthetic memory + curated sample answers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 — Build-time embedding precompute (Node script)

**Files:**
- Create: `app/scripts/precompute-synthetic.mjs`
- Modify: `app/package.json` (add a `precompute:demo` script)
- Generated: `app/src/data/synthetic-memory.json`
- Create: `app/src/data/synthetic-memory.test.ts`

transformers.js runs in Node with no GPU, so embeddings are computed at build time — the live demo path then does pure cosine math in the browser without re-embedding the corpus.

- [ ] **Step 1: Create `app/scripts/precompute-synthetic.mjs`:**

```js
// Computes MiniLM-L6 embeddings for the synthetic transcripts (Node, no GPU).
// Run: npm run precompute:demo
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false

const here = dirname(fileURLToPath(import.meta.url))
const srcPath = join(here, '../src/data/synthetic-source.json')
const outPath = join(here, '../src/data/synthetic-memory.json')

const source = JSON.parse(readFileSync(srcPath, 'utf8'))
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')

const out = []
for (const item of source) {
  const t = await extractor(item.transcript, { pooling: 'mean', normalize: true })
  out.push({ ...item, embedding: Array.from(t.data) })
}

writeFileSync(outPath, JSON.stringify(out, null, 2))
console.log(`Wrote ${out.length} embedded memories (dim ${out[0].embedding.length}) to ${outPath}`)
```

- [ ] **Step 2: Add the script to `app/package.json` `scripts`** (keep existing):
```json
    "precompute:demo": "node scripts/precompute-synthetic.mjs",
```

- [ ] **Step 3: Run it to generate the data.** `cd app && npm run precompute:demo`. Expected: downloads MiniLM once, prints `Wrote 12 embedded memories (dim 384) …`, creates `app/src/data/synthetic-memory.json`.

- [ ] **Step 4: Write `app/src/data/synthetic-memory.test.ts`** (validates the generated artifact):

```ts
import { describe, it, expect } from 'vitest'
import memory from './synthetic-memory.json'
import source from './synthetic-source.json'

describe('generated synthetic-memory.json', () => {
  it('has one entry per source transcript', () => {
    expect(memory.length).toBe(source.length)
  })
  it('each entry has a 384-dim numeric embedding and a transcript', () => {
    for (const m of memory) {
      expect(m.transcript.length).toBeGreaterThan(0)
      expect(Array.isArray(m.embedding)).toBe(true)
      expect(m.embedding).toHaveLength(384)
      expect(typeof m.embedding[0]).toBe('number')
    }
  })
})
```

- [ ] **Step 5: Run + build gate.** `cd app && npm test -- synthetic-memory` (PASS, 2 tests) and `npm run build` (MUST pass — the larger JSON imports fine).

- [ ] **Step 6: Commit:**
```bash
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session add app/scripts/precompute-synthetic.mjs app/package.json app/src/data/synthetic-memory.json app/src/data/synthetic-memory.test.ts
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session commit -m "feat(demo): precompute synthetic-memory embeddings via Node script

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — Demo lane rework (zero-permission + optional live)

**Files:**
- Replace: `app/src/pages/Demo.tsx`
- Delete: `public-demo/synthetic_memory.json`

- [ ] **Step 1: Replace `app/src/pages/Demo.tsx`:**

```tsx
import { useState } from 'react'
import questions from '../data/demo-questions.json'
import memory from '../data/synthetic-memory.json'
import { embed } from '../lib/embeddings'
import { retrieve } from '../lib/rag'
import { getInference } from '../lib/inference'
import { speak } from '../lib/tts'
import type { VoiceMemo } from '../lib/storage'

// Adapt the static JSON (number[] embeddings) into the VoiceMemo shape rag.retrieve expects.
const MEMOS: VoiceMemo[] = memory.map((m) => ({
  timestamp: m.timestamp,
  transcript: m.transcript,
  embedding: new Float32Array(m.embedding),
}))

function Demo() {
  const [answer, setAnswer] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Zero-permission: instant precomputed answer + speak. No mic, no model, no download.
  const handlePrecomputed = (q: (typeof questions)[number]) => {
    setActive(q.id)
    setAnswer(q.answer)
    speak(q.answer)
  }

  // Optional live: real on-device RAG + Gemma 4 (needs WebGPU + one-time model download).
  const handleLive = async (q: (typeof questions)[number]) => {
    if (busy) return
    setActive(q.id)
    setBusy(true)
    setAnswer('Thinking on-device…')
    try {
      const queryVec = await embed(q.question)
      const { context } = retrieve(queryVec, MEMOS, 5)
      getInference().init('E2B')
      let acc = ''
      const final = await getInference().generateResponse(q.question, context, (token) => {
        acc += token
        setAnswer(acc)
      })
      setAnswer(final)
      speak(final)
    } catch {
      setAnswer('Live mode needs a WebGPU browser and a one-time model download. The instant answers above work everywhere.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="demo-page card">
      <h2>Try VoiceMemory</h2>
      <p className="status-text">
        No permissions needed. These are sample questions over a synthetic memory of AI-industry conversations.
        Tap one to hear the answer.
      </p>

      <div className="sample-queries">
        {questions.map((q) => (
          <div key={q.id} className="sample-q-row">
            <button className="sample-q-btn" onClick={() => handlePrecomputed(q)} disabled={busy}>
              ▶ {q.question}
            </button>
            <button
              className="sample-q-live"
              onClick={() => handleLive(q)}
              disabled={busy}
              title="Run the real model on-device (needs WebGPU + a one-time download)"
            >
              ⚡ live
            </button>
          </div>
        ))}
      </div>

      <div className="answer-area">
        {answer && (
          <div className="ai-response">
            <p>{answer}</p>
            {active && <span className="demo-hint">▶ instant · ⚡ live runs Gemma 4 on your device</span>}
          </div>
        )}
      </div>

      <div className="install-prompt">
        <button className="record-btn secondary" style={{ fontSize: '1rem', padding: '1rem 2rem' }}>
          Install for yourself
        </button>
        <p className="status-text">Only the full app asks for microphone access.</p>
      </div>
    </div>
  )
}

export default Demo
```

- [ ] **Step 2: Delete the superseded stub.** `git -C <worktree> rm public-demo/synthetic_memory.json` (it's the old 5-entry, no-embedding file; Demo no longer imports it).

- [ ] **Step 3: Build + test gate.** `cd app && npm run build` (MUST pass — confirms Demo no longer imports the deleted file or the `inference` shim, and the `VoiceMemo` adaptation typechecks) and `npm test` (all green; counts unchanged from Tasks 1–2). If `tsc` reports the `inference` shim in `inference.ts` is now unused anywhere, leave it (harmless) — do not modify inference.ts in this task.

- [ ] **Step 4: Commit:**
```bash
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session add app/src/pages/Demo.tsx public-demo/synthetic_memory.json
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session commit -m "feat(demo): zero-permission tap-to-query with precomputed answers + optional live

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — Acceptance + STATUS (zero-permission path testable anywhere)

**Files:**
- Modify: `STATUS.md`
- (Optional, manual) regenerate real demo answers on-device.

- [ ] **Step 1: Build + serve.** `cd app && npm run build && npm run preview`.

- [ ] **Step 2: Zero-permission acceptance (safe on ANY machine — no model/GPU/mic).** Open the printed URL with `?demo` appended. Verify:
  1. The 5 sample questions render; **no microphone prompt** appears on load or on tap.
  2. Tapping `▶ <question>` shows the precomputed answer instantly and **speaks it** (Web Speech TTS).
  3. DevTools → Network: tapping a `▶` triggers **no model/inference fetch** (zero-permission path is pure static JSON + TTS).
  4. The copy reads as generic AI-industry content — no employer/colleague/internal-product terms (the Task 1 audit test enforces this, but eyeball it).

- [ ] **Step 3: Optional live acceptance (WebGPU device only).** Tap `⚡ live` on a question → it embeds, retrieves, downloads the model once (gated), and streams a real Gemma 4 answer + TTS. On a non-WebGPU browser it shows the graceful fallback message and the instant answers still work.

- [ ] **Step 4 (optional, during your device session): regenerate real precomputed answers.** Tap `⚡ live` for each of the 5 questions, copy the generated answers, and paste them into `app/src/data/demo-questions.json` to replace the curated defaults with genuine model output, then re-run Task 1's tests + `npm run build` and commit. (Skippable — the curated answers are launch-ready.)

- [ ] **Step 5: Update `STATUS.md` Phase 5 line** → code-complete (zero-permission demo verified; live path verified on <device>), noting the curated-vs-regenerated answer state.

- [ ] **Step 6: Commit:**
```bash
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session add STATUS.md
git -C /home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory/.claude/worktrees/claude-session commit -m "docs(status): Phase C demo lane code-complete

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase C Definition of Done

- `npm run build` green; `npm test` green (data integrity + launch audit + generated-embedding shape tests).
- Zero-permission demo verified: tap a sample question → instant spoken answer, no mic/model/network — works on any browser (including ones without WebGPU).
- Optional live path verified on a WebGPU device (or graceful fallback elsewhere).
- Launch-materials audit passes (no employer/colleague/internal-product references) — enforced by a test.
- `STATUS.md` Phase 5 updated.

## Notes / carried items

- **CSS:** the new `.sample-q-row` / `.sample-q-live` / `.demo-hint` classes are unstyled by default; styling polish is cosmetic and can be a follow-up (the demo is functional without it).
- **`inference` shim** in `inference.ts` becomes unused after this phase (Demo now uses `getInference()` for live). Removing it is a trivial follow-up cleanup; left in place here to keep the task scoped.
- **Deployment to ondeviceml.space** (vs the current Vercel "voice-memory" project) is a launch/deploy concern (Phase 6), not this plan.
- **Curated vs model-generated answers:** shipping curated (regenerable) answers is a deliberate choice so the demo has zero device dependency; Step 4 regenerates real ones during the single device session if desired.
