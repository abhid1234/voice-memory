# CLAUDE.md — voice-memory project context

## What this is

**VoiceMemory** — a PWA personal voice-memory system. Voice in / voice out on phone. On-device Gemma 4 (via MediaPipe) for inference. Anti-gravity 2.0 weekly LoRA fine-tunes the model on the user's own transcripts so it gradually starts answering in their voice/style. Public demo lane lives on ondeviceml.space using synthetic memory so strangers can experience the magic with zero permissions.

Project I in Abhi's `RL & Agentic AI Project Pipeline` tracker. Direct response to the Google I/O '26 Developer Keynote demo (voice → fine-tune Gemma 4 in minutes) — extended into a continually-improving system that lives on the phone.

**Spec:** see `docs/spec.md`.
**Status:** see `STATUS.md`.

## v1 scope (locked via D2, 2026-05-19)

- Deploy: PWA on phone (Chromebook fallback for inference if mobile WebGPU is rough)
- Capture: voice memos + post-meeting reflections only, under ~2 min, foreground recording
- Training: weekly LoRA via Anti-gravity cron, ~$10-15 build + ~$3/wk ongoing
- Public demo: zero-permission tap-to-query buttons on ondeviceml.space with synthetic memory

**Explicitly NOT in v1:** live in-meeting capture (deferred to v3 — requires Capacitor.js native shell + two-party-consent UX, blocked by browser background-recording limitation).

## Hard constraints — DO NOT VIOLATE

1. **On-device inference only.** No cloud inference in the hot path. Training is the ONLY cloud touch (weekly LoRA on Vertex via Anti-gravity, on user's own signed jobs). Matches the ondeviceml.space thesis.
2. **PWA, not native app.** v1 ships as PWA, not iOS/Android native. Capacitor.js wrapper is v3 and only if/when needed for background recording.
3. **No live meeting recording in v1.** Voice memos and post-meeting reflections only. Live capture has hard browser limits AND legal complexity (two-party-consent states). v3 problem.
4. **Don't divert from ODML Research mode or vla-bench.** Both are higher-priority active work per their respective STATUS.md files. VoiceMemory is weekend-shaped, ships in 2 weekends, doesn't compete for their compute budget.
5. **Per `feedback_social_posts_never_in_git.md` — no LinkedIn or Substack drafts in this repo.** Launch posts live outside git.
6. **Per `feedback_no_employer_in_launch_materials.md` — no Google Cloud / employer / 20% / colleague refs in any public launch artifact.** This includes ondeviceml.space copy and LinkedIn post.

## Architecture pointers

```
voice-memory/
├── docs/
│   └── spec.md                   # full v1 spec, scope tradeoffs, phase plan
├── app/                          # PWA (Phase 1)
│   ├── src/
│   │   ├── record/               # capture flow + Whisper.cpp STT
│   │   ├── query/                # voice query + RAG over IndexedDB
│   │   ├── timeline/             # browse captures
│   │   └── inference/            # MediaPipe Gemma 4 wrapper
│   ├── public/
│   │   └── manifest.json         # PWA manifest, Add-to-Home-Screen
│   └── sw.js                     # service worker for offline
├── training/                     # Anti-gravity pipeline (Phase 4)
│   ├── agent-config.yaml         # weekly cron + LoRA job definition
│   └── lora-export.ts            # pack quantized LoRA for phone shipment
├── public-demo/                  # ondeviceml.space lane (Phase 5)
│   ├── synthetic-memory.json     # pre-loaded fake AI industry conversations
│   └── sample-queries.json       # tap-to-query buttons
└── package.json
```

**Stack:**
- PWA: Next.js or Vite + service worker + IndexedDB storage
- STT: Whisper.cpp (WASM) or transformers.js whisper-small
- Inference: MediaPipe `tasks-genai` for Gemma 4 quantized on-device
- TTS: browser Web Speech API (free, on-device) or piper.wasm
- Training: Anti-gravity CLI → Vertex AI LoRA fine-tune → quantized LoRA shipped via signed URL
- Storage: IndexedDB on phone (note: iOS Safari may purge after ~7d non-use; mitigation TBD)

## Open design questions resolved by D2

All 4 from the spec are now answered:
1. PWA + Chromebook fallback (Q1)
2. Weekly LoRA, not nightly (Q2)
3. Anti-gravity free tier + ~$3/wk Vertex (Q3)
4. Synthetic AI-industry conversations for public demo (Q4)

## Common commands (Phase 1+ will populate)

```bash
npm install              # Phase 1 setup
npm run dev              # local PWA dev server
npm test                 # vitest
npm run build            # production PWA bundle
# Anti-gravity CLI commands TBD (Phase 4)
```

## How to work with Abhi

Carries from `~/Core/Workspace/ClaudeCode/CLAUDE.md`:
- Be concise and direct. Lead with the answer.
- Non-engineer; knows GCP and partnerships, intermediate React/TS. Frame technical decisions for someone who can read code but doesn't write it daily.
- Default to sub-agents for research, multi-file reads, transcript analysis.
- Never commit social/launch/marketing drafts.
- Visual outputs: iterate at least twice against skill rules before showing.

## Strategic context

VoiceMemory is the bigger-budget sibling of Project H (Wiki Broadcast). Both target the same LinkedIn audience (AI builders, on-device AI watchers) but VoiceMemory has the Google I/O launch tailwind from Anti-gravity 2.0 + Gemma 4 announcements (2026-05-19). The "I beat the keynote demo" narrative is the specific hook.

Sister/predecessor projects in the tracker:
- Project F (Personal AI Companion / Sutando-inspired) — voice + multi-transport pattern, broader
- Project G (Nano-Transformer to Browser) — train-and-ship-to-browser pattern, deeper
- Project H (Wiki Broadcast / VibeVoice) — same "audio + LinkedIn play" lane, simpler
- VoiceMemory is the synthesis: continual training (G's training rigor) + voice loop (F's transport) + LinkedIn polish (H's shippability).
