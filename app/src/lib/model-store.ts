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

/**
 * Download the model to OPFS once (streamed, with progress). No-op if already cached.
 *
 * Writes to a temporary `.partial` file and only renames it to the final name once the
 * full stream has been written and the writable closed. `isModelCached` checks the FINAL
 * name, so a download interrupted by a crash, tab close, or navigation away can never be
 * mistaken for a complete model — the final name simply won't exist yet, and the next run
 * re-downloads. (The catch below also cleans up on a caught error; the rename guards the
 * abrupt-termination case the catch cannot.)
 */
export async function downloadModel(
  variant: GemmaVariant,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  if (await isModelCached(variant)) return
  const { url, file } = GEMMA_VARIANTS[variant]
  const tempName = `${file}.partial`
  const dir = await modelDir()
  // Clear any leftover partial from a previously aborted download before starting fresh.
  await dir.removeEntry(tempName).catch(() => {})
  const handle = await dir.getFileHandle(tempName, { create: true })
  const writable = await handle.createWritable()
  try {
    const res = await fetch(url)
    if (!res.ok || !res.body) throw new Error(`Model download failed: HTTP ${res.status}`)
    const totalBytes = Number(res.headers.get('content-length') ?? 0)
    const reader = res.body.getReader()
    let loadedBytes = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      await writable.write(value)
      loadedBytes += value.byteLength
      onProgress?.({ loadedBytes, totalBytes })
    }
    await writable.close()
    // Atomically promote the completed temp file to the final name. Only now is the model
    // considered "cached"; a crash before this line leaves only the `.partial` temp.
    await (handle as unknown as { move(name: string): Promise<void> }).move(file)
  } catch (e) {
    try {
      await writable.close()
    } catch {
      /* already errored */
    }
    await dir.removeEntry(tempName).catch(() => {})
    throw e
  }
}

/** Read the cached model back as bytes for MediaPipe's `modelAssetBuffer`. */
export async function getModelBytes(variant: GemmaVariant): Promise<Uint8Array> {
  const dir = await modelDir()
  const handle = await dir.getFileHandle(GEMMA_VARIANTS[variant].file)
  const fileObj = await handle.getFile()
  return new Uint8Array(await fileObj.arrayBuffer())
}

