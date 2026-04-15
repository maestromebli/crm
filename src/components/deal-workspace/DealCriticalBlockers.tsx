"use client";

import type { DealCriticalBlocker } from "../../features/deal-workspace/deal-view-selectors";
import { DealBlockers } from "./DealBlockers";

export function DealCriticalBlockers({
  blockers,
  onOpenBlocker,
}: {
  blockers: DealCriticalBlocker[];
  onOpenBlocker: (index: number) => void;
}) {
  return <DealBlockers blockers={blockers} onOpenBlocker={onOpenBlocker} />;
}
