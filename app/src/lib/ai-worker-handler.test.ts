import { describe, it, expect, vi } from 'vitest'
import { createAiWorkerHandler } from './ai-worker-handler'
import type { WorkerResponse } from './ai-worker-protocol'

describe('createAiWorkerHandler', () => {
  it('handles TRANSCRIBE by posting the transcribed text', async () => {
    const handle = createAiWorkerHandler({
      transcribe: async () => 'hello there',
      embed: async () => new Float32Array(),
    })
    const posted: WorkerResponse[] = []
    await handle({ id: 7, type: 'TRANSCRIBE', audio: new Float32Array([0]) }, (r) => posted.push(r))
    expect(posted).toEqual([{ id: 7, type: 'RESULT', text: 'hello there' }])
  })

  it('handles EMBED by posting the vector', async () => {
    const vec = new Float32Array([1, 2, 3])
    const handle = createAiWorkerHandler({
      transcribe: async () => '',
      embed: async () => vec,
    })
    const posted: WorkerResponse[] = []
    await handle({ id: 9, type: 'EMBED', text: 'hi' }, (r) => posted.push(r))
    expect(posted).toEqual([{ id: 9, type: 'RESULT', vector: vec }])
  })

  it('posts ERROR (with the request id) when a dependency throws', async () => {
    const handle = createAiWorkerHandler({
      transcribe: async () => { throw new Error('model load failed') },
      embed: async () => new Float32Array(),
    })
    const posted: WorkerResponse[] = []
    await handle({ id: 3, type: 'TRANSCRIBE', audio: new Float32Array() }, (r) => posted.push(r))
    expect(posted).toEqual([{ id: 3, type: 'ERROR', error: 'model load failed' }])
  })

  it('routes EMBED to embed, not transcribe', async () => {
    const transcribe = vi.fn(async () => 'x')
    const embed = vi.fn(async () => new Float32Array([5]))
    const handle = createAiWorkerHandler({ transcribe, embed })
    await handle({ id: 1, type: 'EMBED', text: 'q' }, () => {})
    expect(embed).toHaveBeenCalledOnce()
    expect(transcribe).not.toHaveBeenCalled()
  })
})
