import { getAllMemos } from './storage';
import type { VoiceMemo } from './storage';

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
