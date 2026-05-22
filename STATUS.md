# voice-memory — VoiceMemory project status

Where the v1 ship is and what to do next. Update at the end of every working session.

## Last updated

2026-05-22 — Phases 1–3 + the public demo lane built and **merged to `main`** (squash-per-phase: A `177f55a` capture, B `a1eb500` query, C `d69c2c2` demo, D-groundwork `786ed63` training export + research gate). All `npm run build` + unit tests green. Remaining: on-device manual acceptance, and Phase 4 (weekly LoRA training) — gated on the conversion-path research doc.

## Phase status

- ✅ **Phase 0: Design decision** — D2 brief resolved, Bundle B selected (PWA + weekly LoRA + ~$15 + public demo + scope-tightened to voice memos only). All 4 open design questions answered. Scope discipline locked: NO live meeting capture in v1 (deferred to v3).
- ✅ **Phase 1: PWA shell** — Vite + React 19 + `vite-plugin-pwa` (manifest + service worker generated in `dist/sw.js`) + IndexedDB (via `idb`). Builds clean. Manual on-phone install (Add-to-Home-Screen) test still pending on a real device.
- ✅ **Phase 2: Capture flow** — **MERGED to `main`** (`177f55a`). Built via subagent-driven execution of `docs/superpowers/plans/2026-05-20-voicememory-phase-a-capture.md`). Built: chunked near-live **on-device** STT (transformers.js `Xenova/whisper-tiny.en` in a Web Worker — NOT Whisper.cpp; per design decision D-3, re-decode the accumulated buffer every ~8s for a cumulative partial, authoritative full pass on stop), MiniLM-L6 embeddings, IndexedDB with an `embedding` field + `getMemo`, Record→embed→save (**save race fixed** — saves the transcript returned by `stop()`, not React state), timeline + offline `<audio>` replay. Automated gates: `npm run build` green (worker bundles, SW generates), 15 unit tests green. ⚠️ **ON-DEVICE MANUAL VERIFICATION PENDING** — record→transcribe→save→replay + "no audio leaves device during transcription" must be checked on a real device (a headless subagent can't exercise mic/WebGPU). Known Minor follow-ups (reviewer-approved, deferred): revoke `URL.createObjectURL` in the timeline; guard against overlapping `stt.start()`. Acceptance: 30-sec memo captured, transcribed, saved offline, retrievable from timeline.
- ✅ **Phase 3: On-device Gemma 4 + RAG query** — **MERGED to `main`** (`a1eb500`). Built: OPFS download-once + WebGPU detection (`model-store`), MediaPipe **Gemma 4** (E2B default / E4B Chromebook) loaded from OPFS bytes via `modelAssetBuffer` in a dedicated `llm-worker`, hand-formatted Gemma 4 prompt, **cosine-similarity RAG** over the Phase A embeddings, streaming-token UI + Web Speech **TTS** + citations, and a `ModelDownloadGate` (WebGPU check + one-time download with progress + Chromebook fallback). Robustness: partial-download delete-on-error, retryable LLM init, memos-without-embeddings filtered. Automated gates: `npm run build` green, 29 unit tests green. ⚠️ **ON-DEVICE MANUAL VERIFICATION PENDING** — the dedicated de-risk spike was intentionally skipped; a single on-device acceptance is the remaining gate: download model → ask a question → streamed Gemma 4 answer + citation + spoken TTS, and confirm **no inference network traffic** (only one-time model/wasm fetches), on a WebGPU device (laptop/Chromebook). Carried v1 limits: no `Worker.onerror` drain; iOS Safari WebGPU unverified.
- 🔨 **Phase 4: weekly LoRA training** — **groundwork MERGED to `main`** (`786ed63`): tested transcripts→training JSONL (`toTrainingJsonl`) + the research-gate doc. The pipeline itself (Vertex Gemma 4 LoRA job, Anti-gravity weekly cron, PEFT→`lora.bin` converter, app-side hot-swap wiring) is **GATED on the research doc** `docs/superpowers/phase-d-conversion-findings.md` (confirm the Gemma 4 LoRA → MediaPipe-web path). Plan: `docs/superpowers/plans/2026-05-21-voicememory-phase-d-training.md`. Acceptance: weekly Vertex job <$5; `lora.bin` <5MB; phone hot-swaps without restart.
- ✅ **Phase 5: Public demo lane** — **MERGED to `main`** (`d69c2c2`). Built: a zero-permission tap-to-query Demo route — 12 audited synthetic transcripts (build-time MiniLM embeddings via `npm run precompute:demo`) + 5 sample questions with curated (regenerable) **precomputed answers** shown instantly + Web Speech **TTS**, needing **NO mic / model / GPU / network**; plus an optional **⚡ live** path (embed → cosine RAG → Gemma 4 via the Phase B `inference` worker) for WebGPU browsers, with graceful fallback. Launch-materials audit (no employer / internal-product / 20% refs) is **enforced by a test**. Automated gates: `npm run build` green, 34 unit tests green. ⚠️ **MANUAL ACCEPTANCE PENDING (low-risk, any browser)**: open `?demo` → tap a question → instant spoken answer with no permission prompt and no inference network traffic; optional `⚡ live` on a WebGPU device. The curated answers can be regenerated with the real model via the `⚡ live` path. Acceptance: a stranger taps a sample query and hears a voice answer in <1.5s with zero permission prompts.
- ⏸️ **Phase 6: LinkedIn launch** — Per `feedback_social_posts_never_in_git.md`, launch post drafts live OUTSIDE this repo. Demo video script lives in `docs/demo-video-script.md` (allowed). Launch coordinated to land within 2 weeks of Google I/O '26 to capture tailwind.

## Resume here next session

**Phases 1–3 + the public demo lane are built and MERGED to `main`** (squash-per-phase: A `177f55a` capture · B `a1eb500` query · C `d69c2c2` demo · D-groundwork `786ed63`). `npm run build` + all unit tests green. Specs/plans are in `docs/superpowers/`. The isolated dev worktree (`.claude/worktrees/claude-session`, branch `phase-d-training`) holds the same content.

**Remaining work, two tracks:**

**1. On-device manual acceptance (no code; needs real devices):**
- **Capture + Query** — one WebGPU session (laptop/Chromebook): `cd app && npm run build && npm run preview`, record memos → ask a question → confirm streamed Gemma 4 answer + citation + spoken TTS, and **no inference network traffic**. If E2B won't load, switch the model variant to `E4B` (one-line: `VARIANT` in `model-store`/`ModelDownloadGate`).
- **Public demo** — open `?demo` on **any** browser (no RAM risk): tap a question → instant spoken answer, **no permission prompt**.

**2. Phase 4 — weekly LoRA training (only phase left):**
- **Research gate FIRST:** fill `docs/superpowers/phase-d-conversion-findings.md` — confirm the Gemma 4 LoRA → MediaPipe-web path (Vertex/Anti-gravity PEFT adapter → `converter.convert_checkpoint` → `lora.bin` → web `loadLoraModel` + `loraRanks`). **Nothing downstream is real until this passes.**
- **Then** build Phase D Tasks 3–5 per `docs/superpowers/plans/2026-05-21-voicememory-phase-d-training.md`: app-side LoRA hot-swap wiring, the Vertex Gemma 4 LoRA job + Anti-gravity weekly cron, the PEFT→`lora.bin` converter — then the end-to-end run (<$5, `lora.bin` <5MB, hot-swap without app restart).

**Antigravity CLI context (Phase 4):** the project lives inside `~/Core/Workspace/AntigravityCLI/` (already an Antigravity project). Default to inheriting the parent registration — run `antigravity` from `~/Core/Workspace/AntigravityCLI/` and reference `voice-memory/` — rather than a separate `antigravity init`, unless you need isolation.

**Known minor follow-ups (reviewer-approved, deferred):** revoke `URL.createObjectURL` in the timeline; guard overlapping `stt.start()`; drop the now-unused `inference` shim the demo carried; add a `Worker.onerror` drain to the LLM/STT clients.

**Process lessons (saved to project memory):** every code task's gate must run `npm run build` (vitest doesn't typecheck); subagents need hard git guardrails; don't squash a stacked PR series (use rebase/merge-commits) — see `MEMORY.md`.

