# Phase D — Gemma 4 LoRA → MediaPipe web: research-gate findings

> Fill this in BEFORE building Phase D Tasks 3–5. Nothing downstream is real until Q1–Q4 are answered. Record versions, links, and exact signatures.

## Q1 — Vertex/Anti-gravity LoRA output format
Confirm a Gemma 4 PEFT/transformers LoRA fine-tune produces `adapter_model.safetensors` + `adapter_config.json`. Record the base model id and that LoRA targets attention layers only (`q_proj,v_proj`).
- **Base model id used:**
- **Adapter files produced:**
- **Finding:**

## Q2 — Converter supports Gemma 4 LoRA
Run `converter.convert_checkpoint(ConversionConfig(lora_ckpt=..., lora_rank=8, lora_output_tflite_file="lora.bin"))` on a Gemma 4 adapter. Confirm it emits `lora.bin`.
- **mediapipe genai converter version:**
- **Emitted lora.bin size:**
- **Finding:**

## Q3 — Web loadLoraModel works with the Gemma 4 web model
Init the Gemma 4 E2B web `.task` with `loraRanks: [8]`, then `loadLoraModel(loraBinUrl)` and `generateResponse(prompt, lora, cb)`.
- **Does the base model still load with loraRanks set?**
- **loadLoraModel accepts URL? bytes/Blob too (for OPFS)?**
- **Exact loadLoraModel + generateResponse signatures observed:**
- **Finding:**

## Q4 — Cost + size
- **Weekly Vertex T4 LoRA run cost (target < ~$5):**
- **Shipped lora.bin size (target < 5 MB):**
- **Finding:**

## Decision
If Q2 or Q3 fails for Gemma 4, record the fallback (E4B-only? defer LoRA?) here before building Tasks 4–5. Tasks 3–5 must match the signatures/ids/sizes recorded above.
- **Decision:**
