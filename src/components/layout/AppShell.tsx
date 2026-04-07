import type React from "react";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-[var(--enver-bg)] text-[var(--enver-text)]">
      <AppSidebar />

      <div className="flex min-h-screen flex-1 flex-col md:pl-80">
        <AppTopbar />
        <div className="flex-1 px-3 py-3 md:px-6 md:py-4">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </div>
    </div>
  );
}

