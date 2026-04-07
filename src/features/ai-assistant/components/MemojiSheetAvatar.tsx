"use client";

import { useMemo, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { cn } from "../../../lib/utils";
import { assistantConfig } from "../config/assistantConfig";
import {
  MEMOJI_ANIM,
  MEMOJI_CELL_BY_STATE,
  MEMOJI_SHEET,
} from "../config/memojiLayout";
import type {
  AssistantAppearanceConfig,
  AssistantAvatarProps,
  AssistantVisualState,
} from "../types";

const SIZE_PX = { sm: 44, md: 52, lg: 60 } as const;

type SizeProp = keyof typeof SIZE_PX | number;

function resolvePx(size: SizeProp | undefined): number {
  if (size === undefined) return SIZE_PX.md;
  if (typeof size === "number") return size;
  return SIZE_PX[size];
}

function ringColor(state: AssistantVisualState): string {
  const av = assistantConfig.avatar;
  switch (state) {
    case "thinking":
    case "speaking":
      return `0 0 0 1.5px ${av.glowThinking}, 0 8px 22px -8px rgba(67, 56, 202, 0.18), inset 0 1px 0 rgba(255,255,255,0.08)`;
    case "success":
      return `0 0 0 1.5px ${av.glowSuccess}, 0 6px 18px -8px rgba(34, 197, 94, 0.15), inset 0 1px 0 rgba(255,255,255,0.08)`;
    case "warning":
      return `0 0 0 1.5px ${av.glowWarning}, 0 6px 18px -8px rgba(245, 158, 11, 0.16), inset 0 1px 0 rgba(255,255,255,0.06)`;
    case "error":
      return `0 0 0 1.5px ${av.glowError}, 0 6px 18px -8px rgba(239, 68, 68, 0.15), inset 0 1px 0 rgba(255,255,255,0.06)`;
    case "listening":
      return `0 0 0 1.5px rgba(100, 116, 139, 0.35), 0 6px 20px -8px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255,255,255,0.08)`;
    case "sleeping":
      return `0 0 0 1.5px rgba(148, 163, 184, 0.35), 0 4px 18px -8px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.06)`;
    default:
      return `0 0 0 1.5px ${av.glowIdle}, 0 8px 24px -10px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255,255,255,0.1)`;
  }
}

function resolveFacialTier(appearance?: Partial<AssistantAppearanceConfig>) {
  const tier =
    appearance?.motionIntensity ?? assistantConfig.appearance.motionIntensity;
  return tier === "medium"
    ? assistantConfig.motion.facialMotion.medium
    : assistantConfig.motion.facialMotion.low;
}

export function MemojiSheetAvatar({
  state,
  size = "md",
  appearance,
  reducedMotion = false,
  voiceActive = false,
  className,
}: AssistantAvatarProps) {
  const px = resolvePx(size);
  const rm = reducedMotion ? "enver-assistant-reduced" : "";
  const thinking =
    state === "thinking" || state === "speaking"
      ? "enver-assistant-glow-thinking"
      : "";

  const fm = resolveFacialTier(appearance);
  const widgetFloatPx =
    fm.widgetFloatPx *
    assistantConfig.motion.floatIntensity *
    (state === "thinking" || state === "speaking" ? 0.88 : 1);

  const cellIndex = MEMOJI_CELL_BY_STATE[state];
  const { cols, rows, widthPx, heightPx } = MEMOJI_SHEET;
  const cellW = widthPx / cols;
  const cellH = heightPx / rows;
  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);

  const coverScale = useMemo(() => {
    const s = Math.max(px / cellW, px / cellH) * 1.08;
    return Number.isFinite(s) ? s : 1;
  }, [px, cellW, cellH]);

  const floatOn =
    !reducedMotion && state !== "sleeping" && state !== "error";

  const motionAnim = useMemo(() => {
    if (reducedMotion) return undefined;
    if (state === "sleeping") return undefined;
    return { y: [0, -widgetFloatPx, 0] };
  }, [reducedMotion, state, widgetFloatPx]);

  const motionTransition = useMemo(() => {
    if (reducedMotion) return undefined;
    const base = state === "thinking" || state === "speaking" ? 5.2 : 6.5;
    return {
      duration: base,
      repeat: Infinity,
      ease: "easeInOut" as const,
    };
  }, [reducedMotion, state]);

  const sheet = assistantConfig.avatar.memojiSheet;

  return (
    <div
      className={cn(
        "relative rounded-full",
        rm,
        thinking,
        state === "sleeping" && "opacity-[0.85]",
        className,
      )}
      style={{
        width: px,
        height: px,
        boxShadow: ringColor(state),
        transition: "box-shadow 0.5s ease, opacity 0.4s ease",
      }}
    >
      <motion.div
        className="absolute inset-0 overflow-hidden rounded-full will-change-transform"
        animate={floatOn ? motionAnim : undefined}
        transition={floatOn ? motionTransition : undefined}
      >
        <motion.div
          key={state}
          className="absolute inset-0"
          initial={
            reducedMotion
              ? false
              : { scale: 0.88, rotate: -5, filter: "brightness(1.06)" }
          }
          animate={{ scale: 1, rotate: 0, filter: "brightness(1)" }}
          transition={
            reducedMotion ? { duration: 0 } : MEMOJI_ANIM.poseSpring
          }
        >
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: cellW,
              height: cellH,
              backgroundImage: `url(${sheet.src})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${widthPx}px ${heightPx}px`,
              backgroundPosition: `${-col * cellW}px ${-row * cellH}px`,
              transform: `translate(-50%, -50%) scale(${coverScale})`,
              transformOrigin: "center center",
            }}
            aria-hidden
          />
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-full"
            animate={
              voiceActive && !reducedMotion
                ? { opacity: [0.12, 0.22, 0.12] }
                : { opacity: 0.1 }
            }
            transition={
              voiceActive && !reducedMotion
                ? MEMOJI_ANIM.voicePulse
                : { duration: 0.2 }
            }
            style={
              {
                background:
                  "radial-gradient(ellipse 72% 70% at 50% 38%, rgba(255,248,240,0.14) 0%, rgba(15,12,10,0.2) 100%)",
              } as CSSProperties
            }
            aria-hidden
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
