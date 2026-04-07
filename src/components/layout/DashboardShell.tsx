"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  AssistantFloatingHost,
  AssistantPageEntityProvider,
} from "../../features/ai-assistant";
import { AiV2CockpitRail } from "../../features/ai-v2";
import { LeadWorkspaceQueryProvider } from "../../features/leads/lead-workspace-query-provider";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

const SIDEBAR_COMPACT_KEY = "crm.sidebar.compact";

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [sidebarCompact, setSidebarCompact] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- гідратація з localStorage після mount */
    try {
      const raw = window.localStorage.getItem(SIDEBAR_COMPACT_KEY);
      setSidebarCompact(raw === "1");
    } catch {
      setSidebarCompact(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const toggleSidebar = () => {
    setSidebarCompact((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COMPACT_KEY, next ? "1" : "0");
      } catch {
        // ignore storage write failures
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen items-stretch bg-[var(--enver-bg)]">
      <AppSidebar compact={sidebarCompact} />
      <div className="flex min-h-screen flex-1 flex-col">
        <AppHeader
          sidebarCompact={sidebarCompact}
          onToggleSidebar={toggleSidebar}
        />
        <AssistantPageEntityProvider>
          <LeadWorkspaceQueryProvider>
          <motion.main
            key={pathname ?? "/"}
            className="flex flex-1 flex-col"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.24,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            {children}
          </motion.main>
          <AiV2CockpitRail />
          <AssistantFloatingHost />
          </LeadWorkspaceQueryProvider>
        </AssistantPageEntityProvider>
      </div>
    </div>
  );
}
