import { getAllMemos } from './storage';
import type { VoiceMemo } from './storage';

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function retrieve(
  queryVec: Float32Array,
  memos: VoiceMemo[],
  k = 5,
): { context: string; citations: VoiceMemo[] } {
  const ranked = memos
    .map((memo) => ({ memo, score: cosineSimilarity(queryVec, memo.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => r.memo)

  const context = ranked.length
    ? ranked
        .map((m, i) => `[${i + 1}] Captured ${new Date(m.timestamp).toLocaleString()}: ${m.transcript}`)
        .join('\n\n')
    : 'No relevant memories found.'

  return { context, citations: ranked }
}

export interface RetrievalResult {
  context: string;
  citations: VoiceMemo[];
}

export async function retrieveRelevantContext(query: string): Promise<RetrievalResult> {
  const allMemos = await getAllMemos();
  const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);

  // Simple keyword matching for RAG context
  const relevantMemos = allMemos
    .filter(memo => {
      const text = memo.transcript.toLowerCase();
      return queryTerms.some(term => text.includes(term));
    })
    .sort((a, b) => b.timestamp - a.timestamp) // Prefer newer ones
    .slice(0, 5); // Take top 5

  const context = relevantMemos
    .map((memo, index) => `[${index + 1}] Captured ${new Date(memo.timestamp).toLocaleString()}: ${memo.transcript}`)
    .join('\n\n');

  return {
    context: context || "No relevant memories found.",
    citations: relevantMemos
  };
}
