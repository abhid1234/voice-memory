import { useEffect, useState } from 'react'
import { downloadModel, isModelCached, isWebGPUAvailable, type GemmaVariant } from '../lib/model-store'
import { getInference } from '../lib/inference'

const VARIANT: GemmaVariant = 'E2B' // Chromebook can switch to 'E4B' (Task 1 spike)

type State = 'checking' | 'no-webgpu' | 'needs-download' | 'downloading' | 'ready'

export default function ModelDownloadGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>('checking')
  const [pct, setPct] = useState(0)

  useEffect(() => {
    void (async () => {
      if (!(await isWebGPUAvailable())) return setState('no-webgpu')
      setState((await isModelCached(VARIANT)) ? 'ready' : 'needs-download')
    })()
  }, [])

  useEffect(() => {
    if (state === 'ready') getInference().init(VARIANT)
  }, [state])

  const download = async () => {
    setState('downloading')
    try {
      await downloadModel(VARIANT, ({ loadedBytes, totalBytes }) =>
        setPct(totalBytes ? Math.round((loadedBytes / totalBytes) * 100) : 0),
      )
      setState('ready')
    } catch {
      setState('needs-download')
    }
  }

  if (state === 'ready') return <>{children}</>
  if (state === 'checking') return <p className="status-text">Checking device…</p>
  if (state === 'no-webgpu')
    return (
      <p className="status-text">
        On-device AI needs WebGPU, which this browser doesn't support. Try Chrome on a laptop/Chromebook.
        Recording and your timeline still work.
      </p>
    )
  if (state === 'downloading') return <p className="status-text">Downloading on-device model… {pct}%</p>
  return (
    <div className="card">
      <p className="status-text">A one-time on-device AI model download is needed to answer questions.</p>
      <button className="record-btn" onClick={download}>Download model</button>
    </div>
  )
}
