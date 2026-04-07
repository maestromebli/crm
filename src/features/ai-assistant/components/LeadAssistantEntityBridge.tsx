"use client";

import { useEffect, type ReactNode } from "react";
import type { LeadDetailRow } from "../../../features/leads/queries";
import { useAssistantPageEntitySetter } from "../context/AssistantPageEntityContext";
import { useLeadTasksOverdueForAssistant } from "../hooks/useLeadTasksOverdueForAssistant";
import { buildLeadPageEntitySnapshot } from "../utils/buildAssistantPageEntitySnapshot";

type Props = {
  lead: LeadDetailRow;
  children: ReactNode;
};

/**
 * Підписує картку ліда на глобальний контекст AI-помічника (назва, стадія, КП, «застій»).
 */
export function LeadAssistantEntityBridge({ lead, children }: Props) {
  const setEntity = useAssistantPageEntitySetter();
  const overdueOpenTasks = useLeadTasksOverdueForAssistant(lead.id);

  useEffect(() => {
    setEntity(
      buildLeadPageEntitySnapshot(lead, { overdueOpenTasks: overdueOpenTasks }),
    );
    return () => {
      setEntity(null);
    };
  }, [lead, setEntity, overdueOpenTasks]);

  return <>{children}</>;
}
