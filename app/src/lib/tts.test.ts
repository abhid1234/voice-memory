import { describe, it, expect, vi, beforeEach } from 'vitest'
import { speak, cancel } from './tts'

beforeEach(() => {
  vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn() })
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class { text: string; constructor(t: string) { this.text = t } },
  )
})

describe('tts', () => {
  it('speak() cancels any in-flight speech then speaks the text', () => {
    speak('hello world')
    expect(speechSynthesis.cancel).toHaveBeenCalledOnce()
    expect(speechSynthesis.speak).toHaveBeenCalledOnce()
    const utter = (speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(utter.text).toBe('hello world')
  })
  it('cancel() stops speech', () => {
    cancel()
    expect(speechSynthesis.cancel).toHaveBeenCalledOnce()
  })
  it('speak() with empty text does nothing', () => {
    speak('   ')
    expect(speechSynthesis.speak).not.toHaveBeenCalled()
  })
})
