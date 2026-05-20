import { useState } from 'react'
import { LlmInference, FilesetResolver } from '@mediapipe/tasks-genai'
import { downloadModel, getModelBytes, isWebGPUAvailable, type GemmaVariant } from '../lib/model-store'

export default function Spike() {
  const [log, setLog] = useState<string[]>([])
  const [variant, setVariant] = useState<GemmaVariant>('E2B')
  const append = (s: string) => setLog((l) => [...l, s])

  const run = async () => {
    setLog([])
    const t0 = performance.now()
    append(`WebGPU available: ${await isWebGPUAvailable()}`)
    append(`Downloading ${variant} to OPFS…`)
    await downloadModel(variant, ({ loadedBytes, totalBytes }) =>
      append(`  ${(loadedBytes / 1e6).toFixed(0)} / ${(totalBytes / 1e6).toFixed(0)} MB`),
    )
    const bytes = await getModelBytes(variant)
    append(`Model bytes: ${(bytes.byteLength / 1e6).toFixed(0)} MB. Loading MediaPipe…`)

    const fileset = await FilesetResolver.forGenAiTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm',
    )
    const llm = await LlmInference.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: bytes },
      maxTokens: 256,
      topK: 40,
      temperature: 0.7,
    })
    append(`Loaded in ${((performance.now() - t0) / 1000).toFixed(1)}s. Generating…`)

    const prompt =
      '<start_of_turn>user\nAnswer in one sentence: what is on-device AI?<end_of_turn>\n<start_of_turn>model\n'
    const tGen = performance.now()
    let last = ''
    let tokens = 0
    const final = await llm.generateResponse(prompt, (partial: string) => {
      const delta = partial.slice(last.length)
      last = partial
      if (delta) {
        tokens += 1
        append(`token: ${delta}`)
      }
    })
    const secs = (performance.now() - tGen) / 1000
    append(`DONE in ${secs.toFixed(1)}s (~${(tokens / secs).toFixed(1)} tok/s)`)
    append(`FINAL: ${final}`)
  }

  return (
    <div style={{ padding: 16, fontFamily: 'monospace' }}>
      <h2>Gemma 4 spike</h2>
      <select value={variant} onChange={(e) => setVariant(e.target.value as GemmaVariant)}>
        <option value="E2B">E2B</option>
        <option value="E4B">E4B</option>
      </select>
      <button onClick={run} style={{ marginLeft: 8 }}>Run spike</button>
      <pre>{log.join('\n')}</pre>
    </div>
  )
}
