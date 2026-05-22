import { describe, it, expect } from 'vitest'
import { toTrainingJsonl } from './training-export'
import type { VoiceMemo } from './storage'

function memo(transcript: string): VoiceMemo {
  return { transcript, timestamp: 1, embedding: new Float32Array([0]) }
}

describe('toTrainingJsonl', () => {
  it('emits one JSON object per memo with a text field, newline-separated', () => {
    const out = toTrainingJsonl([memo('hello'), memo('world')])
    const lines = out.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toEqual({ text: 'hello' })
    expect(JSON.parse(lines[1])).toEqual({ text: 'world' })
  })
  it('skips empty/whitespace-only transcripts', () => {
    const out = toTrainingJsonl([memo('  '), memo('keep')])
    expect(out.trim().split('\n')).toEqual([JSON.stringify({ text: 'keep' })])
  })
  it('returns an empty string for no memos', () => {
    expect(toTrainingJsonl([])).toBe('')
  })
})
