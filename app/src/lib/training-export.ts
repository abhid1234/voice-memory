import type { VoiceMemo } from './storage'

/**
 * Build the weekly LoRA training set as JSONL ({"text": <transcript>} per line).
 * Causal-LM style: the adapter learns the user's own phrasing/voice.
 */
export function toTrainingJsonl(memos: VoiceMemo[]): string {
  return memos
    .map((m) => m.transcript.trim())
    .filter((t) => t.length > 0)
    .map((text) => JSON.stringify({ text }))
    .join('\n')
}
