import type { WorkerRequest, WorkerResponse, ResultMessage } from './ai-worker-protocol'

/** Minimal structural type so tests can supply a fake worker. */
export interface WorkerLike {
  postMessage(message: unknown): void
  onmessage: ((ev: { data: WorkerResponse }) => void) | null
}

type ProgressFn = (p: { file: string; progress: number }) => void

interface Pending {
  resolve: (r: ResultMessage) => void
  reject: (e: Error) => void
  onProgress?: ProgressFn
}

export class WorkerClient {
  private nextId = 1
  private pending = new Map<number, Pending>()
  private worker: WorkerLike

  constructor(worker: WorkerLike) {
    this.worker = worker
    this.worker.onmessage = (ev) => this.dispatch(ev.data)
  }

  private dispatch(res: WorkerResponse) {
    const p = this.pending.get(res.id)
    if (!p) return
    if (res.type === 'PROGRESS') {
      p.onProgress?.({ file: res.file, progress: res.progress })
      return
    }
    this.pending.delete(res.id)
    if (res.type === 'ERROR') {
      p.reject(new Error(res.error))
      return
    }
    p.resolve(res)
  }

  private request(req: WorkerRequest, onProgress?: ProgressFn): Promise<ResultMessage> {
    return new Promise<ResultMessage>((resolve, reject) => {
      this.pending.set(req.id, { resolve, reject, onProgress })
      this.worker.postMessage(req)
    })
  }

  async transcribe(audio: Float32Array, onProgress?: ProgressFn): Promise<string> {
    const res = await this.request({ id: this.nextId++, type: 'TRANSCRIBE', audio }, onProgress)
    return res.text ?? ''
  }

  async embed(text: string, onProgress?: ProgressFn): Promise<Float32Array> {
    const res = await this.request({ id: this.nextId++, type: 'EMBED', text }, onProgress)
    return res.vector ?? new Float32Array()
  }
}

let singleton: WorkerClient | null = null

/** Lazily creates the real worker-backed client (not used in unit tests). */
export function getAiWorker(): WorkerClient {
  if (!singleton) {
    const worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' })
    singleton = new WorkerClient(worker as unknown as WorkerLike)
  }
  return singleton
}
