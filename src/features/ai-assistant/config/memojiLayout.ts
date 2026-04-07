import type { AssistantVisualState } from "../types";

/**
 * Спрайт-аркуш Memoji: 7 колонок × 3 ряди (21 клітина), 1024×512.
 * Ряд 0: тривога, peace, здивування, X «стоп», задум, ноутбук, facepalm
 * Ряд 1: shrug, thumbs down, кулак, молитва, тсс, підморкування, подвійний shrug
 * Ряд 2: допитливий, thumbs up, сміх, «презентація», схрещені пальці, шок, хвиля
 */
export const MEMOJI_SHEET = {
  src: "/assistant/memoji-sheet.png",
  cols: 7,
  rows: 3,
  widthPx: 1024,
  heightPx: 512,
} as const;

/** Індекс клітини (row-major, з 0). */
export const MEMOJI_CELL_BY_STATE: Record<AssistantVisualState, number> = {
  idle: 20,
  listening: 17,
  thinking: 4,
  speaking: 5,
  success: 15,
  warning: 7,
  error: 3,
  sleeping: 10,
};

export const MEMOJI_ANIM = {
  poseSpring: { type: "spring" as const, stiffness: 520, damping: 28, mass: 0.72 },
  idleFloat: { duration: 6.4, repeat: Infinity, ease: "easeInOut" as const },
  voicePulse: { duration: 0.85, repeat: Infinity, ease: "easeInOut" as const },
} as const;
