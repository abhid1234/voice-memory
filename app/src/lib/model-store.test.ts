import { describe, it, expect, vi } from 'vitest'
import { GEMMA_VARIANTS, isWebGPUAvailable, downloadLoRA, getLoRAUrl } from './model-store'

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

describe('model-store OPFS operations', () => {
  it('downloadLoRA and getLoRAUrl write and read active-lora.bin', async () => {
    const mockWritable = {
      write: vi.fn(),
      close: vi.fn(),
    }
    const mockFileObj = {
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }
    const mockFileHandle = {
      createWritable: vi.fn().mockResolvedValue(mockWritable),
      getFile: vi.fn().mockResolvedValue(mockFileObj),
    }
    const mockDirHandle = {
      getDirectoryHandle: vi.fn().mockReturnThis(),
      getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
      removeEntry: vi.fn().mockResolvedValue(undefined),
    }

    // Mock navigator.storage
    const originalStorage = navigator.storage
    Object.defineProperty(navigator, 'storage', {
      value: {
        getDirectory: vi.fn().mockResolvedValue(mockDirHandle),
      },
      configurable: true,
      writable: true,
    })

    // Mock fetch
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: {
        getReader: () => {
          let readCount = 0
          return {
            read: async () => {
              if (readCount === 0) {
                readCount++
                return { done: false, value: new Uint8Array([1, 2, 3]) }
              }
              return { done: true, value: undefined }
            }
          }
        }
      }
    } as any)

    // Mock URL.createObjectURL
    const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:foo')

    await downloadLoRA('https://example.com/lora.bin')
    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('active-lora.bin', { create: true })
    expect(mockWritable.write).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]))
    expect(mockWritable.close).toHaveBeenCalled()

    const url = await getLoRAUrl()
    expect(url).toBe('blob:foo')
    expect(mockFileHandle.getFile).toHaveBeenCalled()
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockFileObj)

    // Restore
    mockFetch.mockRestore()
    mockCreateObjectURL.mockRestore()
    if (originalStorage) {
      Object.defineProperty(navigator, 'storage', { value: originalStorage })
    } else {
      delete (navigator as any).storage
    }
  })
})

