import { describe, it, expect } from 'vitest'
import { cosineSimilarity, retrieve } from './rag'
import type { VoiceMemo } from './storage'

function memo(transcript: string, embedding: number[], timestamp = 1): VoiceMemo {
  return { transcript, embedding: new Float32Array(embedding), timestamp }
}

describe('cosineSimilarity', () => {
  it('is 1 for identical direction, 0 for orthogonal', () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([2, 0]))).toBeCloseTo(1)
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0)
  })
  it('returns 0 when either vector is zero-length', () => {
    expect(cosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 1]))).toBe(0)
  })
})

describe('retrieve', () => {
  const query = new Float32Array([1, 0])
  const memos = [
    memo('aligned', [1, 0]),
    memo('orthogonal', [0, 1]),
    memo('opposite', [-1, 0]),
  ]
  it('ranks by cosine similarity and returns top-k citations', () => {
    const { citations } = retrieve(query, memos, 2)
    expect(citations.map((m) => m.transcript)).toEqual(['aligned', 'orthogonal'])
  })
  it('builds a numbered context string from the citations', () => {
    const { context } = retrieve(query, memos, 1)
    expect(context).toContain('[1]')
    expect(context).toContain('aligned')
  })
  it('returns a no-memories message when there are no memos', () => {
    const { context, citations } = retrieve(query, [], 5)
    expect(citations).toHaveLength(0)
    expect(context).toMatch(/no relevant memories/i)
  })
})
