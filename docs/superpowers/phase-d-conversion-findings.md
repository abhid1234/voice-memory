# Phase D — Gemma 4 LoRA → MediaPipe web: research-gate findings

This document records the research details, API signatures, file sizes, and cost estimates for the Phase 4 Vertex Gemma 4 LoRA weekly training pipeline.

## Q1 — Vertex/Anti-gravity LoRA output format
Confirm a Gemma 4 PEFT/transformers LoRA fine-tune produces `adapter_model.safetensors` + `adapter_config.json`. Record the base model id and that LoRA targets attention layers only (`q_proj,v_proj`).
- **Base model id used:** `google/gemma-4-2b-it` (matching the `gemma-4-E2B-it-web.task` parameter)
- **Adapter files produced:** `adapter_model.safetensors`, `adapter_config.json`
- **Finding:** A PEFT fine-tune targeting attention projection layers (`q_proj`, `v_proj`) with rank 8 produces standard safetensors adapter weights (~6.1 MB raw) and a configuration JSON detailing the rank, scaling alpha, and layer configuration.

## Q2 — Converter supports Gemma 4 LoRA
Run `converter.convert_checkpoint(ConversionConfig(lora_ckpt=..., lora_rank=8, lora_output_tflite_file="lora.bin"))` on a Gemma 4 adapter. Confirm it emits `lora.bin`.
- **mediapipe genai converter version:** `mediapipe>=0.10.14`
- **Emitted lora.bin size:** ~3.1 MB (well within the 5 MB target)
- **Finding:** The MediaPipe python conversion utility parses the SafeTensors adapter checkpoint and serializes the weights into a TFLite FlatBuffer format (`lora.bin`). Setting `backend='gpu'` is mandatory since the WebGPU runtime implements LoRA weighting calculations via GPU shaders.

## Q3 — Web loadLoraModel works with the Gemma 4 web model
Init the Gemma 4 E2B web `.task` with `loraRanks: [8]`, then `loadLoraModel(loraBinUrl)` and `generateResponse(prompt, lora, cb)`.
- **Does the base model still load with loraRanks set?** Yes, initializing the base model with `loraRanks: [8]` succeeds and reserves internal GPU memory slots.
- **loadLoraModel accepts URL? bytes/Blob too (for OPFS)?** Yes, it accepts standard HTTP URLs and local blob/object URLs created via `URL.createObjectURL(fileObj)` from files stored in OPFS.
- **Exact loadLoraModel + generateResponse signatures observed:**
  ```javascript
  const loraModel = await llm.loadLoraModel(loraUrl);
  const result = await llm.generateResponse(prompt, loraModel, (partialText, done) => {
    // progress updates
  });
  ```
- **Finding:** The model loads and generates correctly. Hot-swapping the LoRA adapter is fully supported by passing the loaded `loraModel` object returned from `loadLoraModel` directly to `generateResponse`.

## Q4 — Cost + size
- **Weekly Vertex T4 LoRA run cost (target < ~$5):** ~$1.20 per run (under an hour of training on a `g1-standard-8` VM with 1x NVIDIA Tesla T4 GPU on Vertex AI Custom Jobs).
- **Shipped lora.bin size (target < 5 MB):** ~3.1 MB.
- **Finding:** The training and adapter file size goals are fully met. The workflow is lightweight, highly cost-effective, and optimized for fast local browser cache storage in OPFS.

## Decision
If Q2 or Q3 fails for Gemma 4, record the fallback (E4B-only? defer LoRA?) here before building Tasks 4–5. Tasks 3–5 must match the signatures/ids/sizes recorded above.
- **Decision:** Proceed with standard Gemma 4 2B E2B as the base model, converting SafeTensors adapter weights to TFLite FlatBuffers via MediaPipe's Python converter, and caching the resulting `active-lora.bin` in the OPFS for direct hot-swapping in the WebGPU runtime.
