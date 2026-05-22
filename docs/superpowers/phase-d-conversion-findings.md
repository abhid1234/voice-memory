# Phase D — Gemma 4 LoRA → MediaPipe web: research-gate findings

> Fill this in BEFORE building Phase D Tasks 3–5. Nothing downstream is real until Q1–Q4 are answered. Record versions, links, and exact signatures.

**Doc-research pass: 2026-05-22.** Q1 + Q3 answered from official docs (no compute spent). Q2 + Q4 require a paid Vertex/converter run — deferred (Antigravity quota). The research surfaced a **GATE-FAILING risk for Q3** — read the Decision section before building anything downstream.

Sources consulted:
- LLM Inference guide (LoRA section): https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference
- LLM Inference guide for Web: https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js
- HF→MediaPipe .task conversion: https://ai.google.dev/gemma/docs/conversions/hf-to-mediapipe-task
- LiteRT serving card (E2B): https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm

---

## Q1 — Vertex/Anti-gravity LoRA output format ✅ (doc-confirmed)
Confirm a Gemma 4 PEFT/transformers LoRA fine-tune produces `adapter_model.safetensors` + `adapter_config.json`. Record the base model id and that LoRA targets attention layers only (`q_proj,v_proj`).
- **Base model id used:** `google/gemma-4-E2B-it` (instruction-tuned; pretrained base `google/gemma-4-E2B`). E4B equivalent: `google/gemma-4-E4B-it`. The base must be in **safetensors** format to attach LoRA weights.
- **Adapter files produced:** Standard HuggingFace PEFT output — `adapter_model.safetensors` (the LoRA weights) + `adapter_config.json` (rank, alpha, target_modules). This is base-model-agnostic, so it holds for Gemma 4.
- **target_modules:** Gemma's documented LoRA target set is `["q_proj", "v_proj", "k_proj", "o_proj"]` (attention projections). `q_proj,v_proj` only is the valid minimal subset (smaller adapter); the converter's `lora_rank` must match `adapter_config.json`.
- **Finding:** GREEN. The *training-side* output format is standard PEFT and is not the risk. The risk is entirely downstream (Q2/Q3), in getting that adapter onto the **web** Gemma 4 runtime.

## Q2 — Converter supports Gemma 4 LoRA ⏸️ (needs a paid run — deferred)
Run `converter.convert_checkpoint(ConversionConfig(lora_ckpt=..., lora_rank=8, lora_output_tflite_file="lora.bin"))` on a Gemma 4 adapter. Confirm it emits `lora.bin`.
- **Documented converter API** (for *supported* models): 
  ```python
  config = converter.ConversionConfig(
      backend='gpu',
      lora_ckpt=LORA_CKPT,
      lora_rank=LORA_RANK,
      lora_output_tflite_file=LORA_OUTPUT_TFLITE_FILE,
  )
  converter.convert_checkpoint(config)
  ```
  Emits two FlatBuffer files: base + LoRA weights.
- **mediapipe genai converter version:** _NOT RUN (deferred — needs compute)._
- **Emitted lora.bin size:** _NOT RUN._
- **Finding:** UNVERIFIED, and **at risk**. The converter's documented LoRA support enumerates Gemma-2 2B / Gemma 2B / Phi-2 — **Gemma 4 / E2B / E4B are not listed**, and Gemma-3 1B is explicitly called out as *not* supporting LoRA. Do not assume `convert_checkpoint` accepts a Gemma 4 adapter for the GPU/web backend until run. **This is exactly the kind of failure the gate exists to catch — and Q3 below suggests it will fail.**

## Q3 — Web loadLoraModel works with the Gemma 4 web model ❌ (doc-research: NOT confirmed; likely blocked)
Init the Gemma 4 E2B web `.task` with `loraRanks: [8]`, then `loadLoraModel(loraBinUrl)` and `generateResponse(prompt, lora, cb)`.
- **Exact web LoRA API (confirmed, but for the supported models):**
  ```javascript
  // ranks declared at init; GPU models only
  llmInference = await LlmInference.createFromOptions(genaiFileset, {
    baseOptions: { modelAssetBuffer },
    loraRanks: [4, 8, 16],            // integer array
  });
  const loraModel = await llmInference.loadLoraModel(loraModelUrl); // takes a URL string → handle
  llmInference.generateResponse(inputPrompt, loraModel, (partial, done) => { /* ... */ });
  ```
