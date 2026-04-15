import type { ReactNode } from "react";
import type { Metadata } from "next";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { NewAssistantWidget } from "../../components/layout/NewAssistantWidget";
import { requireSessionForAppLayout } from "../../lib/authz/page-auth";

export const metadata: Metadata = {
  title: "ENVER CRM · Операційний простір",
};

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireSessionForAppLayout();

  return (
    <>
      <DashboardShell>{children}</DashboardShell>
      <NewAssistantWidget />
    </>
  );
}

