import { prisma } from "../../../lib/prisma";
import {
  DEMO_ADS,
  DEMO_AD_LEADS,
  DEMO_ATTRIBUTION,
  DEMO_CAMPAIGNS,
  DEMO_CREATIVES,
  DEMO_ADSETS,
  DEMO_SPEND_BY_DAY,
} from "../demo-data";
import type {
  DemoCampaign,
  DemoSpendDay,
  TargetOverviewKpi,
  TargetSyncStatus,
  TargetWorkspaceSnapshot,
} from "../types";
import type { TargetMetaSyncState, TargetAdCampaign, TargetAdSpendDaily } from "@prisma/client";

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

const DEMO_PREV_SPEND_UAH = 15800;
const DEMO_PREV_LEADS = 35;

function buildKpiFromDemoArrays(): TargetOverviewKpi {
  const spend7d = DEMO_SPEND_BY_DAY.reduce((s, d) => s + d.spendUah, 0);
  const leads7d = DEMO_SPEND_BY_DAY.reduce((s, d) => s + d.leads, 0);
  const cpl = leads7d > 0 ? Math.round(spend7d / leads7d) : null;
  const activeCampaigns = DEMO_CAMPAIGNS.filter((c) => c.status === "ACTIVE").length;

  return {
    spend7dUah: spend7d,
    leads7d,
    cplUah: cpl,
    activeCampaigns,
    spendPrev7dUah: DEMO_PREV_SPEND_UAH,
    leadsPrev7d: DEMO_PREV_LEADS,
    spendDeltaPct: pctDelta(spend7d, DEMO_PREV_SPEND_UAH),
    leadsDeltaPct: pctDelta(leads7d, DEMO_PREV_LEADS),
  };
}

function buildKpiHybrid(
  spendDays: DemoSpendDay[],
  campaigns: DemoCampaign[],
  baseline: { spendPrev: number; leadsPrev: number },
): TargetOverviewKpi {
  const spend7d = spendDays.reduce((s, d) => s + d.spendUah, 0);
  const leads7d = spendDays.reduce((s, d) => s + d.leads, 0);
  const cpl = leads7d > 0 ? Math.round(spend7d / leads7d) : null;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;

  return {
    spend7dUah: spend7d,
    leads7d,
    cplUah: cpl,
    activeCampaigns,
    spendPrev7dUah: baseline.spendPrev,
    leadsPrev7d: baseline.leadsPrev,
    spendDeltaPct: pctDelta(spend7d, baseline.spendPrev),
    leadsDeltaPct: pctDelta(leads7d, baseline.leadsPrev),
  };
}

function mapSyncFromDb(row: TargetMetaSyncState | null): TargetSyncStatus {
  if (!row) {
    return {
      marketingApi: {
        state: "disconnected",
        lastSyncAt: null,
        lastError: null,
      },
      leadWebhook: {
        lastDeliveryAt: null,
        lastError: null,
        deliveries24h: 0,
      },
    };
  }
  const apiState =
    row.marketingApiState === "connected"
      ? "connected"
      : row.marketingApiState === "error"
        ? "error"
        : "disconnected";

  return {
    marketingApi: {
      state: apiState,
      lastSyncAt: row.marketingApiLastSyncAt?.toISOString() ?? null,
      lastError: row.marketingApiLastError,
    },
    leadWebhook: {
      lastDeliveryAt: row.leadWebhookLastDeliveryAt?.toISOString() ?? null,
      lastError: row.leadWebhookLastError,
      deliveries24h: row.leadWebhookDeliveries24h,
    },
  };
}

const CHANNELS: DemoCampaign["channel"][] = ["Instagram", "Facebook", "Обидва"];

function mapCampaignRow(c: TargetAdCampaign): DemoCampaign {
  const st = c.status as DemoCampaign["status"];
  const safeStatus: DemoCampaign["status"] =
    st === "ACTIVE" || st === "PAUSED" || st === "ARCHIVED" ? st : "ACTIVE";
  const ch = CHANNELS.includes(c.channel as DemoCampaign["channel"])
    ? (c.channel as DemoCampaign["channel"])
    : "Обидва";
  return {
    id: c.id,
    name: c.name,
    status: safeStatus,
    objective: c.objective,
    budgetDailyUah: c.budgetDailyUah,
    spendUah: c.spendUah,
    leads: c.leads,
    cplUah: c.cplUah,
    channel: ch,
  };
}

