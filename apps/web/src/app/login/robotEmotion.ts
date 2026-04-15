export type RobotEmotion =
  | "happy"
  | "thinking"
  | "loading"
  | "surprised"
  | "wink"
  | "sad";

export const ROBOT_EMOTION_EVENT = "enver-robot-emotion";

export function emitRobotEmotion(emotion: RobotEmotion) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(ROBOT_EMOTION_EVENT, {
      detail: { emotion }
    })
  );
}
