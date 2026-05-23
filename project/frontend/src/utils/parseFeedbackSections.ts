export interface FeedbackSections {
  strengths: string[];
  improvements: string[];
  other: string[];
}

const STRENGTH_HINTS = /strength|strong|well|excellent|good at|impressive|positive|clearly|effectively/i;
const IMPROVE_HINTS = /improve|weak|lack|consider|work on|should|better|gap|missing|needs|unclear|vague/i;

function cleanBullet(line: string): string {
  return line.replace(/^[\s•\-*–—\d.)]+/, '').trim();
}

function classifyLine(text: string): keyof FeedbackSections {
  if (STRENGTH_HINTS.test(text) && !IMPROVE_HINTS.test(text)) return 'strengths';
  if (IMPROVE_HINTS.test(text)) return 'improvements';
  return 'other';
}

/**
 * Splits LLM feedback into scannable sections for the results reveal UI.
 */
export function parseFeedbackSections(raw: string): FeedbackSections {
  const sections: FeedbackSections = { strengths: [], improvements: [], other: [] };
  const text = raw.trim();
  if (!text) return sections;

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let bucket: keyof FeedbackSections | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^strengths?:?\s*$/i.test(line)) {
      bucket = 'strengths';
      continue;
    }
    if (/^(areas? for )?improvement|weakness|growth/i.test(lower)) {
      bucket = 'improvements';
      continue;
    }

    const content = cleanBullet(line);
    if (!content || content.length < 4) continue;

    if (bucket) {
      sections[bucket].push(content);
    } else if (/^[\s•\-*–—]/.test(line) || /^\d+[.)]/.test(line)) {
      sections[classifyLine(content)].push(content);
    } else {
      sections[classifyLine(content)].push(content);
    }
  }

  const total = sections.strengths.length + sections.improvements.length + sections.other.length;
  if (total <= 1) {
    const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 20);
    if (paragraphs.length >= 2) {
      return {
        strengths: [paragraphs[0]],
        improvements: paragraphs.length > 2 ? [paragraphs[1]] : [],
        other: paragraphs.slice(paragraphs.length > 2 ? 2 : 1),
      };
    }
    return { strengths: [], improvements: [], other: [text] };
  }

  return sections;
}