function mapSpendRows(rows: TargetAdSpendDaily[]): DemoSpendDay[] {
  return [...rows]
    .sort((a, b) => a.day.getTime() - b.day.getTime())
    .map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      spendUah: r.spendUah,
      leads: r.leads,
    }));
}

function resolveBaseline(
  spendSorted: DemoSpendDay[],
  sync: TargetMetaSyncState | null,
): { spendPrev: number; leadsPrev: number } {
  if (spendSorted.length >= 14) {
    const prev7 = spendSorted.slice(-14, -7);
    return {
      spendPrev: prev7.reduce((s, d) => s + d.spendUah, 0),
      leadsPrev: prev7.reduce((s, d) => s + d.leads, 0),
    };
  }
  if (
    sync?.kpiBaselineSpendUah != null &&
    sync?.kpiBaselineLeads != null
  ) {
    return {
      spendPrev: sync.kpiBaselineSpendUah,
      leadsPrev: sync.kpiBaselineLeads,
    };
  }
  return { spendPrev: DEMO_PREV_SPEND_UAH, leadsPrev: DEMO_PREV_LEADS };
}

/**
 * Знімок даних для модуля «Таргет».
 * Якщо в БД є кампанії або денна статистика — використовуємо їх; інакше — демо-набір.
 */
export async function getTargetWorkspaceSnapshot(): Promise<TargetWorkspaceSnapshot> {
  try {
    const [syncRow, dbCampaigns, dbSpend] = await Promise.all([
      prisma.targetMetaSyncState.findUnique({ where: { id: "default" } }),
      prisma.targetAdCampaign.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.targetAdSpendDaily.findMany({ orderBy: { day: "asc" } }),
    ]);

    const hasLiveData = dbCampaigns.length > 0 || dbSpend.length > 0;
    const campaigns = hasLiveData && dbCampaigns.length > 0
      ? dbCampaigns.map(mapCampaignRow)
      : DEMO_CAMPAIGNS;
    const spendByDay =
      hasLiveData && dbSpend.length > 0 ? mapSpendRows(dbSpend) : DEMO_SPEND_BY_DAY;

    let kpi: TargetOverviewKpi;
    if (hasLiveData && dbSpend.length > 0) {
      const sorted = mapSpendRows(dbSpend);
      const n = Math.min(7, sorted.length);
      const window = sorted.slice(-n);
      kpi = buildKpiHybrid(window, campaigns, resolveBaseline(sorted, syncRow));
    } else if (hasLiveData && dbCampaigns.length > 0 && dbSpend.length === 0) {
      const totalSpend = campaigns.reduce((s, c) => s + c.spendUah, 0);
      const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
      const cpl = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : null;
      const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE").length;
      const base = resolveBaseline([], syncRow);
      kpi = {
        spend7dUah: totalSpend,
        leads7d: totalLeads,
        cplUah: cpl,
        activeCampaigns,
        spendPrev7dUah: base.spendPrev,
        leadsPrev7d: base.leadsPrev,
        spendDeltaPct: pctDelta(totalSpend, base.spendPrev),
        leadsDeltaPct: pctDelta(totalLeads, base.leadsPrev),
      };
    } else {
      kpi = buildKpiFromDemoArrays();
    }

    const sync = mapSyncFromDb(syncRow);

    return {
      source: hasLiveData ? "live" : "demo",
      generatedAt: new Date().toISOString(),
      sync,
      kpi,
      campaigns,
      adsets: DEMO_ADSETS,
      ads: DEMO_ADS,
      creatives: DEMO_CREATIVES,
      spendByDay,
      adLeads: DEMO_AD_LEADS,
      attribution: DEMO_ATTRIBUTION,
    };
  } catch {
    return buildDemoSnapshot();
  }
}

function buildDemoSnapshot(): TargetWorkspaceSnapshot {
  return {
    source: "demo",
    generatedAt: new Date().toISOString(),
    sync: {
      marketingApi: {
        state: "disconnected",
        lastSyncAt: null,
        lastError: null,
      },
      leadWebhook: {
        lastDeliveryAt: null,
        lastError: null,
        deliveries24h: 0,
      },
    },
    kpi: buildKpiFromDemoArrays(),
    campaigns: DEMO_CAMPAIGNS,
    adsets: DEMO_ADSETS,
    ads: DEMO_ADS,
    creatives: DEMO_CREATIVES,
    spendByDay: DEMO_SPEND_BY_DAY,
    adLeads: DEMO_AD_LEADS,
    attribution: DEMO_ATTRIBUTION,
  };
}
