# Todos

## Completed Tasks
- [x] Phase 1: PWA Shell (Vite + service worker + manifest)
- [x] Phase 2: Capture Flow (Microphone + Whisper.cpp WASM)
- [x] Phase 3: On-device Gemma + RAG (similarity search + IndexedDB)
- [x] Phase 5: Public Demo Lane (ondeviceml.space static mock dataset)
- [x] Phase 7: Premium Features (Editorial editor, timeline playback caching, keyword tags)
- [x] Phase 8: Premium Polish (Siri visualizer, dark/light theme, Settings, audio chimes, export drawers)
- [x] Phase 11: Premium Experience & Personalization (Drag-and-drop local audio imports, persisted HSL color themes, Canvas constellation Galaxy Map, onboarding spotlights)
- [x] Pre-landing bugfixes (Worker race condition, Memory leaks, accessibility audit fixes)
- [x] Revoke `URL.createObjectURL` references in the timeline component to prevent leak build-ups
- [x] Guard overlapping `stt.start()` invocations explicitly in the UI
- [x] Deprecate/drop the unused `inference` shim left from the early public demo
- [x] Add explicit `Worker.onerror` drain handlers to the LLM and STT clients
- [x] Refine brand logo design (dynamic SVG waveform) and download model button visual layout (v0.0.1.0)


## Open / Deferred Tasks
- [ ] Phase 4: Vertex Gemma 4 LoRA training pipeline integration
