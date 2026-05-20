import { getAiWorker } from './worker-client'

export interface SttPartial {
  text: string
}

const PARTIAL_INTERVAL_MS = 8000
const SAMPLE_RATE = 16000

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let audioCtx: AudioContext | null = null
let chunks: Blob[] = []
let partialTimer: ReturnType<typeof setInterval> | null = null

/** Decodes accumulated webm chunks to 16 kHz mono Float32 PCM. */
async function decodeAccumulated(): Promise<Float32Array | null> {
  if (!audioCtx || chunks.length === 0) return null
  const blob = new Blob(chunks, { type: 'audio/webm' })
  const buf = await blob.arrayBuffer()
  // decodeAudioData detaches its input buffer, so pass a copy.
  const decoded = await audioCtx.decodeAudioData(buf.slice(0))
  return new Float32Array(decoded.getChannelData(0))
}

export const stt = {
  /** Start recording. `onPartial` fires roughly every 8s with the cumulative transcript. */
  async start(onPartial: (p: SttPartial) => void): Promise<void> {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
    chunks = []
    recorder = new MediaRecorder(stream)
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.start(1000) // emit a chunk every second

    partialTimer = setInterval(async () => {
      if (!recorder || recorder.state !== 'recording') return
      try {
        const audio = await decodeAccumulated()
        if (audio && audio.length > 0) {
          const text = await getAiWorker().transcribe(audio)
          onPartial({ text })
        }
      } catch {
        // A mid-stream decode can fail; ignore and retry on the next tick.
      }
    }, PARTIAL_INTERVAL_MS)
  },

  /** Stop recording; returns the authoritative full-pass transcript and the audio blob. */
  async stop(): Promise<{ transcript: string; audioBlob: Blob }> {
    if (partialTimer) {
      clearInterval(partialTimer)
      partialTimer = null
    }
    const audioBlob = await new Promise<Blob>((resolve) => {
      if (!recorder) return resolve(new Blob([], { type: 'audio/webm' }))
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }))
      recorder.stop()
      stream?.getTracks().forEach((t) => t.stop())
    })

    let transcript = ''
    const audio = await decodeAccumulated()
    if (audio && audio.length > 0) {
      transcript = await getAiWorker().transcribe(audio)
    }

    await audioCtx?.close()
    recorder = null
    stream = null
    audioCtx = null
    chunks = []
    return { transcript: transcript.trim(), audioBlob }
  },
}
