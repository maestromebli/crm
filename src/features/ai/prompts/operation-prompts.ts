import { aiUserRoleLabel } from "../policies/ai-data-policy";
import type { SessionUser } from "../../../lib/authz/api-guard";
import type { FollowUpTone } from "../core/types";

const UK_RULES = `Правила:
- Мова: українська.
- Не вигадуйте факти — лише з контексту JSON.
- Якщо даних бракує, явно скажіть чого не вистачає.
- Не обіцяйте автоматичних змін у CRM — лише рекомендації.
- Вихід СТРОГО один JSON-об'єкт без markdown.`;

export function systemJsonAssistant(): string {
  return `Ти операційний асистент ENVER CRM (меблі на замовлення). ${UK_RULES}`;
}

function roleLine(user: SessionUser): string {
  return `Роль користувача (орієнтир): ${aiUserRoleLabel(user)}.`;
}

export function promptLeadSummary(contextJson: string, user: SessionUser): string {
  return `${roleLine(user)}

Контекст ліда (JSON):
${contextJson}

Поверни JSON:
{
  "shortSummary": "1–2 речення",
  "whatMattersNow": "що найважливіше зараз",
  "blockers": ["..."],
  "nextSteps": ["конкретні кроки менеджера"]
}`;
}

export function promptLeadNextStep(contextJson: string, user: SessionUser): string {
  return `${roleLine(user)}

Контекст ліда (JSON):
${contextJson}

Поверни JSON:
{
  "recommendedAction": "один головний наступний крок",
  "rationale": "чому так",
  "checklist": ["2–5 пунктів перевірки"]
}`;
}

export function promptLeadFollowUp(
  contextJson: string,
  user: SessionUser,
  tone: FollowUpTone,
): string {
  return `${roleLine(user)}
Тон повідомлення клієнту: ${tone}.

Контекст ліда (JSON):
${contextJson}

Поверни JSON:
{
  "shortVersion": "коротке повідомлення (месенджер/SMS)",
  "detailedVersion": "розгорнутіше, ввічливо",
  "ctaSuggestion": "заклик до відповіді / зустрічі"
}`;
}

export function promptLeadRiskExplain(contextJson: string, user: SessionUser): string {
  return `${roleLine(user)}

У контексті вже є евристичні ризики CRM — поясни їх менеджеру.

Контекст (JSON):
${contextJson}

Поверни JSON:
{
  "riskLevel": "low" | "medium" | "high",
  "explanation": "2–4 речення",
  "whatToDo": ["конкретні дії"]
}`;
}

export function promptProposalIntro(contextJson: string, user: SessionUser): string {
  return `${roleLine(user)}

Контекст ліда та КП (JSON):
${contextJson}

Згенеруй вступний абзац до комерційної пропозиції для клієнта (не юридичний текст).

Поверни JSON:
{
  "introParagraph": "1 абзац",
  "bullets": ["2–4 переваги або акценти"],
  "readinessNote": "чи виглядає КП готовим до відправки з точки зору даних у контексті"
}`;
}

export function promptDealSummary(
  contextJson: string,
  user: SessionUser,
): string {
  return `${roleLine(user)}

Контекст угоди (JSON):
${contextJson}

Поверни JSON:
{
  "headline": "одне речення",
  "situation": "2–4 речення",
  "blockers": ["..."],
  "suggestedMoves": ["наступні кроки"]
}`;
}

export function promptDealReadiness(
  contextJson: string,
  user: SessionUser,
): string {
  return `${roleLine(user)}

Контекст угоди (JSON):
${contextJson}

У контексті вже є чекліст готовності — погодься або уточни.

Поверни JSON:
{
  "ready": true або false,
  "summary": "короткий висновок",
  "blockers": ["залишені блокери"],
  "recommendedActions": ["що зробити"]
}`;
}

export function promptDashboardBrief(
  contextJson: string,
  user: SessionUser,
): string {
  return `${roleLine(user)}

Дані дашборду (JSON, у межах прав користувача):
${contextJson}

Поверни JSON:
{
  "priorities": ["3–5 пріоритетів на сьогодні"],
  "urgentItems": ["термінові/затримки"],
  "risks": ["ризики воронки/передачі"],
  "managerActions": ["що зробити менеджеру/керівнику залежно від ролі"]
}`;
}
