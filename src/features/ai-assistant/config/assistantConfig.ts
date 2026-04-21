/**
 * Центральна конфігурація плаваючого AI-помічника (вигляд, прапорці, інтенсивність руху).
 * Змінюйте тут кольори та копі, не розкидаючи магічні рядки по компонентах.
 */

import type { AssistantAppearanceConfig } from "../types";

export const assistantConfig = {
  enabled: true,
  /** Маршрути (префікси), де віджет прихований (наприклад, повноекранний AI-чат) */
  disabledPathPrefixes: ["/dashboard/ai"] as string[],
  widget: {
    sizePx: 56,
    /** Відступи від країв viewport */
    offsetRight: 20,
    offsetBottom: 20,
    /** z-index панелі та кнопки */
    zIndex: 90,
  },
  panel: {
    widthPx: 400,
    maxHeightVh: 86,
  },
  avatar: {
    /** Теплий tan / deep skin — преміум-палітра консьєржа */
    skinLight: "#d4a574",
    skinBase: "#b88962",
    skinShadow: "#6b4a36",
    skinDeep: "#4a3428",
    /** Підсвітка «ключового» світла (лоб / вилиця) */
    highlight: "rgba(255, 248, 240, 0.22)",
    hair: "#14110e",
    hairHighlight: "#2a2420",
    /** Щетина: насиченість шару (крапки + м’яка текстура) */
    stubbleOpacity: 0.18,
    stubbleColor: "#3d2b22",
    smileStroke: "#5a3d2f",
    glowIdle: "rgba(100, 116, 139, 0.28)",
    glowThinking: "rgba(99, 102, 241, 0.38)",
    glowSuccess: "rgba(34, 197, 94, 0.32)",
    glowWarning: "rgba(245, 158, 11, 0.38)",
    glowError: "rgba(239, 68, 68, 0.36)",
    /**
     * Окремий PNG персонажа (прозорий фон) — пріоритет над memoji та SVG.
     * Оновити кадр: покласти вихідний файл у scripts/assistant-face-source.png і виконати `pnpm assistant:process-face`.
     * Після заміни PNG змініть `cacheBust`, щоб примусово оновити asset у проді/CDN.
     */
    assistantFace: {
      enabled: true,
      src: "/assistant/assistant-face.png?v=2026-04-04-1",
      objectPosition: "50% 32%",
      scale: 1.14,
      transformOrigin: "50% 38%",
    },
    /**
     * Спрайт Memoji (7×3) — якщо увімкнено і вимкнено assistantFace.
     */
    memojiSheet: {
      enabled: true,
      src: "/assistant/memoji-sheet.png",
    },
  },
  motion: {
    /** Множник амплітуди (0 = вимкнено при reduced motion) */
    floatIntensity: 1,
    blinkIntervalMs: { min: 2800, max: 5200 },
    /** Тривалість короткого «успіху» після дії (мс), щоб уникнути мерехтіння */
    successPulseMs: 900,
    /**
     * Мікроанімації обличчя (не глобальне «стрибання» тіла).
     * `low` — майже непомітно, для довгих сесій; `medium` — трохи виразніше.
     */
    facialMotion: {
      low: {
        micro: 0.38,
        widgetFloatPx: 0.9,
        headTiltDeg: 0.55,
        pupilDrift: 0.35,
        mouthSpeakAmp: 1.02,
      },
      medium: {
        micro: 0.55,
        widgetFloatPx: 1.25,
        headTiltDeg: 0.85,
        pupilDrift: 0.5,
        mouthSpeakAmp: 1.035,
      },
    },
  },
  /**
   * Параметри зовнішнього вигляду (дублюють ключові поля avatar + панель).
   * Передавайте частково в AssistantAvatar через `appearance`.
   */
  appearance: {
    skinTone: "#b88962",
    skinToneShadow: "#6b4a36",
    stubbleOpacity: 0.18,
    smileIntensity: 1,
    eyeSize: 1,
    glowFrom: "rgba(124, 92, 255, 0.22)",
    glowTo: "rgba(15, 23, 42, 0.12)",
    ringColor: "rgba(124, 92, 255, 0.35)",
    panelWidth: "400px",
    motionIntensity: "low",
  } satisfies AssistantAppearanceConfig,
  copy: {
    tooltipReady: "AI готовий допомогти",
    tooltipSuggestion: "Є рекомендація",
    tooltipSuggestionsPlural: "Є рекомендації",
    tooltipAction: "Потрібна дія",
    tooltipOpen: "Відкрити помічника",
    panelTitle: "Помічник ENVER",
    /** Короткий підзаголовок у панелі (статус формується окремо) */
    panelSubtitleHint:
      "Аналіз, нагадування та відповіді з урахуванням ваших прав",
    openFullChat: "Повний чат AI",
    fullChatHref: "/dashboard/ai",
    chatEmptyHint:
      "Запитайте про аналіз ліда/замовлення, нагадування про задачі чи наступні кроки. Історія збережена в цій сесії браузера.",
    chatPlaceholder:
      "Питання, аналіз або нагадування… (Enter — надіслати, Shift+Enter — новий рядок)",
    /** Заголовок зони повідомлень у плаваючій панелі */
    chatSectionTitle: "Діалог",
    chatThreadSubtitle: "Ваші повідомлення та відповіді",
  },
} as const;

export type AssistantConfig = typeof assistantConfig;
