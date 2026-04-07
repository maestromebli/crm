import type {
  BehaviorEngineSnapshot,
  DailyOperatingSnapshot,
  NextActionItem,
} from "../crm-dashboard/executive-types";

type BuildDailySnapshotInput = {
  nextActions: NextActionItem[];
  behavior: BehaviorEngineSnapshot;
  overdueTasks: number;
  meetingsToday: number;
  staleLeads: number;
  delayedProduction: number;
};

export function buildDailyOperatingSnapshot({
  nextActions,
  behavior,
  overdueTasks,
  meetingsToday,
  staleLeads,
  delayedProduction,
}: BuildDailySnapshotInput): DailyOperatingSnapshot {
  return {
    priorities: nextActions.slice(0, 6),
    workload: {
      overdueTasks,
      meetingsToday,
      staleLeads,
      delayedProduction,
    },
    weakManagers: behavior.weakManagers.map((m) => ({
      userId: m.userId,
      name: m.name,
      score: m.score,
    })),
  };
}
