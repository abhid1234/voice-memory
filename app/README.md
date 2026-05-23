# VoiceMemory PWA

A privacy-first, on-device personal voice-memory system that runs in your mobile browser as a Progressive Web App (PWA). Capture short voice memos and ask voice queries about your recorded memories completely offline using on-device RAG (Gemma 4). Weekly custom LoRA style personalization is deferred to v1.1 due to Gemma 4 web LoRA gate failure (see STATUS.md).

---

## 🌟 Core Features

- **Offline Capture Flow**: Foreground microphone recording with real-time speech-to-text (STT) powered on-device by Whisper.cpp (WASM).
- **On-Device Gemma RAG**: Semantic search using cosine similarity embeddings over local IndexedDB transcripts, feeding context to MediaPipe Gemma 4 for offline inference queries.
- **Ethereal Intelligence UI**:
  - **Siri-style Waveform**: Fluid, organic bezier wave rendering real-time audio amplitudes during recording.
  - **Galaxy Map**: Interactive HTML5 Canvas constellation map visualising memories as interconnected stars over time.
  - **Onboarding Spotlight**: SVG-masked interactive tutorial tour for first-time setup.
  - **Theme Switcher**: Organic persisted HSL themes (Emerald, Violet, Ocean, Amber) with instant light/dark toggle.
- **Weekly LoRA Personalization (Deferred to v1.1)**: Fine-tuning Gemma 4 on custom transcripts via an Anti-gravity cron pipeline is deferred to v1.1 due to Gemma 4 web LoRA gate failure.
- **Zero-Permission Public Demo**: Precomputed synthetic memories and local TTS reading responses instantly under 1.5 seconds without microphone or hardware permissions.
- **Premium Utilities**: Drag-and-drop `.mp3`/`.wav`/`.webm` audio imports, editorial sheet editor with diff view, Web Audio sound synthesis feedback, and rich Markdown/HTML export drawers.

---

## 🛠️ Architecture: RAG + LoRA Split

VoiceMemory separates retrieval (facts) from style (voice) to maximize on-device efficiency. Note: Style personalization via LoRA is deferred to v1.1 (RAG-only for v1).

| Capability | Mechanism | Location | Frequency | Status in v1 |
|---|---|---|---|---|
| **Fact Recall** | RAG via local IndexedDB embeddings | On-Device (WebGPU) | Live / Every Query | ✅ Active |
| **Voice Style** | LoRA fine-tune adapter | Vertex AI (via Anti-gravity) | Weekly Cron | ⚠️ Deferred to v1.1 |

---

## 📁 Project Structure

```
voice-memory/
├── docs/
│   ├── spec.md                     # Full v1 spec, scope tradeoffs, and phase plan
│   ├── demo-video-script.md        # Script for the LinkedIn launch demo walk-through
│   └── superpowers/
│       └── phase-d-conversion-findings.md  # Research and converter API signatures
├── app/                            # React + TypeScript + Vite PWA
│   ├── src/
│   │   ├── components/             # Reusable UI components (ModelDownloadGate, etc.)
│   │   ├── pages/                  # Application screens (Demo.tsx page route)
│   │   ├── lib/                    # Core modules (stt, inference, rag, storage, synth, flow, diff)
│   │   ├── data/                   # Synthetic demo dataset & questions
│   │   ├── App.tsx                 # App layout, state management, and navigation routing
│   │   ├── App.css                 # Ethereal design system styles and animations
│   │   └── index.css               # Core styling tokens
│   ├── public/                     # Static files and Web Workers (whisper-worker.js, sw.js)
│   └── package.json
└── infra/                          # Vertex AI weekly LoRA training pipeline
    ├── agent-config.yaml           # Anti-gravity 2.0 cron & job parameters
    ├── train_config.yaml           # Fine-tuning parameters
    ├── convert_lora.py             # Script to compile adapter weights to lora.bin
    └── deploy_pipeline.py          # Script to deploy pipeline
```

---

## 🚀 Getting Started

### Prerequisites

- A browser with WebGPU support enabled (Chrome/Edge v113+, Opera, or Safari Technology Preview).
- Node.js (v18+) and npm installed.

### Setup and Development

1. Navigate to the frontend directory:
   ```bash
   cd app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite local development server:
   ```bash
   npm run dev
   ```

4. Run unit tests using Vitest:
   ```bash
   npm test
   ```

5. Build the production PWA bundle:
   ```bash
   npm run build
   ```

6. Preview the production build:
   ```bash
   npm run preview
   ```
