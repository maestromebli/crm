"use client";

import type { Session } from "next-auth";
import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";

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
      session={session ?? undefined}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <TooltipProvider delayDuration={280} skipDelayDuration={100}>
        {children}
      </TooltipProvider>
    </SessionProvider>
  );
}
