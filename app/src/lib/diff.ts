export interface DiffToken {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

/**
 * Computes a word-by-word difference between two strings using a dynamic programming LCS approach.
 * Returns an array of tokens indicating whether each word was added, removed, or remains unchanged.
 */
export function computeWordDiff(oldStr: string, newStr: string): DiffToken[] {
  const cleanOld = oldStr || '';
  const cleanNew = newStr || '';

  const oldWords = cleanOld.trim().split(/\s+/).filter(Boolean);
  const newWords = cleanNew.trim().split(/\s+/).filter(Boolean);

  const dp: number[][] = Array(oldWords.length + 1)
    .fill(null)
    .map(() => Array(newWords.length + 1).fill(0));

  // Clean punctuation for word equivalence checks so punctuation changes don't flag entire words
  const normalize = (w: string) => w.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '');

  for (let i = 1; i <= oldWords.length; i++) {
    for (let j = 1; j <= newWords.length; j++) {
      if (normalize(oldWords[i - 1]) === normalize(newWords[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diff: DiffToken[] = [];
  let i = oldWords.length;
  let j = newWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalize(oldWords[i - 1]) === normalize(newWords[j - 1])) {
      diff.push({ type: 'unchanged', value: newWords[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.push({ type: 'added', value: newWords[j - 1] });
      j--;
    } else {
      diff.push({ type: 'removed', value: oldWords[i - 1] });
      i--;
    }
  }

  return diff.reverse();
}