## Decisions log (don't relitigate without reason)

| Date | Decision | Reason |
|------|----------|--------|
| 2026-05-19 | Bundle B selected over A and C (D2) | A misses LinkedIn moment, C kills "in my pocket" hook. B keeps both with friction de-risked. |
| 2026-05-19 | Voice memos + post-meeting reflections only in v1; live capture is v3 | PWAs can't background-record (hard browser limit); live also needs two-party-consent UX. |
| 2026-05-19 | PWA, not native iOS/Android app | Lower friction, cross-platform, no app store gate. Capacitor.js wrapper only if/when v3 needs it. |
| 2026-05-19 | Weekly LoRA, not nightly or on-demand | Nightly = too little delta to move weights. Weekly = realistic data threshold AND predictable $3/wk cost. |
| 2026-05-19 | Public demo uses pre-recorded synthetic memory + tap-to-query buttons | Zero permissions required → works inside LinkedIn's in-app browser → no adoption-friction killer. |
| 2026-05-19 | RAG handles fact recall, LoRA handles voice/idiom style | Honest architectural split. Don't conflate. Most products do; the launch writeup gets a section on this. |
| 2026-05-19 | Anti-gravity (not custom training pipeline) | Free tier, Google's brand-new platform, early-mover advantage. Vertex compute is the only paid piece (~$2-5 per weekly LoRA). |
| 2026-05-20 | Project relocated to `~/Core/Workspace/AntigravityCLI/voice-memory/` | Lives inside the Antigravity CLI-registered workspace so the build/training pipeline (Phase 4) inherits Antigravity project context automatically. |

