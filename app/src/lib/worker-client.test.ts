import { describe, it, expect } from 'vitest'
import { WorkerClient } from './worker-client'
import type { WorkerLike } from './worker-client'
import type { WorkerResponse } from './ai-worker-protocol'

class FakeWorker implements WorkerLike {
  posted: Array<{ id: number; type: string; text?: string; audio?: Float32Array }> = []
  onmessage: ((ev: { data: WorkerResponse }) => void) | null = null
  postMessage(message: unknown) {
    this.posted.push(message as never)
  }
  emit(res: WorkerResponse) {
    this.onmessage?.({ data: res })
  }
}

describe('WorkerClient', () => {
  it('embed: posts an EMBED request and resolves with the matching vector', async () => {
    const fake = new FakeWorker()
    const client = new WorkerClient(fake)
    const promise = client.embed('hello')
    expect(fake.posted[0]).toMatchObject({ id: 1, type: 'EMBED', text: 'hello' })
    fake.emit({ id: 1, type: 'RESULT', vector: new Float32Array([1, 2]) })
    expect(Array.from(await promise)).toEqual([1, 2])
  })

  it('transcribe: posts a TRANSCRIBE request and resolves with the matching text', async () => {
    const fake = new FakeWorker()
    const client = new WorkerClient(fake)
    const promise = client.transcribe(new Float32Array([0.5]))
    expect(fake.posted[0]).toMatchObject({ id: 1, type: 'TRANSCRIBE' })
    fake.emit({ id: 1, type: 'RESULT', text: 'transcribed' })
    expect(await promise).toBe('transcribed')
  })

  it('rejects when the worker posts an ERROR for that id', async () => {
    const fake = new FakeWorker()
    const client = new WorkerClient(fake)
    const promise = client.embed('x')
    fake.emit({ id: 1, type: 'ERROR', error: 'boom' })
    await expect(promise).rejects.toThrow('boom')
  })

  it('forwards PROGRESS to onProgress without resolving, then resolves on RESULT', async () => {
    const fake = new FakeWorker()
    const client = new WorkerClient(fake)
    const progress: number[] = []
    const promise = client.transcribe(new Float32Array([0]), (p) => progress.push(p.progress))
    fake.emit({ id: 1, type: 'PROGRESS', file: 'whisper', progress: 42 })
    fake.emit({ id: 1, type: 'RESULT', text: 'done' })
    expect(await promise).toBe('done')
    expect(progress).toEqual([42])
  })

  it('matches concurrent requests by id', async () => {
    const fake = new FakeWorker()
    const client = new WorkerClient(fake)
    const a = client.embed('a') // id 1
    const b = client.embed('b') // id 2
    fake.emit({ id: 2, type: 'RESULT', vector: new Float32Array([2]) })
    fake.emit({ id: 1, type: 'RESULT', vector: new Float32Array([1]) })
    expect(Array.from(await a)).toEqual([1])
    expect(Array.from(await b)).toEqual([2])
  })
})
