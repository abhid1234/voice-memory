/**
 * Builds the Gemma 4 prompt for a RAG answer. MediaPipe expects the
 * hand-formatted turn string (verified by the Task 1 spike): one user turn
 * holding the instruction + retrieved context + question, then an open model turn.
 */
export function buildGemmaPrompt(query: string, context: string): string {
  const instruction =
    "You are VoiceMemory, the user's personal memory assistant. " +
    "Answer the question using ONLY the memories below. " +
    "If the memories do not contain the answer, say you do not have a memory of it. " +
    "Be concise.";
  return (
    "<start_of_turn>user\n" +
    `${instruction}\n\nMemories:\n${context}\n\nQuestion: ${query}<end_of_turn>\n` +
    "<start_of_turn>model\n"
  );
}