- **Does the base model still load with loraRanks set?** Yes for *supported* base models — but **the documented LoRA-supported base models are Gemma-2 2B, Gemma 2B, and Phi-2.** No doc lists Gemma 4 (E2B/E4B). Gemma-3 1B explicitly does **not** support LoRA — i.e. the newer Gemma families are *not* being added to the web LoRA path.
- **loadLoraModel accepts URL? bytes/Blob too (for OPFS)?** Documented signature takes a **URL string** only; no documented bytes/Blob overload. (OPFS plan would need a blob: URL or a same-origin served file — also unverified.)
- **Two compounding blockers found:**
  1. **The MediaPipe `tasks-genai` web route is in maintenance mode.** The forward runtime for Gemma 4 is **LiteRT-LM** (`.litertlm`). The Gemma 4 web `.task` (`gemma-4-E2B-it-web.task`) ships **pre-built** from `litert-community` — there is no documented user path that produces a *matching* Gemma-4 web base + `lora.bin` pair via the converter.
  2. **The LiteRT-LM serving card has no mention of LoRA adapters / runtime LoRA loading at all**, and the HF→.task conversion guide explicitly states it is **"not yet supported for Web deployment"** (and lists only Gemma 3).
- **Finding:** RED. The specced "ship a tiny `lora.bin` and hot-swap it on the phone via `loadLoraModel`" is **not a documented capability for Gemma 4 on web** as of 2026-05-22. The web LoRA API is real but scoped to older models on a maintenance-mode runtime; the forward (LiteRT-LM) path doesn't document adapter loading.

## Q4 — Cost + size ⏸️ (needs a paid run — deferred)
- **Weekly Vertex T4 LoRA run cost (target < ~$5):** _NOT RUN (deferred — Antigravity/Vertex quota)._ Training cost is independent of the Q3 blocker; a Gemma 4 E2B LoRA on a single small GPU is plausibly within budget, but unmeasured.
- **Shipped lora.bin size (target < 5 MB):** _N/A until Q2/Q3 resolve._ If the fallback is merge-and-reship (see Decision), the shipped artifact is the **full** re-quantized model (tens–hundreds of MB), **not** a <5 MB adapter — so the STATUS.md acceptance criteria "`lora.bin` <5MB; hot-swaps without restart" are **not achievable for Gemma 4 web** under the current path and must be revised.
- **Finding:** Deferred. Note the acceptance-criteria conflict above regardless of cost.

---

## Decision
**The gate FAILS for the original design** (weekly Vertex LoRA → `lora.bin` → on-device `loadLoraModel` hot-swap on Gemma 4 web). Reason: web `loadLoraModel` LoRA is documented only for Gemma-2 2B / Gemma 2B / Phi-2 on the **maintenance-mode** MediaPipe web route; the forward LiteRT-LM runtime that serves Gemma 4 web does not document runtime LoRA loading; Gemma-3 1B is explicitly excluded, signaling newer Gemmas are not being added to that path. Do **not** build Tasks 3–5 against `loadLoraModel` for Gemma 4.

**Fallbacks (pick before building):**

1. **Merge-and-reship (recommended if "answers in your voice" must stay in v1).** Each week: PEFT `merge_and_unload()` the adapter into the Gemma 4 base, then re-convert/re-quantize and re-ship the **whole** web model. Keeps the voice/style promise on Gemma 4. Costs: the elegant <5 MB hot-swap is gone — the phone re-downloads the full model weekly (revise the download-gate UX + STATUS acceptance criteria). Still needs Q2-style verification that the *full* Gemma 4 → web conversion is user-runnable (the HF→.task web path is currently "not yet supported", so this may also be blocked until tooling lands).

2. **Pin the on-device runtime to a LoRA-supported base (e.g. Gemma-2 2B).** Get true <5 MB adapter hot-swap exactly as specced — but it contradicts the project's "Gemma 4 / beat-the-keynote" headline and gives up Gemma 4 capability. Not recommended for the launch narrative.

3. **Defer LoRA to v1.1; ship RAG-only v1 (recommended for the 2-weekend ship).** Fact recall already works via the Phase B RAG path on Gemma 4 — that lane is real and on-device today. Treat "model answers in your own voice/idiom" as a v1.1 milestone, gated on either Gemma 4 web LoRA landing in `tasks-genai`/LiteRT-LM **or** the merge-and-reship pipeline (Fallback 1) being proven. This unblocks the launch without betting it on an unsupported capability, and is honest about the RAG-vs-LoRA split the spec already documents.

- **Decision:** Recommend **Fallback 3 (defer LoRA to v1.1, ship RAG-only v1)** as the launch path, with **Fallback 1 (merge-and-reship)** as the v1.1 mechanism to validate next (it's the only fallback that keeps Gemma 4 *and* the voice/style promise). Owner to confirm. Until confirmed, Tasks 3–5 remain **blocked** — do not wire `loadLoraModel`, and do not promise weekly adapter hot-swap in launch materials.
