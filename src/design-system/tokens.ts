/**
 * Дзеркало CSS-змінних з `styles/globals.css` для типобезпечного використання в TS
 * (графіки, canvas, PDF, тести).
 */
export const enverCssVar = {
  bg: "var(--enver-bg)",
  surface: "var(--enver-surface)",
  surfaceElevated: "var(--enver-surface-elevated)",
  card: "var(--enver-card)",
  border: "var(--enver-border)",
  borderStrong: "var(--enver-border-strong)",
  text: "var(--enver-text)",
  textMuted: "var(--enver-text-muted)",
  muted: "var(--enver-muted)",
  accent: "var(--enver-accent)",
  accentHover: "var(--enver-accent-hover)",
  accentSoft: "var(--enver-accent-soft)",
  success: "var(--enver-success)",
  successSoft: "var(--enver-success-soft)",
  warning: "var(--enver-warning)",
  warningSoft: "var(--enver-warning-soft)",
  danger: "var(--enver-danger)",
  dangerSoft: "var(--enver-danger-soft)",
  info: "var(--enver-info)",
  infoSoft: "var(--enver-info-soft)",
  hover: "var(--enver-hover)",
  inputBg: "var(--enver-input-bg)",
  radius: "var(--enver-radius)",
  shadow: "var(--enver-shadow)",
  shadowLg: "var(--enver-shadow-lg)",
  accentRing: "var(--enver-accent-ring)",
  transition: "var(--enver-transition)",
} as const;

export type EnverCssVarKey = keyof typeof enverCssVar;
