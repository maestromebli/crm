"use client";

import type { Session } from "next-auth";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

const INACTIVITY_TIMEOUT_MS =
  readPositiveIntEnv("NEXT_PUBLIC_AUTH_INACTIVITY_TIMEOUT_SECONDS", 60 * 60) *
  1000;
const DAILY_REAUTH_MS =
  readPositiveIntEnv("NEXT_PUBLIC_AUTH_DAILY_REAUTH_SECONDS", 24 * 60 * 60) *
  1000;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const ACTIVITY_STORAGE_KEY = "auth:last-activity-at";

function AuthSessionGuard() {
  const { data: session, status, update } = useSession();
  const lastHeartbeatRef = useRef(0);
  const signOutTriggeredRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") {
      signOutTriggeredRef.current = false;
      return;
    }

    const authenticatedAtMs =
      typeof session?.user?.authenticatedAt === "number"
        ? session.user.authenticatedAt * 1000
        : Date.now();

    const triggerSignOut = (reason: "idle" | "daily") => {
      if (signOutTriggeredRef.current) return;
      signOutTriggeredRef.current = true;
      void signOut({ callbackUrl: `/login?reason=${reason}` });
    };

    const getLastActivityMs = () => {
      const raw = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? value : null;
    };

    const sendHeartbeat = (atMs: number) => {
      if (atMs - lastHeartbeatRef.current < HEARTBEAT_INTERVAL_MS) return;
      lastHeartbeatRef.current = atMs;
      void update({ activityPingAt: new Date(atMs).toISOString() });
    };

    const markActivity = () => {
      const now = Date.now();
      window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
      sendHeartbeat(now);
    };

    const checkSessionPolicy = () => {
      const now = Date.now();
      const lastActivityMs = getLastActivityMs() ?? now;
      if (now - lastActivityMs > INACTIVITY_TIMEOUT_MS) {
        triggerSignOut("idle");
        return;
      }
      if (now - authenticatedAtMs > DAILY_REAUTH_MS) {
        triggerSignOut("daily");
      }
    };

    const existingActivityMs = getLastActivityMs();
    // Reset stale activity marker when a fresh session starts.
    // Otherwise a timestamp from a previous session can trigger instant idle sign-out.
    if (!existingActivityMs || existingActivityMs < authenticatedAtMs) {
      const seedMs = Math.max(authenticatedAtMs, Date.now());
      window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(seedMs));
      sendHeartbeat(seedMs);
    } else {
      sendHeartbeat(existingActivityMs);
    }

    checkSessionPolicy();
    if (signOutTriggeredRef.current) return;

    const activityEvents: Array<keyof WindowEventMap> = [
      "click",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
      "focus",
    ];
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        markActivity();
        checkSessionPolicy();
      }
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", onVisible);

    const timer = window.setInterval(() => {
      checkSessionPolicy();
      if (document.visibilityState === "visible") {
        sendHeartbeat(Date.now());
      }
    }, 60 * 1000);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [session?.user?.authenticatedAt, status, update]);

  return null;
}

export function Providers({
  children,
  session,
}: {
  children: ReactNode;
  /** Початкова сесія з сервера — менше зайвих запитів / CLIENT_FETCH_ERROR у dev */
  session?: Session | null;
}) {
  return (
    <SessionProvider
      session={session ?? null}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <AuthSessionGuard />
      <TooltipProvider delayDuration={280} skipDelayDuration={100}>
        {children}
      </TooltipProvider>
    </SessionProvider>
  );
}
