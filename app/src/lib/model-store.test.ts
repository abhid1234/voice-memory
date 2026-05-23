import { describe, it, expect } from 'vitest'
import { GEMMA_VARIANTS, isWebGPUAvailable } from './model-store'

describe('model-store pure parts', () => {
  it('exposes E2B and E4B variant configs with a url and file name', () => {
    expect(GEMMA_VARIANTS.E2B.file).toMatch(/E2B.*\.task$/)
    expect(GEMMA_VARIANTS.E4B.file).toMatch(/E4B.*\.task$/)
    expect(GEMMA_VARIANTS.E2B.url).toContain('huggingface.co')
  })

  it('isWebGPUAvailable returns false when navigator.gpu is absent', async () => {
    const original = (navigator as unknown as { gpu?: unknown }).gpu
    delete (navigator as unknown as { gpu?: unknown }).gpu
    expect(await isWebGPUAvailable()).toBe(false)
    if (original !== undefined) (navigator as unknown as { gpu?: unknown }).gpu = original
  })
})
