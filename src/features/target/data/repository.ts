import {
  DEMO_ADS,
  DEMO_AD_LEADS,
  DEMO_ATTRIBUTION,
  DEMO_CAMPAIGNS,
  DEMO_CREATIVES,
  DEMO_ADSETS,
  DEMO_SPEND_BY_DAY,
} from "../demo-data";
import type { TargetOverviewKpi, TargetWorkspaceSnapshot } from "../types";

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

/**
 * Знімок даних для модуля «Таргет».
 * Живі таблиці Meta у БД підключаться окремим міграційним кроком; зараз — демо-набір.
 */
export async function getTargetWorkspaceSnapshot(): Promise<TargetWorkspaceSnapshot> {
  return buildDemoSnapshot();
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
