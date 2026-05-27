# VoiceMemory

**A personal voice-memory assistant that runs entirely on your phone.** Record a thought, transcribe it, ask questions about it later, and hear the answer spoken back — with **zero bytes leaving the device**. No account, no cloud inference, works in airplane mode.

`PWA` · `On-device Gemma 4 (WebGPU)` · `Whisper STT` · `RAG over IndexedDB` · `Zero-cloud hot path`

> **Try it now — no install, no permissions:** **[voice-memory-phi.vercel.app](https://voice-memory-phi.vercel.app/?demo)**
> The demo lane runs on synthetic memories with precomputed answers, so you can feel the loop in about a second without a mic, a download, or an account.

---

## The idea

Most voice assistants quietly send your private notes to someone's server. VoiceMemory asks the opposite question: could the *whole* loop — record, transcribe, retrieve, answer, speak — live on the phone, with nothing ever leaving it?

Not "encrypted in transit." Not "deleted after 30 days." Just: it never leaves.

The thing that sells it: record a memo, switch to airplane mode, reload, and ask a question. It transcribes, finds the right memory, generates an answer, and reads it back — fully offline, because there's no server in the loop. The only network request the app ever makes is the **one-time** model download.

---

## How it works

Everything below the dotted line happens on-device. The only crossing is the first-run model download.

```
  YOU                          ON-DEVICE (browser, no network)
  ───                          ──────────────────────────────────────────────
  🎙  speak  ───────────────▶  Whisper.cpp (WASM, Web Worker)  ──▶  transcript
                                                                       │
                                                          embed (on-device)
                                                                       ▼
                                                          IndexedDB  (your memories)
                                                                       ▲
  ❓ ask a question ──▶ embed query ──▶ cosine-similarity search ──────┘
                                              │ top matching memories
                                              ▼
                               Gemma 4 (E-series, WebGPU)  ──▶  answer
                                              │
                                              ▼
                                  Web Speech API (TTS)  ──▶  🔊 spoken reply
  ────────────────────────────────────────────────────────────────────────────
  one-time only:  model weights downloaded once, cached in OPFS/IndexedDB
```

---

## Retrieval vs. fine-tuning — and why v1 is retrieval-only

There are two different ways to make an assistant "know your stuff," and most products blur them:

| Job | Mechanism | What it's for | Status in v1 |
|---|---|---|---|
| **Recall facts** | RAG — embed your memories, look up the relevant ones at question-time | *what you said, when* | ✅ Shipping |
| **Match your voice** | LoRA fine-tune — nudge the model's weights toward your idiom | *style, not facts* | ⏳ Deferred to v1.1 |

v1 ships the honest version: **client-side retrieval over your own memories** (embeddings + cosine similarity, straight out of the browser's IndexedDB). The model reasons over what's retrieved — no training required to be useful on day one.

**The deferred part, said out loud:** the original vision included a weekly private fine-tune so the model gradually answers more like *you*. When I traced the path for shipping a converted adapter to a browser running the newest Gemma, the tooling isn't there yet (the documented adapter hot-swap targets older model families; a community conversion attempt hit a flat `Unknown special model` error). So v1.1 is gated on either the tooling maturing or a verifiable "merge-and-reship the whole model weekly" fallback. The training-pipeline groundwork lives in [`infra/`](infra/); the research log is in [`docs/superpowers/`](docs/superpowers/).

---

## What's in v1 (and what isn't)

**In:**
- Foreground voice capture (memos + post-meeting reflections, under ~2 min)
- On-device transcription, retrieval, generation, and speech-out
- A zero-permission public demo lane (`?demo`) with synthetic memories + precomputed answers
- Installable PWA (add to home screen, offline-first service worker)
- Optional cloud integrations (Gemini Cloud API fallback, client-side encrypted Firebase sync, and Google Sheets export)

**Not in v1 (on purpose):**
- **Live in-meeting recording** — hard browser limits *and* two-party-consent legal complexity. Deferred (would need a native shell).
- **"Learns your voice" fine-tuning** — deferred to v1.1 (see above).
- **iOS phone parity** — works great on a laptop / recent Chromebook; Safari's WebGPU + storage durability still need real-device testing. Honest status: phone is in progress.

---

## Optional Cloud Integrations & Self-Hosting

While the core hot-path runs entirely offline on-device, VoiceMemory introduces several optional, user-configured cloud integrations (disabled by default, requiring your own keys/credentials) to bridge workflows and backup data:

- **Gemini Cloud AI fallback**: Use your own Gemini API key for transcript polishing and action-item extraction when WebGPU is unavailable or disabled.
- **Firebase Firestore Sync**: Backup and sync memories across devices using client-side AES-GCM encryption (passwords never leave your browser).
- **Google Sheets Export**: One-click OAuth flow to append transcripts, tags, and insights directly to Google Sheets.
- **Dockerized Self-Hosting**: Run your own private instance of VoiceMemory locally or deploy it to Google Cloud Run (see [Self-Hosting Guide](docs/self-hosting.md)).

---

## Tech stack

| Layer | Choice |
|---|---|
| App | React 19 + TypeScript + Vite, installable PWA with offline service worker |
| Speech-to-text | Whisper (WASM) in a dedicated Web Worker, chunked near-live transcription |
| Inference | Gemma 4 (E-series) via MediaPipe `tasks-genai`, running on WebGPU |
| Retrieval | On-device embeddings + cosine similarity over IndexedDB |
| Text-to-speech | Browser Web Speech API |
| Storage | IndexedDB + OPFS model cache (downloads once, survives reloads) |

The model was the easy part. The time went to the plumbing: two Web Workers so the UI never freezes, chunked transcription, OPFS caching so the multi-hundred-MB model downloads exactly once, a real download gate with progress states, and an offline-first service worker. That's where "works in a demo" becomes "works on a Tuesday."

---

## Getting started

```bash
cd app
npm install      # install dependencies
npm run dev      # local dev server
npm test         # vitest unit tests
npm run lint     # eslint
npm run build    # production PWA bundle
```

**Prerequisites:** Node 18+ and a WebGPU-capable browser (Chrome/Edge 113+) for the full on-device lane. The `?demo` lane needs neither — it runs anywhere.

Full developer docs, feature details, and project layout live in **[`app/README.md`](app/README.md)**.

---

## Project layout

```
voice-memory/
├── app/        # React + TypeScript + Vite PWA  (see app/README.md)
├── docs/       # spec.md (spec), self-hosting.md, on-device-acceptance.md, demo script
├── infra/      # weekly LoRA training pipeline groundwork (deferred to v1.1)
├── Dockerfile  # Multi-stage container build setup
├── STATUS.md   # current state, scope decisions, what's next
└── CHANGELOG.md
```

- **Where the project stands:** [`STATUS.md`](STATUS.md)
- **Full v1 spec & scope tradeoffs:** [`docs/spec.md`](docs/spec.md)
- **Self-Hosting on Cloud Run:** [`docs/self-hosting.md`](docs/self-hosting.md)
- **Manual Acceptance Runbook:** [`docs/on-device-acceptance.md`](docs/on-device-acceptance.md)

---

## Try it / get in touch

- **Live demo (zero permissions):** [voice-memory-phi.vercel.app](https://voice-memory-phi.vercel.app/?demo) · also at [ondeviceml.space](https://ondeviceml.space)
- If you've shipped on-device AI in the browser, I'd love to compare notes — especially on the adapter-to-web pipeline, which still feels like the rough edge of the whole space. And if you try the demo, tell me what breaks.

*A learning project. Tinkering out loud, as usual.*
