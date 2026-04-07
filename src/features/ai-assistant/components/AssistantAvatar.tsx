"use client";

import { useId, useMemo, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { cn } from "../../../lib/utils";
import { assistantConfig } from "../config/assistantConfig";
import type {
  AssistantAppearanceConfig,
  AssistantAvatarProps,
  AssistantVisualState,
} from "../types";
import { AssistantFaceAvatar } from "./AssistantFaceAvatar";
import { MemojiSheetAvatar } from "./MemojiSheetAvatar";

const { avatar: av } = assistantConfig;

const SIZE_PX = { sm: 44, md: 52, lg: 60 } as const;

type SizeProp = keyof typeof SIZE_PX | number;

type FacialTier =
  (typeof assistantConfig.motion.facialMotion)[keyof typeof assistantConfig.motion.facialMotion];

export type { AssistantAvatarProps };

function resolvePx(size: SizeProp | undefined): number {
  if (size === undefined) return SIZE_PX.md;
  if (typeof size === "number") return size;
  return SIZE_PX[size];
}

function ringColor(state: AssistantVisualState): string {
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

const STUBBLE: [number, number, number][] = [
  [33, 71, 0.45],
  [36, 74, 0.55],
  [40, 77, 0.5],
  [44, 79, 0.42],
  [48, 80, 0.48],
  [52, 80, 0.48],
  [56, 79, 0.42],
  [60, 77, 0.5],
  [64, 74, 0.55],
  [67, 71, 0.45],
  [38, 69, 0.35],
  [45, 72, 0.38],
  [50, 73, 0.4],
  [55, 72, 0.38],
  [62, 69, 0.35],
];

function facialNudge(state: AssistantVisualState): {
  browDy: number;
  smileMul: number;
} {
  switch (state) {
    case "thinking":
    case "speaking":
      return { browDy: 0.38, smileMul: 0.93 };
    case "warning":
      return { browDy: -0.42, smileMul: 0.87 };
    case "success":
      return { browDy: -0.22, smileMul: 1.06 };
    case "error":
      return { browDy: 0.22, smileMul: 0.85 };
    case "listening":
      return { browDy: -0.14, smileMul: 1.03 };
    case "sleeping":
      return { browDy: 0.12, smileMul: 0.91 };
    default:
      return { browDy: 0, smileMul: 1 };
  }
}

function resolveFacialTier(
  appearance?: Partial<AssistantAppearanceConfig>,
): FacialTier {
  const tier = appearance?.motionIntensity ?? assistantConfig.appearance.motionIntensity;
  return tier === "medium"
    ? assistantConfig.motion.facialMotion.medium
    : assistantConfig.motion.facialMotion.low;
}

function blinkVarsFromUid(uid: string): { dur: string; delay: string } {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h += uid.charCodeAt(i);
  const dur = 4.2 + (h % 22) / 10;
  const delay = (uid.charCodeAt(0) % 28) / 10;
  return { dur: `${dur}s`, delay: `${delay}s` };
}

export function AssistantAvatar(props: AssistantAvatarProps) {
  if (assistantConfig.avatar.assistantFace.enabled) {
    return <AssistantFaceAvatar {...props} />;
  }
  if (assistantConfig.avatar.memojiSheet.enabled) {
    return <MemojiSheetAvatar {...props} />;
  }
  return <AssistantDefaultAvatar {...props} />;
}

function AssistantDefaultAvatar(props: AssistantAvatarProps) {
  const {
    state,
    size = "md",
    appearance,
    reducedMotion = false,
    voiceActive = false,
    className,
  } = props;

  const uid = useId().replace(/:/g, "");
  const skinRad = `enver-skin-rad-${uid}`;
  const hair = `enver-hair-${uid}`;
  const iris = `enver-iris-${uid}`;
  const ambient = `enver-ambient-${uid}`;

  const px = resolvePx(size);
  const rm = reducedMotion ? "enver-assistant-reduced" : "";
  const thinking =
    state === "thinking" || state === "speaking"
      ? "enver-assistant-glow-thinking"
      : "";

  const fm = resolveFacialTier(appearance);
  const { browDy, smileMul } = facialNudge(state);
  const browShift = browDy * fm.micro;

  const skinLight = av.skinLight;
  const skinBase = appearance?.skinTone ?? av.skinBase;
  const skinShadow = appearance?.skinToneShadow ?? av.skinShadow;
  const stubbleOp = appearance?.stubbleOpacity ?? av.stubbleOpacity;
  const smileW =
    1.35 *
    (appearance?.smileIntensity ?? assistantConfig.appearance.smileIntensity) *
    smileMul;
  const eyeMul = appearance?.eyeSize ?? assistantConfig.appearance.eyeSize;

  /** Плав корпусу в px: окремо від facial micro, інакше амплітуда майже нульова */
  const widgetFloatPx =
    fm.widgetFloatPx *
    assistantConfig.motion.floatIntensity *
    (state === "thinking" || state === "speaking" ? 0.88 : 1);

  const { dur: blinkDur, delay: blinkDelay } = useMemo(
    () => blinkVarsFromUid(uid),
    [uid],
  );

  const motionAnim = useMemo(() => {
    if (reducedMotion) return undefined;
    if (state === "sleeping") return undefined;
    return { y: [0, -widgetFloatPx, 0] };
  }, [reducedMotion, state, widgetFloatPx]);

  const motionTransition = useMemo(() => {
    if (reducedMotion) return undefined;
    const base = state === "thinking" || state === "speaking" ? 5.4 : 6.6;
    return {
      duration: base,
      repeat: Infinity,
      ease: "easeInOut" as const,
    };
  }, [reducedMotion, state]);

  /** Один множник micro для обличчя — без подвійного «затиску» для нахилу */
  const headTiltAmp = fm.headTiltDeg * (0.45 + 0.55 * fm.micro);
  const pupilAmp = fm.pupilDrift * (0.35 + 0.65 * fm.micro) * eyeMul;
  const mouthSpeakAmp = fm.mouthSpeakAmp;

  const pupilDriftOn =
    !reducedMotion &&
    (state === "idle" ||
      state === "listening" ||
      state === "success" ||
      state === "warning");

  const pupilWarnFactor = state === "warning" ? 0.55 : 1;

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
        animate={motionAnim}
        transition={motionTransition}
      >
        <div
          className="absolute inset-0 overflow-hidden rounded-full"
          style={{
            background: `radial-gradient(ellipse 85% 75% at 50% 38%, rgba(45,38,32,0.15) 0%, rgba(15,12,10,0.55) 100%)`,
          }}
          aria-hidden
        />
        <svg
          viewBox="0 0 100 118"
          className="relative h-full w-full text-[0]"
          aria-hidden
        >
          <defs>
            <radialGradient id={skinRad} cx="42%" cy="32%" r="68%">
              <stop offset="0%" stopColor={skinLight} />
              <stop offset="42%" stopColor={skinBase} />
              <stop offset="100%" stopColor={skinShadow} />
            </radialGradient>
            <linearGradient id={hair} x1="0" y1="0" x2="0.2" y2="1">
              <stop offset="0%" stopColor={av.hairHighlight} />
              <stop offset="55%" stopColor={av.hair} />
              <stop offset="100%" stopColor="#0a0908" />
            </linearGradient>
            <radialGradient id={iris} cx="40%" cy="40%" r="70%">
              <stop offset="0%" stopColor="#5c4a42" />
              <stop offset="70%" stopColor="#2a211c" />
              <stop offset="100%" stopColor="#14100e" />
            </radialGradient>
            <radialGradient id={ambient} cx="50%" cy="35%" r="50%">
              <stop offset="0%" stopColor="rgba(255,240,220,0.12)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <filter
              id={`enver-soft-${uid}`}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.4" />
            </filter>
          </defs>

          <path
            d="M18 102 C18 94 28 88 38 86 L38 118 L62 118 L62 86 C72 88 82 94 82 102 L84 118 L16 118 Z"
            fill={av.skinDeep}
          />
          <path
            d="M28 96 L50 104 L72 96 L72 118 L28 118 Z"
            fill="#0e0c0b"
            opacity={0.92}
          />
          <path
            d="M38 96 L50 102 L62 96"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.6"
            fill="none"
          />

          <motion.g
            style={{ transformOrigin: "50px 56px", transformBox: "fill-box" }}
            animate={
              reducedMotion
                ? undefined
                : {
                    rotate: [
                      -headTiltAmp,
                      headTiltAmp * 0.85,
                      -headTiltAmp * 0.55,
                      headTiltAmp,
                    ],
                  }
            }
            transition={{
              duration: 13.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <ellipse cx="50" cy="56" rx="29" ry="33" fill={`url(#${skinRad})`} />

            <ellipse
              cx="44"
              cy="46"
              rx="14"
              ry="10"
              fill={av.highlight}
              opacity={0.9}
            />
            <ellipse
              cx="58"
              cy="52"
              rx="9"
              ry="7"
              fill="rgba(255,255,255,0.06)"
            />

            <path
              d="M22 54 C20 28 36 12 50 12 C64 12 80 28 78 54 C76 32 66 22 50 22 C34 22 24 32 22 54"
              fill={`url(#${hair})`}
            />
            <path
              d="M24 48 C26 38 38 26 50 26 C62 26 74 38 76 48"
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.8"
            />

            <path
              d="M32 72 Q50 80 68 72"
              fill="none"
              stroke="#000"
              strokeOpacity={0.07}
              strokeWidth="2"
              strokeLinecap="round"
            />

            <g opacity={stubbleOp}>
              {STUBBLE.map(([x, y, r], i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={r}
                  fill={av.stubbleColor}
                  opacity={0.85}
                />
              ))}
            </g>
            <ellipse
              cx="50"
              cy="76"
              rx="18"
              ry="5"
              fill={av.stubbleColor}
              opacity={0.06}
              filter={`url(#enver-soft-${uid})`}
            />

            <g
              className={cn("enver-assistant-blink", rm)}
              style={
                {
                  "--enver-blink-dur": blinkDur,
                  "--enver-blink-delay": blinkDelay,
                } as CSSProperties
              }
            >
              <g className="enver-assistant-eye-lid">
                <ellipse
                  cx="37"
                  cy="51"
                  rx={5.2 * eyeMul}
                  ry={4.2 * eyeMul}
                  fill="#f0e8df"
                />
                <ellipse
                  cx="37"
                  cy="51"
                  rx={3.6 * eyeMul}
                  ry={3.4 * eyeMul}
                  fill={`url(#${iris})`}
                />
                <motion.g
                  style={
                    {
                      transformOrigin: "37px 51px",
                      transformBox: "fill-box",
                    } as CSSProperties
                  }
                  animate={
                    pupilDriftOn
                      ? {
                          x: [
                            0,
                            0.22 * pupilAmp * pupilWarnFactor,
                            -0.14 * pupilAmp * pupilWarnFactor,
                            0,
                          ],
                          y: [
                            0,
                            -0.1 * pupilAmp * pupilWarnFactor,
                            0.07 * pupilAmp * pupilWarnFactor,
                            0,
                          ],
                        }
                      : { x: 0, y: 0 }
                  }
                  transition={{
                    duration: 7.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <circle cx="37" cy="51" r={1.85 * eyeMul} fill="#0d0b0a" />
                  <circle
                    cx="37.8"
                    cy="50.2"
                    r={0.55 * eyeMul}
                    fill="#fff"
                    opacity={0.55}
                  />
                </motion.g>
                <path
                  d="M32 48.5 Q37 47 42 48.5"
                  fill="none"
                  stroke="#1a1512"
                  strokeOpacity={0.2}
                  strokeWidth="0.9"
                  strokeLinecap="round"
                />
              </g>
              <g className="enver-assistant-eye-lid">
                <ellipse
                  cx="63"
                  cy="51"
                  rx={5.2 * eyeMul}
                  ry={4.2 * eyeMul}
                  fill="#f0e8df"
                />
                <ellipse
                  cx="63"
                  cy="51"
                  rx={3.6 * eyeMul}
                  ry={3.4 * eyeMul}
                  fill={`url(#${iris})`}
                />
                <motion.g
                  style={
                    {
                      transformOrigin: "63px 51px",
                      transformBox: "fill-box",
                    } as CSSProperties
                  }
                  animate={
                    pupilDriftOn
                      ? {
                          x: [
                            0,
                            -0.18 * pupilAmp * pupilWarnFactor,
                            0.16 * pupilAmp * pupilWarnFactor,
                            0,
                          ],
                          y: [
                            0,
                            0.09 * pupilAmp * pupilWarnFactor,
                            -0.08 * pupilAmp * pupilWarnFactor,
                            0,
                          ],
                        }
                      : { x: 0, y: 0 }
                  }
                  transition={{
                    duration: 8.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.35,
                  }}
                >
                  <circle cx="63" cy="51" r={1.85 * eyeMul} fill="#0d0b0a" />
                  <circle
                    cx="63.8"
                    cy="50.2"
                    r={0.55 * eyeMul}
                    fill="#fff"
                    opacity={0.55}
                  />
                </motion.g>
                <path
                  d="M58 48.5 Q63 47 68 48.5"
                  fill="none"
                  stroke="#1a1512"
                  strokeOpacity={0.2}
                  strokeWidth="0.9"
                  strokeLinecap="round"
                />
              </g>
            </g>

            <motion.g
              animate={{ y: browShift }}
              transition={{ type: "spring", stiffness: 140, damping: 20 }}
            >
              <path
                d="M31 45.5 Q37 43.5 42.5 45"
                stroke="#1a1410"
                strokeWidth="0.95"
                fill="none"
                strokeLinecap="round"
                opacity={0.42}
              />
              <path
                d="M57.5 45 Q63 43.5 69 45.5"
                stroke="#1a1410"
                strokeWidth="0.95"
                fill="none"
                strokeLinecap="round"
                opacity={0.42}
              />
            </motion.g>

            <ellipse cx="50" cy="60" rx="3.5" ry="5" fill="#000" opacity={0.04} />

            <motion.g
              style={
                {
                  transformOrigin: "50px 72px",
                  transformBox: "fill-box",
                } as CSSProperties
              }
              animate={
                reducedMotion
                  ? { scaleY: 1 }
                  : voiceActive
                    ? {
                        scaleY: [1, mouthSpeakAmp, 1, mouthSpeakAmp * 0.996, 1],
                      }
                    : { scaleY: 1 }
              }
              transition={
                voiceActive && !reducedMotion
                  ? { duration: 1.65, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.2 }
              }
            >
              <path
                d="M40 69.5 Q50 75.8 60 69.5"
                stroke={av.smileStroke}
                strokeWidth={smileW}
                fill="none"
                strokeLinecap="round"
                opacity={0.9}
              />
            </motion.g>

            <ellipse cx="50" cy="38" rx="26" ry="16" fill={`url(#${ambient})`} />
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
}
