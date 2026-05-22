import { getAiWorker } from './worker-client'

/** Returns a 384-dim normalized embedding for `text` (MiniLM-L6, on-device). */
export async function embed(text: string): Promise<Float32Array> {
  return getAiWorker().embed(text)
}
