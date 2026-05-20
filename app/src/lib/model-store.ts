export const GEMMA_VARIANTS = {
  E2B: {
    url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task',
    file: 'gemma-4-E2B-it-web.task',
  },
  E4B: {
    url: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.task',
    file: 'gemma-4-E4B-it-web.task',
  },
} as const
export type GemmaVariant = keyof typeof GEMMA_VARIANTS

const MODEL_DIR = 'models'

export interface DownloadProgress {
  loadedBytes: number
  totalBytes: number
}

/** True only if the browser exposes a usable WebGPU adapter. */
export async function isWebGPUAvailable(): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
  if (!gpu) return false
  try {
    const adapter = await gpu.requestAdapter()
    return adapter != null
  } catch {
    return false
  }
}

async function modelDir() {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(MODEL_DIR, { create: true })
}

/** Has this variant already been downloaded to OPFS? */
export async function isModelCached(variant: GemmaVariant): Promise<boolean> {
  try {
    const dir = await modelDir()
    await dir.getFileHandle(GEMMA_VARIANTS[variant].file)
    return true
  } catch {
    return false
  }
}

/** Download the model to OPFS once (streamed, with progress). No-op if already cached. */
export async function downloadModel(
  variant: GemmaVariant,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  if (await isModelCached(variant)) return
  const { url, file } = GEMMA_VARIANTS[variant]
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Model download failed: HTTP ${res.status}`)
  const totalBytes = Number(res.headers.get('content-length') ?? 0)

  const dir = await modelDir()
  const handle = await dir.getFileHandle(file, { create: true })
  const writable = await handle.createWritable()
  const reader = res.body.getReader()
  let loadedBytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      await writable.write(value)
      loadedBytes += value.byteLength
      onProgress?.({ loadedBytes, totalBytes })
    }
  } finally {
    await writable.close()
  }
}

/** Read the cached model back as bytes for MediaPipe's `modelAssetBuffer`. */
export async function getModelBytes(variant: GemmaVariant): Promise<Uint8Array> {
  const dir = await modelDir()
  const handle = await dir.getFileHandle(GEMMA_VARIANTS[variant].file)
  const fileObj = await handle.getFile()
  return new Uint8Array(await fileObj.arrayBuffer())
}
