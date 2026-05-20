# Spec — VoiceMemory v1

**Status:** Bundle B locked via D2 (2026-05-19), scaffold complete, Phase 1 (PWA shell) is next
**Owner:** Abhi Das
**Project:** I in `RL & Agentic AI Project Pipeline` tracker

## What this is

A PWA personal voice-memory system. Voice in / voice out on phone. On-device Gemma 4 (via MediaPipe `tasks-genai`) for inference. Anti-gravity 2.0 weekly LoRA fine-tunes the model on the user's own transcripts so it gradually starts answering in their voice/style. Public demo lane lives on ondeviceml.space using synthetic memory so strangers can experience the magic with zero permissions.

Direct response to the Google I/O '26 Developer Keynote demo (voice → fine-tune Gemma 4 in minutes) — extended into a continually-improving system that lives in your pocket.

## User story

> As a knowledge worker, I want to capture short voice memos and post-meeting reflections on my phone. The model should remember everything I've said, answer voice questions about it (also on-device, offline), and gradually learn to talk like me by re-training itself weekly. I never want my transcripts to leave my phone for inference; the only cloud touch is a signed weekly LoRA job I control.

## Architecture — the RAG + LoRA split (the non-obvious design choice)

Most "personal AI memory" products conflate two different jobs and end up doing both badly. VoiceMemory keeps them separate:

| Job | Mechanism | Frequency | Why |
|---|---|---|---|
| **Fact recall** ("what did I say about X?") | RAG over IndexedDB transcripts | Real-time, every query | Free, instant, doesn't require fine-tuning. Pure retrieval. |
| **Voice/idiom style** ("answer the way I'd write it") | LoRA fine-tune on transcripts | Weekly | Actually moves model weights. Slow, costs ~$3/wk, but compounds. |

Don't conflate. RAG handles "remember this", LoRA handles "talks like me." The launch writeup gets a section on this.

## UX flow (the magic moment)

```
[1] User taps record button → speaks 30-sec memo
    └─ Whisper.cpp (WASM) transcribes live in browser
    └─ Saves to IndexedDB on phone
            ↓
[2] On-device Gemma 4 extracts: speakers, action items, topics, people
            ↓
[3] (Later, voice query) User holds query button → speaks question
    "What did Chintan say about LiteRT.js last week?"
            ↓
[4] On-device Gemma 4 does RAG over IndexedDB → finds relevant transcript chunk
            ↓
[5] On-device Gemma 4 (with weekly LoRA applied) generates answer in user's voice/style
            ↓
[6] Browser Web Speech API (TTS) reads the answer aloud
    Citation chip → tap to jump to original audio clip
```

Total latency target: < 1.5 sec from end-of-query to start-of-answer speech.

## Reused primitives (don't rebuild)

- **MediaPipe `tasks-genai` Gemma 4 loader** — reuse from ondeviceml.space / Web AI Bench
- **WebGPU inference patterns** — reuse from your existing on-device chat demos
- **PWA install + service worker patterns** — standard, copy from Next.js PWA template
- **Blob URL pattern for model loading** — per `feedback_odml_mediapipe_constraints.md` (self.import breaks streaming/WebGPU)

## Why this differentiates from existing products

| Existing product | VoiceMemory |
|---|---|
| **Rewind** (Mac native, cloud-mediated screen + audio capture) | On-device inference, no cloud in hot path, phone-first |
| **Limitless / Friend** (wearable + cloud) | No special hardware, lives in phone, no monthly subscription |
| **Apple Voice Memos** (no AI) | Adds on-device understanding + voice query |
| **Google Recorder** (transcription only, cloud) | Adds RAG + fine-tuning + offline inference |
| **Google I/O keynote demo** (one-shot fine-tune) | Continual weekly LoRA + on-device deployment + public demo + voice-out loop |

The unique combination: **on-device + continual + voice-loop + public demo with zero permissions**. No competitor has all four.

## Models

| Phase | Model | Why |
|---|---|---|
| STT (browser) | Whisper.cpp WASM (~40MB tiny.en) | Free, on-device, good enough for short memos |
| RAG embeddings | MiniLM-L6 or built-in Gemma embeddings | Cheap, fast, MTEB-respectable |
| Inference | Gemma 4 quantized int4 (~1-2GB) | On-device feasible on modern phones, Apache 2.0 |
| LoRA training | Gemma 4 base + LoRA adapter | LoRA delta < 5MB, hot-swappable on phone |
| TTS | Browser Web Speech API | Free, on-device, no model to load |

## File scaffolding (Phase 1)

```
app/
├── src/
│   ├── App.tsx                      # Top-level route + nav
│   ├── pages/
│   │   ├── Record.tsx               # Tap-to-record + live transcript
│   │   ├── Query.tsx                # Hold-to-talk query + voice-answer
│   │   └── Timeline.tsx             # Chronological captures list
│   ├── lib/
│   │   ├── stt.ts                   # Whisper.cpp wrapper
│   │   ├── inference.ts             # MediaPipe Gemma 4 wrapper
│   │   ├── rag.ts                   # RAG over IndexedDB
│   │   └── storage.ts               # IndexedDB schema + CRUD
│   └── components/
│       ├── RecordButton.tsx
│       ├── TranscriptScroll.tsx
│       └── CitationChip.tsx
├── public/
│   ├── manifest.json                # PWA manifest, theme, icons
│   └── icons/                       # PWA icons (multiple sizes)
└── sw.js                            # service worker (offline + caching)
```