## Things I'd flag to a new session

- **Don't propose live meeting capture in v1.** Hard browser limit (PWAs can't background-record). v3 problem. If user asks, propose voice memos / post-meeting reflections as the v1 path.
- **Don't suggest cloud inference.** On-device only. Whole thesis depends on this. Training is the only cloud touch.
- **Don't suggest a native iOS/Android app.** PWA discipline. Only escalate to Capacitor.js if Phase 5 acceptance fails on real phones.
- **Don't draft launch posts in this repo.** Per `feedback_social_posts_never_in_git.md`. Demo video script is OK (`docs/demo-video-script.md`).
- **Don't reference Google Cloud / 20% / employer / colleagues in public launch artifacts.** Per `feedback_no_employer_in_launch_materials.md`.
- **Don't conflate RAG and LoRA.** They do different things in this system. Read `docs/spec.md` section on the architectural split before suggesting design changes.
- **Don't over-engineer storage.** IndexedDB is fine for v1. Don't pull in Dexie unless you hit a real ergonomics problem.
- **iOS Safari may purge IndexedDB after ~7 days of non-use.** Known issue. Mitigation: "Add to Home Screen" PWA install bumps the storage class (slightly more durable). If purges become a real problem, escalation to SQLite via OPFS or Capacitor.js is v2+.

## Open issues / known unknowns

- **iOS Safari IndexedDB purge after 7 days.** Acceptable for power users who open the app weekly; problem for casual users. Watch for it; document in launch post if it bites.
- **Mobile WebGPU support for MediaPipe Gemma 4.** Spec says capable but real-world performance on iPhone Safari is untested. Chromebook fallback is the backup plan.
- **Anti-gravity LoRA → MediaPipe quantization path.** Need to confirm Anti-gravity exports a format MediaPipe `tasks-genai` can hot-load on phone. May need an intermediate conversion step (quantization to int8/int4). Phase 4 work.
- **Synthetic AI-industry memory dataset for public demo.** Needs to be authored. Candidates: lightly-fictionalized conversations about WebGPU / LiteRT / on-device inference. Could be 20-30 fake transcripts of 1-3 min each.
