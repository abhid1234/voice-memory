export function fallbackPolish(rawText: string, style: string, dictionary: string[]): string {
  if (!rawText.trim()) return '';

  // 1. Remove filler words (case-insensitive, matching word boundaries)
  let cleaned = rawText;
  cleaned = cleaned.replace(/\b(um|uh|er|ah|eh)\b/gi, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 2. Personal dictionary replacements
  dictionary.forEach(term => {
    const trimmed = term.trim();
    if (!trimmed) return;
    // Escape regex characters to prevent pattern breakage
    const escaped = trimmed.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    cleaned = cleaned.replace(regex, trimmed);
  });

  // Ensure first letter capitalization
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // 3. Style-based formatting
  switch (style) {
    case 'bullets': {
      // Split by sentence terminators (. ! ?)
      const sentences = cleaned.split(/(?<=[.!?])\s+/);
      return sentences
        .map(s => `• ${s.trim()}`)
        .filter(s => s.length > 2)
        .join('\n');
    }
    case 'email': {
      return `Subject: Dictated Notes\n\nHi team,\n\n${cleaned}\n\nBest regards,\n[My Name]`;
    }
    case 'slack': {
      return `👋 ${cleaned}`;
    }
    case 'custom': {
      return `[Local Fallback: Gemma model is downloading/offline. Raw cleaned text below]\n\n${cleaned}`;
    }
    case 'raw': {
      return rawText;
    }
    case 'cleaned':
    default: {
      return cleaned;
    }
  }
}

export function fallbackInsights(text: string): string {
  if (!text.trim()) return 'No content to analyze.';

  const actionItems: string[] = [];
  const entities: string[] = [];

  // Split into sentences using a simple punctuation parser
  const sentences = text.split(/(?<=[.!?])\s+/);
  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();
    if (
      lower.includes('todo') ||
      lower.includes('need to') ||
      lower.includes('must') ||
      lower.includes('should') ||
      lower.includes('remember to') ||
      lower.includes('remind me') ||
      lower.includes('call') ||
      lower.includes('email') ||
      lower.includes('send') ||
      lower.includes('follow up')
    ) {
      actionItems.push(sentence.trim());
    }
  });

  // Extract capitalized words as potential entities
  const words = text.split(/\s+/);
  words.forEach(word => {
    const cleaned = word.replace(/[^a-zA-Z]/g, '');
    if (
      cleaned.length > 3 &&
      cleaned[0] === cleaned[0].toUpperCase() &&
      cleaned[0] !== cleaned[0].toLowerCase()
    ) {
      if (!entities.includes(cleaned)) {
        entities.push(cleaned);
      }
    }
  });

  let result = '';
  if (actionItems.length > 0) {
    result += `📋 **Action Items:**\n` + actionItems.map(item => `• ${item}`).join('\n') + `\n\n`;
  } else {
    result += `📋 **Action Items:** None detected.\n\n`;
  }

  if (entities.length > 0) {
    result += `🔑 **Key Entities:** ${entities.slice(0, 8).join(', ')}`;
  } else {
    result += `🔑 **Key Entities:** None detected.`;
  }

  return result;
}
