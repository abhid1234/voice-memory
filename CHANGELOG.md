# Changelog

All notable changes to this project will be documented in this file.

## [0.0.0.2] - 2026-05-22

### Added
- **Phase 4 Training & Conversion Scaffolding**: Causal LM training JSONL serializers, MediaPipe adapter dynamic loading in web workers, weekly cron execution configuration, and conversion script to compile TFLite adapters.
- **Inference Worker Error Draining**: Worker `onerror` boundary to drain pending tasks cleanly on worker crash.

### Fixed
- **Resource Leaks**: AudioContext lifecycle closure on file import, unmount, and playback completion. Revocation of Object URLs in markdown and plain text export handlers.
- **Concurrent Recording Safeguards**: Added recording state toggle guards to prevent concurrent microphone activations.
- **Legacy Wrapper Cleanup**: Removed deprecated compatibility helper from `inference.ts`.

## [0.0.0.1] - 2026-05-22

### Added
- **Obsidian Dark Theme**: Complete dark mode implementation using HSL styling variables.
- **Siri-style Audio Visualizer**: A fluid, organic bezier wave rendering real-time audio amplitudes during recording.
- **Onboarding Spotlight Tour**: Step-by-step introduction modal with SVG masking overlay.
- **Constellation Galaxy Map**: Canvas-based SVG timeline visualization displaying memories as stars.
- **Audio File Drag-and-Drop Import**: Support for importing local `.mp3`/`.wav`/`.webm` audio files directly.
- **Export Drawers**: Support for exporting timeline and notes as Markdown and rich HTML files.
- **Persisted Color Theme Switcher**: Persisted HSL themes (Emerald, Violet, Ocean, Amber).
- **Settings Card**: Toggle to configure local Whisper model models.

### Fixed
- **Whisper Worker Session Race Conditions**: Implemented `sessionId` and `requestId` routing inside Whisper Web Worker and STT client to prevent transcription overlap.
- **Audio Context Management**: Closed `audioContext` resources during cleanup paths and recording stop limits.
- **Memory Leaks and Rendering Bottlenecks**: Added unmount cleanup timers, memoized computations, and optimized IndexedDB file metric sizing.
