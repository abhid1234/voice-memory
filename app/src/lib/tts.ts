/** Speak text via the browser's on-device Web Speech API. Cancels any in-flight utterance first. */
export function speak(text: string): void {
  const trimmed = text.trim()
  if (!trimmed) return
  if (typeof speechSynthesis === 'undefined') return
  speechSynthesis.cancel()
  speechSynthesis.speak(new SpeechSynthesisUtterance(trimmed))
}

/** Stop any in-flight speech. */
export function cancel(): void {
  if (typeof speechSynthesis === 'undefined') return
  speechSynthesis.cancel()
}
