# voice-memory — VoiceMemory project status

Where the v1 ship is and what to do next. Update at the end of every working session.

## Last updated

2026-05-20 — Relocated from `~/Core/Workspace/ClaudeCode/voice-memory/` to `~/Core/Workspace/AntigravityCLI/voice-memory/` to live inside the Antigravity CLI workspace. Phase 0 complete (D2 decided, Bundle B locked); project scaffolded; Phase 1 is next milestone.

## Phase status

- ✅ **Phase 0: Design decision** — D2 brief resolved, Bundle B selected (PWA + weekly LoRA + ~$15 + public demo + scope-tightened to voice memos only). All 4 open design questions answered. Scope discipline locked: NO live meeting capture in v1 (deferred to v3).
- ✅ **Phase 1: PWA shell** — Vite + React 19 + `vite-plugin-pwa` (manifest + service worker generated in `dist/sw.js`) + IndexedDB (via `idb`). Builds clean. Manual on-phone install (Add-to-Home-Screen) test still pending on a real device.
- 🔨 **Phase 2: Capture flow** — **CODE-COMPLETE on branch `worktree-claude-session`** (built via subagent-driven execution of `docs/superpowers/plans/2026-05-20-voicememory-phase-a-capture.md`). Built: chunked near-live **on-device** STT (transformers.js `Xenova/whisper-tiny.en` in a Web Worker — NOT Whisper.cpp; per design decision D-3, re-decode the accumulated buffer every ~8s for a cumulative partial, authoritative full pass on stop), MiniLM-L6 embeddings, IndexedDB with an `embedding` field + `getMemo`, Record→embed→save (**save race fixed** — saves the transcript returned by `stop()`, not React state), timeline + offline `<audio>` replay. Automated gates: `npm run build` green (worker bundles, SW generates), 15 unit tests green. ⚠️ **ON-DEVICE MANUAL VERIFICATION PENDING** — record→transcribe→save→replay + "no audio leaves device during transcription" must be checked on a real device (a headless subagent can't exercise mic/WebGPU). Known Minor follow-ups (reviewer-approved, deferred): revoke `URL.createObjectURL` in the timeline; guard against overlapping `stt.start()`. Acceptance: 30-sec memo captured, transcribed, saved offline, retrievable from timeline.
- 🔨 **Phase 3: On-device Gemma 4 + RAG query** — **CODE-COMPLETE on branch `phase-b-query`** (stacked on Phase A). Built: OPFS download-once + WebGPU detection (`model-store`), MediaPipe **Gemma 4** (E2B default / E4B Chromebook) loaded from OPFS bytes via `modelAssetBuffer` in a dedicated `llm-worker`, hand-formatted Gemma 4 prompt, **cosine-similarity RAG** over the Phase A embeddings, streaming-token UI + Web Speech **TTS** + citations, and a `ModelDownloadGate` (WebGPU check + one-time download with progress + Chromebook fallback). Robustness: partial-download delete-on-error, retryable LLM init, memos-without-embeddings filtered. Automated gates: `npm run build` green, 29 unit tests green. ⚠️ **ON-DEVICE MANUAL VERIFICATION PENDING** — the dedicated de-risk spike was intentionally skipped; a single on-device acceptance is the remaining gate: download model → ask a question → streamed Gemma 4 answer + citation + spoken TTS, and confirm **no inference network traffic** (only one-time model/wasm fetches), on a WebGPU device (laptop/Chromebook). Carried v1 limits: no `Worker.onerror` drain; iOS Safari WebGPU unverified.
- ⏸️ **Phase 4: Anti-gravity weekly LoRA pipeline** — Anti-gravity agent-config.yaml with weekly cron + LoRA training job. Quantized LoRA shipped back to phone via signed URL. Acceptance: weekly training job runs successfully end-to-end on Vertex; LoRA delta < 5MB; phone hot-swaps the new LoRA without app restart. ~1 weekend.
- 🔨 **Phase 5: Public demo lane** — **CODE-COMPLETE on branch `phase-c-demo`** (stacked on Phase B). Built: a zero-permission tap-to-query Demo route — 12 audited synthetic transcripts (build-time MiniLM embeddings via `npm run precompute:demo`) + 5 sample questions with curated (regenerable) **precomputed answers** shown instantly + Web Speech **TTS**, needing **NO mic / model / GPU / network**; plus an optional **⚡ live** path (embed → cosine RAG → Gemma 4 via the Phase B `inference` worker) for WebGPU browsers, with graceful fallback. Launch-materials audit (no employer / internal-product / 20% refs) is **enforced by a test**. Automated gates: `npm run build` green, 34 unit tests green. ⚠️ **MANUAL ACCEPTANCE PENDING (low-risk, any browser)**: open `?demo` → tap a question → instant spoken answer with no permission prompt and no inference network traffic; optional `⚡ live` on a WebGPU device. The curated answers can be regenerated with the real model via the `⚡ live` path. Acceptance: a stranger taps a sample query and hears a voice answer in <1.5s with zero permission prompts.
- ⏸️ **Phase 6: LinkedIn launch** — Per `feedback_social_posts_never_in_git.md`, launch post drafts live OUTSIDE this repo. Demo video script lives in `docs/demo-video-script.md` (allowed). Launch coordinated to land within 2 weeks of Google I/O '26 to capture tailwind.

## Resume here next session

**The exact next step: Phase 1 — scaffold the PWA shell.**

```bash
cd ~/Core/Workspace/AntigravityCLI/voice-memory/
# Decision still to make: Vite or Next.js? Vite is lighter and PWA-friendly.
# If picking Vite:
npm create vite@latest app -- --template react-ts
cd app
npm install
npm install vite-plugin-pwa workbox-window
# Then wire up manifest.json, service worker, IndexedDB scaffolding
```

**Antigravity CLI context (important for next session):** This project lives INSIDE `~/Core/Workspace/AntigravityCLI/` which is already registered as an Antigravity project (`.antigravitycli/` config symlinks to `~/.gemini/config/projects/<uuid>.json`). Two setup paths to choose from when you start Phase 4 (weekly LoRA pipeline):

1. **Inherit parent registration** — run `antigravity` commands from `~/Core/Workspace/AntigravityCLI/` and reference `voice-memory/` as a subdirectory. Simpler.
2. **Make voice-memory its own Antigravity project** — run `antigravity init` from `~/Core/Workspace/AntigravityCLI/voice-memory/` to get its own `.antigravitycli/` config. Cleaner isolation, but two registrations to maintain.

Default to #1 unless you find a specific reason to isolate.

Verify the PWA install path BEFORE going further:
1. Run `npm run dev` on the Chromebook, open the URL on your phone (same Wi-Fi or use ngrok)
2. Should see "Install app" banner on Chrome Android
3. On iOS Safari, manually share → Add to Home Screen
4. Confirm icon appears on home screen and opens full-screen (no browser chrome)

If install flow fails on either platform → fix BEFORE moving to Phase 2. Adoption friction work from D2 only matters if the install actually works.

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
