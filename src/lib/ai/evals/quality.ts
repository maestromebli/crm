export type AiQualityInput = {
  text: string;
  maxSentences?: number;
  minChars?: number;
  requireUkrainian?: boolean;
  allowMarkdown?: boolean;
};

export type AiQualityReport = {
  score: number;
  passed: boolean;
  checks: {
    lengthOk: boolean;
    sentenceCountOk: boolean;
    ukrainianOk: boolean;
    markdownOk: boolean;
  };
  sentenceCount: number;
  violations: string[];
};

function sentenceCount(text: string): number {
  const chunks = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return chunks.length;
}

export function evaluateAiTextQuality(input: AiQualityInput): AiQualityReport {
  const maxSentences = input.maxSentences ?? 6;
  const minChars = input.minChars ?? 10;
  const requireUkrainian = input.requireUkrainian ?? true;
  const allowMarkdown = input.allowMarkdown ?? false;
  const text = input.text.trim();

  const sCount = sentenceCount(text);
  const lengthOk = text.length >= minChars;
  const sentenceCountOk = sCount > 0 && sCount <= maxSentences;
  const ukrainianOk = !requireUkrainian || /[іїєґІЇЄҐ]/.test(text);
  const markdownOk = allowMarkdown || !/[#*_`]{1,}/.test(text);

  const violations: string[] = [];
  if (!lengthOk) violations.push("Текст занадто короткий.");
  if (!sentenceCountOk) violations.push("Порушено ліміт речень.");
  if (!ukrainianOk) violations.push("Немає ознак українського тексту.");
  if (!markdownOk) violations.push("Відповідь містить markdown-розмітку.");

  let score = 100;
  if (!lengthOk) score -= 25;
  if (!sentenceCountOk) score -= 25;
  if (!ukrainianOk) score -= 30;
  if (!markdownOk) score -= 20;
  score = Math.max(0, score);

  return {
    score,
    passed: score >= 70 && violations.length === 0,
    checks: {
      lengthOk,
      sentenceCountOk,
      ukrainianOk,
      markdownOk,
    },
    sentenceCount: sCount,
    violations,
  };
}
