export type ExtractedIssue = {
  id: string;
  title: string;
  unresolved: boolean;
  critical: boolean;
};

export type CommunicationSummary = {
  keyQuestions: string[];
  unanswered: string[];
  criticalClarifications: string[];
  contradictions: string[];
  issues: ExtractedIssue[];
};

const QUESTION_HINTS = ["?", "уточніть", "потрібно", "confirm", "підтвердіть", "неясно"];
const CRITICAL_HINTS = ["критично", "терміново", "ризик", "blocker", "затримка"];
const CONTRADICTION_HINTS = ["але", "однак", "суперечить", "не збігається"];

export function extractCommunicationSummary(rawMessages: string[]): CommunicationSummary {
  const normalized = rawMessages.map((m) => m.trim()).filter(Boolean);
  const keyQuestions = normalized.filter((line) =>
    QUESTION_HINTS.some((hint) => line.toLowerCase().includes(hint)),
  );
  const criticalClarifications = normalized.filter((line) =>
    CRITICAL_HINTS.some((hint) => line.toLowerCase().includes(hint)),
  );
  const contradictions = normalized.filter((line) =>
    CONTRADICTION_HINTS.some((hint) => line.toLowerCase().includes(hint)),
  );

  const unanswered = keyQuestions.filter((line) => !line.toLowerCase().includes("підтверджено"));
  const issues: ExtractedIssue[] = unanswered.map((text, idx) => ({
    id: `issue-${idx + 1}`,
    title: text.slice(0, 120),
    unresolved: true,
    critical: CRITICAL_HINTS.some((hint) => text.toLowerCase().includes(hint)),
  }));

  return {
    keyQuestions: keyQuestions.slice(0, 6),
    unanswered: unanswered.slice(0, 6),
    criticalClarifications: criticalClarifications.slice(0, 6),
    contradictions: contradictions.slice(0, 4),
    issues,
  };
}
