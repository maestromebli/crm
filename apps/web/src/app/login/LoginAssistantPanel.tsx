"use client";

import { useEffect, useState } from "react";
import { RobotAssistantCanvas } from "./RobotAssistantCanvas";
import { ROBOT_EMOTION_EVENT, type RobotEmotion } from "./robotEmotion";

export function LoginAssistantPanel() {
  const [emotion, setEmotion] = useState<RobotEmotion>("happy");

  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ emotion?: RobotEmotion }>;
      const nextEmotion = customEvent.detail?.emotion;
      if (!nextEmotion) return;
      setEmotion(nextEmotion);
    };

    window.addEventListener(ROBOT_EMOTION_EVENT, listener as EventListener);
    return () => {
      window.removeEventListener(ROBOT_EMOTION_EVENT, listener as EventListener);
    };
  }, []);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-8 py-8 text-slate-50 shadow-xl">
      <div className="absolute -left-32 top-10 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/70 ring-1 ring-slate-700/80">
          <span className="text-sm font-semibold tracking-tight">EN</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Enver CRM
          </span>
          <span className="text-sm text-slate-200">
            Корпусні меблі · проекти · сервіс
          </span>
        </div>
        <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-200">
          Assistant PRO
        </span>
      </div>

      <div className="relative mt-8 flex-1">
        <RobotAssistantCanvas emotion={emotion} />
      </div>

      <div className="relative mt-6 flex items-center gap-3 text-xs text-slate-400">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
        <span>Живий ассистент відповідає на події форми входу.</span>
      </div>
    </div>
  );
}
