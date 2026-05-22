import type { VoiceMemo } from "./storage";

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function retrieve(
  queryVec: Float32Array,
  memos: VoiceMemo[],
  k = 5,
): { context: string; citations: VoiceMemo[] } {
  const ranked = memos
    // Skip records without a usable embedding (e.g. memos written before the
    // embedding field existed); cosineSimilarity assumes a non-empty vector.
    .filter((memo) => memo.embedding && memo.embedding.length > 0)
    .map((memo) => ({
      memo,
      score: cosineSimilarity(queryVec, memo.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => r.memo);

  const context = ranked.length
    ? ranked
        .map(
          (m, i) =>
            `[${i + 1}] Captured ${new Date(m.timestamp).toLocaleString()}: ${m.transcript}`,
        )
        .join("\n\n")
    : "No relevant memories found.";

  return { context, citations: ranked };
}
