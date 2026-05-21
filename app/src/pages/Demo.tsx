import { useState } from 'react'
import questions from '../data/demo-questions.json'
import memory from '../data/synthetic-memory.json'
import { embed } from '../lib/embeddings'
import { retrieve } from '../lib/rag'
import { getInference } from '../lib/inference'
import { speak } from '../lib/tts'
import type { VoiceMemo } from '../lib/storage'

// Adapt the static JSON (number[] embeddings) into the VoiceMemo shape rag.retrieve expects.
const MEMOS: VoiceMemo[] = memory.map((m) => ({
  timestamp: m.timestamp,
  transcript: m.transcript,
  embedding: new Float32Array(m.embedding),
}))

function Demo() {
  const [answer, setAnswer] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Zero-permission: instant precomputed answer + speak. No mic, no model, no download.
  const handlePrecomputed = (q: (typeof questions)[number]) => {
    setActive(q.id)
    setAnswer(q.answer)
    speak(q.answer)
  }

  // Optional live: real on-device RAG + Gemma 4 (needs WebGPU + one-time model download).
  const handleLive = async (q: (typeof questions)[number]) => {
    if (busy) return
    setActive(q.id)
    setBusy(true)
    setAnswer('Thinking on-device…')
    try {
      const queryVec = await embed(q.question)
      const { context } = retrieve(queryVec, MEMOS, 5)
      getInference().init('E2B')
      let acc = ''
      const final = await getInference().generateResponse(q.question, context, (token) => {
        acc += token
        setAnswer(acc)
      })
      setAnswer(final)
      speak(final)
    } catch {
      setAnswer('Live mode needs a WebGPU browser and a one-time model download. The instant answers above work everywhere.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="demo-page card">
      <h2>Try VoiceMemory</h2>
      <p className="status-text">
        No permissions needed. These are sample questions over a synthetic memory of AI-industry conversations.
        Tap one to hear the answer.
      </p>

      <div className="sample-queries">
        {questions.map((q) => (
          <div key={q.id} className="sample-q-row">
            <button className="sample-q-btn" onClick={() => handlePrecomputed(q)} disabled={busy}>
              ▶ {q.question}
            </button>
            <button
              className="sample-q-live"
              onClick={() => handleLive(q)}
              disabled={busy}
              title="Run the real model on-device (needs WebGPU + a one-time download)"
            >
              ⚡ live
            </button>
          </div>
        ))}
      </div>

      <div className="answer-area">
        {answer && (
          <div className="ai-response">
            <p>{answer}</p>
            {active && <span className="demo-hint">▶ instant · ⚡ live runs Gemma 4 on your device</span>}
          </div>
        )}
      </div>

      <div className="install-prompt">
        <button className="record-btn secondary" style={{ fontSize: '1rem', padding: '1rem 2rem' }}>
          Install for yourself
        </button>
        <p className="status-text">Only the full app asks for microphone access.</p>
      </div>
    </div>
  )
}

export default Demo
