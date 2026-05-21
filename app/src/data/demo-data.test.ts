import { describe, it, expect } from 'vitest'
import source from './synthetic-source.json'
import questions from './demo-questions.json'

// Launch-materials audit (CLAUDE.md #6): no employer / internal-product / 20% references.
// NOTE: "Gemma" is intentionally allowed — it's a public OSS model and the launch hook.
// We forbid employer + internal-product references only.
const FORBIDDEN = [/google/i, /\bgcp\b/i, /20\s*%/, /anti-?gravity/i]

function corpus(): string {
  return [
    ...source.map((s) => s.transcript),
    ...questions.flatMap((q) => [q.question, q.answer]),
  ].join('\n')
}

describe('synthetic demo data', () => {
  it('has at least 10 transcripts with unique ids', () => {
    expect(source.length).toBeGreaterThanOrEqual(10)
    expect(new Set(source.map((s) => s.id)).size).toBe(source.length)
  })

  it('has exactly 5 sample questions, each with a non-empty answer', () => {
    expect(questions).toHaveLength(5)
    for (const q of questions) {
      expect(q.question.trim().length).toBeGreaterThan(0)
      expect(q.answer.trim().length).toBeGreaterThan(0)
    }
  })

  it('contains NO employer / internal-product / 20% references (launch audit)', () => {
    const text = corpus()
    for (const pattern of FORBIDDEN) {
      expect(text).not.toMatch(pattern)
    }
  })
})
