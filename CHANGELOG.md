# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0.0] - 2026-05-27

### Added
- **Gemini Cloud AI Integration**: Instantly polish voice recordings and extract action items or key entities using the optional cloud-based `gemini-1.5-flash` model, which acts as a fallback for devices without WebGPU or local AI capabilities.
- **Firebase Firestore Backup & Sync**: Sync your voice memories across multiple browsers or devices. Memos are encrypted client-side in the browser using PBKDF2-derived keys and AES-GCM encryption before upload to preserve complete data privacy.
- **Google Sheets Export**: Seamlessly export your polished transcripts, dates, AI insights, and tags directly to a spreadsheet in your Google Drive with a one-click OAuth authorization flow.
- **Self-Hosting Docker Setup**: Deploy your own private, isolated copy of VoiceMemory to Google Cloud Run or any container hosting platform using our multi-stage Docker build and Nginx container.

### Changed
- **Redesigned Settings & Integrations Modal**: Replaced the "Offline Engine Doctor" modal with a tabbed dashboard (System, Gemini, Firebase, Google Sheets, Self-Hosting) to manage all configurations and test connections.

## [0.0.1.0] - 2026-05-25

### Added
- **Theme-Adaptive Dynamic Logo**: Experience a cohesive UI with a new dynamic SVG logo that automatically inherits and adapts to your selected color theme and dark/light mode settings.

### Changed
- **Model Download Gate Redesign**: Monitor model downloads and manage load errors through a redesigned, Obsidian-style gate featuring inline SVG status icons and hover shadow cues.
- **Visual & Style Refinement**: Enjoy a cleaner, more balanced UI layout with polished container margins, consistent button icon sizing, and alignment refinements across all views.
- **Mobile Touch Targets and Navigation Layout**: Tap controls more easily on mobile with 44px minimum touch targets for Whisper model selection buttons and settings, and navigate without layout overlap thanks to fixed navigation bar positioning.

### Fixed
- **Spotlight Tour Click Interception**: Resolved a usability issue where the tour overlay blocked mouse clicks to highlighted target elements underneath, and fixed potential off-screen tooltip rendering.
- **Tour Tab Change Graceful Exit**: Automatically cancel the onboarding tour if the user manually switches tabs away from the target panel to prevent visual unmount glitches.
- **Writing Style Selection Layout**: Scan and select writing styles more easily with list items structured in a clean vertical column layout with descriptive subtexts for each formatting preset.


## [0.0.0.4] - 2026-05-22

### Changed
- **Developer Experience — ESLint Rule Update**: Scoped off `no-explicit-any` in test files (`**/*.test.{ts,tsx}`) to simplify mock and stub definitions during unit testing.
- **LoRA Gate Findings**: Updated [phase-d-conversion-findings.md](file:///home/abhidaas/Core/Workspace/AntigravityCLI/voice-memory-antigravity/docs/superpowers/phase-d-conversion-findings.md) documenting that MediaPipe Web GenAI does not support Gemma 4 LoRA adapters. Switched the v1 scope to a verified RAG-only design.

### Fixed
- **ESLint Warnings**: Resolved 24 warnings in `App.tsx`, `inference.ts`, and `llm-worker.ts` to ensure clean build gating and prevent potential runtime callback issues.

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
