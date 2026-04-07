"use client";

import { Suspense } from "react";
import { LeadTasksTabClient } from "../LeadTasksTabClient";

type LeadTasksProps = {
  leadId: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
};

export function LeadTasks({
  leadId,
  canView,
  canCreate,
  canUpdate,
}: LeadTasksProps) {
  return (
    <Suspense
      fallback={<p className="text-sm text-slate-500">Завантаження задач…</p>}
    >
      <LeadTasksTabClient
        leadId={leadId}
        canView={canView}
        canCreate={canCreate}
        canUpdate={canUpdate}
      />
    </Suspense>
  );
}
