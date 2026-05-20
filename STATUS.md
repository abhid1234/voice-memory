# voice-memory — VoiceMemory project status

Where the v1 ship is and what to do next. Update at the end of every working session.

## Last updated

2026-05-20 — Relocated from `~/Core/Workspace/ClaudeCode/voice-memory/` to `~/Core/Workspace/AntigravityCLI/voice-memory/` to live inside the Antigravity CLI workspace. Phase 0 complete (D2 decided, Bundle B locked); project scaffolded; Phase 1 is next milestone.

## Phase status

- ✅ **Phase 0: Design decision** — D2 brief resolved, Bundle B selected (PWA + weekly LoRA + ~$15 + public demo + scope-tightened to voice memos only). All 4 open design questions answered. Scope discipline locked: NO live meeting capture in v1 (deferred to v3).
- ⏳ **Phase 1: PWA shell** — `app/` directory with Next.js or Vite + service worker + manifest.json + Add-to-Home-Screen flow + IndexedDB scaffolding. Acceptance: tap the install banner on phone, app icon appears on home screen, opens full-screen, loads in <2 sec. ~1 weekend.
- ⏸️ **Phase 2: Capture flow** — Record button + Whisper.cpp (WASM) live transcription + IndexedDB save + transcript scrolls live as user speaks. Acceptance: 30-sec voice memo captured, transcribed, saved offline, retrievable from timeline. ~half weekend.
- ⏸️ **Phase 3: On-device Gemma 4 + RAG query** — Load quantized Gemma 4 via MediaPipe tasks-genai. RAG index over IndexedDB transcripts. Voice query → text answer + cite. Acceptance: "what did I record about X" returns relevant transcript chunk via on-device search. ~half weekend.
- ⏸️ **Phase 4: Anti-gravity weekly LoRA pipeline** — Anti-gravity agent-config.yaml with weekly cron + LoRA training job. Quantized LoRA shipped back to phone via signed URL. Acceptance: weekly training job runs successfully end-to-end on Vertex; LoRA delta < 5MB; phone hot-swaps the new LoRA without app restart. ~1 weekend.
- ⏸️ **Phase 5: Public demo lane on ondeviceml.space** — New tab/route with synthetic-memory.json pre-loaded + tap-to-query sample buttons + on-device Gemma + TTS playback. ZERO permissions required. Acceptance: stranger lands on URL inside LinkedIn's in-app browser, taps a sample query, hears voice answer within 1.5 sec, no permission prompts triggered. ~half weekend.
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
