import { describe, it, expect } from 'vitest'
import memory from './synthetic-memory.json'
import source from './synthetic-source.json'

describe('generated synthetic-memory.json', () => {
  it('has one entry per source transcript', () => {
    expect(memory.length).toBe(source.length)
  })
  it('each entry has a 384-dim numeric embedding and a transcript', () => {
    for (const m of memory) {
      expect(m.transcript.length).toBeGreaterThan(0)
      expect(Array.isArray(m.embedding)).toBe(true)
      expect(m.embedding).toHaveLength(384)
      expect(typeof m.embedding[0]).toBe('number')
    }
  })
})
