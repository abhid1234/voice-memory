# On-device acceptance runbook (the launch gate)

Everything is verified in builds / CI / headless — but the capture → query loop has
**never run on a real WebGPU device with the actual Gemma 4 model.** This is the one
gate before launch. ~5–10 minutes on a laptop or Chromebook.

## Prereqs
- **Chrome or Edge** on a laptop/Chromebook (desktop). WebGPU must be available
  (`chrome://gpu` → "WebGPU: Hardware accelerated"). iPhone Safari WebGPU is unverified —
  don't gate launch on it.
- A decent network for the **one-time** model download (hundreds of MB).
- Test against prod (`https://voice-memory-phi.vercel.app`) or a local
  `cd app && npm run build && npm run preview`.

## Steps

**0. Open DevTools → Network tab** (filter: Fetch/XHR). Keep it open the whole time —
this is how you prove "nothing leaves the device."

**1. Model download (Search/Query tab).**
- Go to **Search** → the `ModelDownloadGate` appears.
- Expect **"Checking Device"** → then either **"Download model"** or, if WebGPU is
  missing, **"WebGPU Required"** (stop here and switch to a WebGPU browser).
- Click download → **"Downloading Model"** with a progress bar → **"Loading Model"**.
- ✅ Pass: model downloads **once**, caches to OPFS, gate clears to the query UI.
  Note the size + time. (If E2B won't load, flip `VARIANT` to `E4B` in
  `app/src/lib/model-store.ts` / `ModelDownloadGate.tsx` and rebuild.)

**2. Capture a memo (Dictation tab).**
- Tap **Start Dictation**, grant the **mic** prompt, speak ~20s.
- ✅ Pass: live partial transcript updates while speaking; on **Stop**, the full
  transcript loads into the Editorial Sheet, gets tags, and lands in the timeline.
- 🔎 During transcription, watch Network: **no requests to any API** — Whisper runs
  in the worker on-device.

**3. Query (Search tab).**
- Ask a question about what you just recorded.
- ✅ Pass: answer **streams token-by-token**, shows a **citation** to the source memo,
  and is **spoken aloud** (Web Speech TTS).
- 🔎 **The key check:** during the query, the Network tab shows **zero** inference
  requests. Once the model is cached, a query should generate **no network traffic at all**.

**4. Offline proof (optional but convincing).**
- Turn off Wi-Fi → reload (it's a PWA, should load from cache) → record + query again.
- ✅ Pass: still works fully offline. This is the whole thesis, demonstrated.

**5. Public demo lane (any browser, no WebGPU needed).**
- Open `…/?demo`. ✅ Pass: tap a sample question → instant spoken answer, **no
  permission prompt**, no model download, no inference network traffic.

## Pass criteria (all must hold)
- [ ] Model downloads once, caches, loads on a WebGPU device.
- [ ] Record → on-device transcript → saved memo with tags.
- [ ] Query → streamed answer + citation + spoken TTS.
- [ ] **No inference/cloud network traffic** during transcription or query (only the
      one-time model + wasm fetches at first load).
- [ ] `?demo` works on any browser with zero permissions.

If all five hold, the on-device thesis is proven and the gate is cleared for launch.
