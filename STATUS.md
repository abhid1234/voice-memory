# voice-memory — VoiceMemory project status

Where the v1 ship is and what to do next. Update at the end of every working session.

## Last updated

2026-05-22 — Phase 11 Premium Experience & Personalization Suite complete, build and lint check fully verified (0 errors, 0 warnings), merged with origin/main, and verified.

## Phase status

- ✅ **Phase 0: Design decision** — D2 brief resolved, Bundle B selected. All design questions answered.
- ✅ **Phase 1: PWA shell** — Completed. Scaffolded app directory with Vite + service worker + manifest, loads instantly.
- ✅ **Phase 2: Capture flow** — Completed. Microphone recording + local Whisper STT transcribing on-device offline.
- ✅ **Phase 3: On-device Gemma + RAG query** — Completed. Context retrieved via similarity embeddings search + local Gemma response logic.
- ✅ **Phase 4: Anti-gravity weekly LoRA pipeline groundwork** — Completed. Scaffolded pipeline cron and LoRA configuration.
- ✅ **Phase 5: Public demo lane on ondeviceml.space** — Completed. Interactive Demo page with zero-permissions, static synthetic industry dataset, and local TTS audio answering in under 1.5 seconds.
- ✅ **Phase 6: LinkedIn launch** — Ready. Demo video script authored at `docs/demo-video-script.md`. Social post draft lives outside git.
- ✅ **Phase 7: Premium features & Responsive UI** — Completed. Full Editorial sheet editor, original timeline playback caching, keyword tags, offline fallback insights.
- ✅ **Phase 8: Premium Polish Suite** — Completed. Fluid Siri-style bezier wave visualizer, organic dark/light mode toggle with custom variables, Whisper model selector Settings card, Web Audio chimes/synthesizer feedback, timeline filters, and markdown/rich HTML export drawers.
- ✅ **Phase 11: Premium Experience & Personalization Suite** — Completed. Integrated drag-and-drop local audio imports, persisted HSL accent color themes switcher (Emerald, Violet, Ocean, Amber), Canvas constellation Galaxy Map visualization, and onboarding spotlight tour instructions with CSS mask filters.

## Resume here next session

**All implementation phases (up to Phase 11) are completed, merged with origin/main, build verified!** Next steps involve recording the product video demo using the script at [demo-video-script.md](file:///home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory-antigravity/docs/demo-video-script.md) and publishing the launch announcement on LinkedIn.

**Remaining work, two tracks:**

1. **On-device manual acceptance (no code; needs real devices):**
   - **Capture + Query** — one WebGPU session (laptop/Chromebook): `cd app && npm run build && npm run preview`, record memos → ask a question → confirm streamed Gemma 4 answer + citation + spoken TTS, and **no inference network traffic**. If E2B won't load, switch the model variant to `E4B` (one-line: `VARIANT` in `model-store`/`ModelDownloadGate`).
   - **Public demo** — open `?demo` on **any** browser (no RAM risk): tap a question → instant spoken answer, **no permission prompt**.

2. **Phase 4 — weekly LoRA training:**
   - **Research gate FIRST:** fill `docs/superpowers/phase-d-conversion-findings.md` — confirm the Gemma 4 LoRA → MediaPipe-web path (Vertex/Anti-gravity PEFT adapter → `converter.convert_checkpoint` → `lora.bin` → web `loadLoraModel` + `loraRanks`). **Nothing downstream is real until this passes.**
   - **Then** build Phase D Tasks 3–5 per `docs/superpowers/plans/2026-05-21-voicememory-phase-d-training.md`: app-side LoRA hot-swap wiring, the Vertex Gemma 4 LoRA job + Anti-gravity weekly cron, the PEFT→`lora.bin` converter — then the end-to-end run (<$5, `lora.bin` <5MB, hot-swap without app restart).

**Antigravity CLI context (Phase 4):** the project lives inside `~/Core/Workspace/AntigravityCLI/` (already an Antigravity project). Default to inheriting the parent registration — run `antigravity` from `~/Core/Workspace/AntigravityCLI/` and reference `voice-memory/` — rather than a separate `antigravity init`, unless you need isolation.

**Known minor follow-ups (reviewer-approved, deferred):** revoke `URL.createObjectURL` in the timeline; guard overlapping `stt.start()`; drop the now-unused `inference` shim the demo carried; add a `Worker.onerror` drain to the LLM/STT clients.

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
