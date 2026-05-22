import type { WorkerRequest, WorkerResponse } from './ai-worker-protocol'

export interface AiWorkerDeps {
  transcribe: (audio: Float32Array) => Promise<string>
  embed: (text: string) => Promise<Float32Array>
}

/**
 * Pure message handler for the AI worker. Given dependency functions and a
 * `post` callback, it processes one request and posts exactly one response
 * (RESULT or ERROR). Kept free of `self`/transformers.js so it is unit-testable.
 */
export function createAiWorkerHandler(deps: AiWorkerDeps) {
  return async function handle(
    req: WorkerRequest,
    post: (res: WorkerResponse) => void,
  ): Promise<void> {
    try {
      if (req.type === 'TRANSCRIBE') {
        const text = await deps.transcribe(req.audio)
        post({ id: req.id, type: 'RESULT', text })
      } else if (req.type === 'EMBED') {
        const vector = await deps.embed(req.text)
        post({ id: req.id, type: 'RESULT', vector })
      }
    } catch (e) {
      post({ id: req.id, type: 'ERROR', error: e instanceof Error ? e.message : String(e) })
    }
  }
}