## Phase plan (mirrors STATUS.md)

| Phase | Scope | Time | Acceptance |
|-------|-------|------|------------|
| 1 | PWA shell + install flow | ~1 weekend | Tap Add-to-Home-Screen on phone, icon appears, full-screen launches in <2 sec |
| 2 | Capture flow (Whisper + IndexedDB) | ~half weekend | Record 30-sec memo, see live transcript, replay offline |
| 3 | On-device Gemma 4 + RAG query | ~half weekend | Voice query returns text answer + cite from local transcripts |
| 4 | Anti-gravity weekly LoRA pipeline | ~1 weekend | Weekly fine-tune runs end-to-end, LoRA shipped back to phone via signed URL |
| 5 | Public demo lane on ondeviceml.space | ~half weekend | Stranger taps URL in LinkedIn in-app browser, hears answer in <1.5 sec, zero permission prompts |
| 6 | LinkedIn launch coordination | ~half weekend | Demo video + launch post + ondeviceml.space deploy synced to one Sunday evening |

## Acceptance criteria for v1 launch

- ✅ Tap record on phone, see live transcript, replay clip offline
- ✅ Voice query returns text + voice-synthesized answer in <1.5 sec, on-device
- ✅ Weekly Anti-gravity LoRA fine-tune runs successfully on Vertex with <$5 per run
- ✅ Quantized LoRA delta hot-swaps on phone without app restart
- ✅ Public demo on ondeviceml.space lane works in LinkedIn's in-app browser with zero permission prompts
- ✅ Demo video produced (script in `docs/demo-video-script.md`, video file outside git per `feedback_social_posts_never_in_git.md`)
- ✅ Existing ondeviceml.space features still work (no regressions on the other 24 demos)

## Out of scope for v1 (defer to v2-v3)

- **Live in-meeting capture** (v3) — requires Capacitor.js native shell (PWAs can't background-record) AND two-party-consent UX (varies by state)
- **Cross-device sync** (v5+) — phone-only in v1, no multi-device transcript sync
- **Speaker diarization** in multi-voice recordings — single-voice memos only in v1
- **Always-on listening / wake word** — v4+ at minimum, has battery + creepiness costs
- **Sharing memories with another user** — privacy story collapses; never doing this
- **Persistent cross-session memory beyond IndexedDB** — handled by weekly LoRA already

## Public demo design (zero-permission)

The ondeviceml.space lane is critical for LinkedIn conversion. Stranger lands in LinkedIn's in-app browser (which often blocks `getUserMedia`), so the demo MUST NOT require microphone access. Design:

```
┌─────────────────────────────┐
│  Try VoiceMemory            │
│  (no permissions needed)    │
│                             │
│  This is a synthetic memory │
│  of Abhi's AI industry      │
│  conversations.             │
│                             │
│  Tap a sample question:     │
│                             │
│ [▶ "What did Sam say        │
│     about model scaling?" ] │
│                             │
│ [▶ "Who's blocking the      │
│     Q3 launch?" ]           │
│                             │
│ [▶ "Summarize this week's   │
│     LiteRT discussions" ]   │
│                             │
│  ─────────────────────      │
│  Answer plays via browser   │
│  text-to-speech below       │
│                             │
│  [ Install for yourself ]   │
│  ← only here does the app   │
│    ask for mic permission   │
└─────────────────────────────┘
```

Synthetic memory dataset: 20-30 fake transcripts (1-3 min each) of conversations about WebGPU, LiteRT, on-device inference, AI infra. Pre-indexed via RAG embeddings. Stored as static JSON in the ondeviceml.space build.

## Test prompts (for the synthetic demo)

1. "What did Sam say about model scaling in our Tuesday call?"
2. "Who flagged the Q3 launch as blocked?"
3. "Summarize this week's LiteRT discussions."
4. "What did I commit to in standup?"
5. "Who keeps mentioning Anti-gravity 2.0?"

If all 5 produce coherent answers from the synthetic memory in <1.5 sec, the public demo is launch-ready.

## Reference implementations to study

- **GemmaDesktop** (`LyalinDotCom/GemmaDesktop`) — the desktop equivalent of this pattern. Read the voice loop implementation, ignore the Electron shell.
- **HuggingFace transformers.js whisper examples** — for the in-browser STT pattern.
- **MediaPipe `tasks-genai` Gemma quickstart** — for the on-device Gemma 4 loader.
- **vite-plugin-pwa documentation** — for the PWA install + service worker setup.
- **ondeviceml.space's existing `chat` feature** — for the model loading + inference pattern this project will reuse.

## LinkedIn launch frame (lives OUTSIDE git per `feedback_social_posts_never_in_git.md`)

Two narratives that land. Pick the one that performs:

1. **"I beat Google's keynote demo"** — *"Google I/O showed Gemma 4 fine-tuned once on stage. I made it fine-tune itself every week, on my voice, in my pocket. Open source, on-device, here's the demo."*
2. **"Privacy-first Rewind"** — *"Personal AI memory products are cloud-mediated and creepy. I built the on-device version. Voice in, voice out, weekly self-training. Your transcripts never leave your phone."*

Test both in draft form, pick whichever gets stronger first-comment engagement from your warm network.
