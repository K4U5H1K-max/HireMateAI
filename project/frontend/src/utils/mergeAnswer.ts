/**
 * Merges manually typed text with voice transcript segments into one answer string.
 * Avoids duplicate words when the transcript already appears in typed content.
 */
export function mergeHybridAnswer(typedText: string, transcriptText: string): string {
  const typed = typedText.trim();
  const transcript = transcriptText.trim();

  if (!typed && !transcript) return '';
  if (!transcript) return typedText;
  if (!typed) return transcriptText;

  const typedLower = typed.toLowerCase();
  const transcriptLower = transcript.toLowerCase();

  if (typedLower.includes(transcriptLower)) return typedText;
  if (transcriptLower.includes(typedLower)) return transcriptText;

  const needsSpace =
    !typed.endsWith(' ') &&
    !transcript.startsWith(' ') &&
    !/[.!?,:;]$/.test(typed.slice(-1));

  return needsSpace ? `${typedText} ${transcriptText}` : `${typedText}${transcriptText}`;
}

/**
 * Appends a new transcript chunk without duplicating trailing content.
 */
export function appendTranscriptChunk(existing: string, chunk: string): string {
  const next = chunk.trim();
  if (!next) return existing;

  if (!existing.trim()) return next;

  const existingTrimmed = existing.trimEnd();
  if (existingTrimmed.toLowerCase().endsWith(next.toLowerCase())) {
    return existing;
  }
  if (next.toLowerCase().startsWith(existingTrimmed.toLowerCase())) {
    return next;
  }

  return mergeHybridAnswer(existingTrimmed, next);
}
