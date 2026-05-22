import { pipeline, env } from '@xenova/transformers'
import { createAiWorkerHandler } from './ai-worker-handler'
import type { WorkerRequest } from './ai-worker-protocol'

// Always fetch models from the HuggingFace CDN (one-time download, then cached).
env.allowLocalModels = false

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null

async function getTranscriber() {
  if (!transcriber) {
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en')
  }
  return transcriber
}

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  return embedder
}

const handle = createAiWorkerHandler({
  transcribe: async (audio) => {
    const t = await getTranscriber()
    const out = await t(audio, { chunk_length_s: 30, stride_length_s: 5 })
    return out.text as string
  },
  embed: async (text) => {
    const e = await getEmbedder()
    const out = await e(text, { pooling: 'mean', normalize: true })
    return out.data as Float32Array
  },
})

// Annotate as a plain MessageEvent and cast `.data` — avoids needing the
// WebWorker lib in tsconfig (where `self` would otherwise type as Window).
self.onmessage = (ev: MessageEvent) => {
  void handle(ev.data as WorkerRequest, (res) => (self as unknown as Worker).postMessage(res))
}
