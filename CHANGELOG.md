# Changelog

All notable changes to this project will be documented in this file.

## [0.0.0.3] - 2026-05-22

### Added
- **Premium Plan & Secure Status Indicator**: Upgraded the user profile header with a "Premium Plan" badge, updated the avatar/name to "Deep Thinker", and changed active status to "Secure Intellect Active".
- **On-Device Security Card**: Added a dedicated "On-Device Processing" card with security metrics to reassure users that transcripts are private and secure.

### Changed
- **Vertical Style Selector Layout**: Refactored the writing format style control from a horizontal segmented bar to a clean vertical list of options with descriptive titles (e.g., "Cleaned Transcript", "Action Bullets", "Executive Summary").
- **Inline Vocabulary Form**: Redesigned the vocabulary term input into an inline form with a dedicated "+ Add" button for better accessibility and usability.
- **AI Settings Optimization**: Reorganized settings to hide technical Whisper/Gemma parameters on desktop layouts while keeping them available on mobile.
- **Mobile Navigation Polish**: Updated labels in the mobile tab bar to clarify sections (e.g., naming the primary view "Memories").

## [0.0.0.2] - 2026-05-22

### Added
- **Phase 4 Training & Conversion Scaffolding**: Groundwork for weekly Gemma 4 personalization. Added causal LM training JSONL serializers, MediaPipe adapter dynamic loading in web workers, weekly cron execution configuration, and a Python conversion script to compile TFLite adapters (`lora.bin`).
- **Inference Worker Error Draining**: Cleanly drains pending tasks and prevents UI hangs if the background inference worker crashes.

### Fixed
- **Resource Leaks**: Resolved audio and memory leaks by managing AudioContext lifecycle on file import, unmount, and playback completion, and revoking temporary Object URLs in export handlers.
- **Concurrent Recording Safeguards**: Added recording state toggle guards to prevent accidental concurrent microphone activations.
- **Legacy Wrapper Cleanup**: Cleaned up the codebase by removing the deprecated compatibility helper from `inference.ts`.

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
