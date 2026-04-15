"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  AssistantPageEntityProvider,
} from "../../features/ai-assistant";
import { AiV2CockpitRail } from "../../features/ai-v2";
import { LeadWorkspaceQueryProvider } from "../../features/leads/lead-workspace-query-provider";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

const isDashboardPath = (pathname: string | null): boolean =>
  pathname === "/crm/dashboard" || pathname?.startsWith("/crm/dashboard/") === true;

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [animationsReady, setAnimationsReady] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(
    () => !isDashboardPath(pathname),
  );
  const isDashboardRef = useRef(isDashboardPath(pathname));
  const shouldAnimate = animationsReady && !reduceMotion;

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimationsReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const nowDashboard = isDashboardPath(pathname);
    if (nowDashboard !== isDashboardRef.current) {
      // При зміні секції повертаємо дефолт для відповідного маршруту.
      setSidebarCompact(!nowDashboard);
      isDashboardRef.current = nowDashboard;
    }
  }, [pathname]);

  const toggleSidebar = () => {
    setSidebarCompact((prev) => !prev);
  };

  return (
    <div className="relative flex min-h-screen items-stretch bg-[var(--enver-bg)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.08),transparent_30%)]" />
      <AppSidebar compact={sidebarCompact} />
      <div className="relative flex min-h-screen flex-1 flex-col">
        <AppHeader
          sidebarCompact={sidebarCompact}
          onToggleSidebar={toggleSidebar}
        />
        <AssistantPageEntityProvider>
          <LeadWorkspaceQueryProvider>
          <motion.main
            key={pathname ?? "/"}
            className="enver-readable flex flex-1 flex-col"
            initial={shouldAnimate ? { opacity: 0, y: 4 } : false}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
            transition={{
              duration: 0.16,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <div className="enver-alert-band mx-3 mt-3 flex items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold tracking-[0.08em] md:mx-6">
              <span>PRODUCTION COMMAND CENTER</span>
              <span className="hidden text-[var(--enver-text-muted)] md:inline">
                live operations mode
              </span>
            </div>
            {children}
          </motion.main>
          <AiV2CockpitRail />
          </LeadWorkspaceQueryProvider>
        </AssistantPageEntityProvider>
      </div>
    </div>
  );
}
