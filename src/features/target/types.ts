export type TargetCampaignStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

export type DemoCampaign = {
  id: string;
  name: string;
  status: TargetCampaignStatus;
  objective: string;
  budgetDailyUah: number;
  spendUah: number;
  leads: number;
  cplUah: number | null;
  channel: "Instagram" | "Facebook" | "Обидва";
};

export type DemoAdSet = {
  id: string;
  campaignName: string;
  name: string;
  status: TargetCampaignStatus;
  spendUah: number;
  impressions: number;
  clicks: number;
  leads: number;
};

export type DemoAdRow = {
  id: string;
  campaignName: string;
  adSetName: string;
  headline: string;
  ctr: number;
  cpcUah: number;
  spendUah: number;
  leads: number;
};

export type DemoCreative = {
  id: string;
  kind: "image" | "video" | "carousel";
  title: string;
  campaignName: string;
  status: "testing" | "winner" | "paused";
};

export type DemoSpendDay = {
  day: string;
  spendUah: number;
  leads: number;
};

export type DemoAdLead = {
  id: string;
  name: string;
  phone: string;
  campaignName: string;
  formName: string;
  receivedAt: string;
  crmLeadTitle: string;
};

export type DemoAttributionRow = {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  leads: number;
  deals: number;
};

/** Стан інтеграцій (демо або з БД після підключення). */
export type TargetSyncStatus = {
  marketingApi: {
    state: "disconnected" | "connected" | "error";
    lastSyncAt: string | null;
    lastError: string | null;
  };
  leadWebhook: {
    lastDeliveryAt: string | null;
    lastError: string | null;
    deliveries24h: number;
  };
};

export type TargetOverviewKpi = {
  spend7dUah: number;
  leads7d: number;
  cplUah: number | null;
  activeCampaigns: number;
  spendPrev7dUah: number;
  leadsPrev7d: number;
  spendDeltaPct: number;
  leadsDeltaPct: number;
};

export type TargetDataSource = "demo" | "live";

export type TargetWorkspaceSnapshot = {
  source: TargetDataSource;
  generatedAt: string;
  sync: TargetSyncStatus;
  kpi: TargetOverviewKpi;
  campaigns: DemoCampaign[];
  adsets: DemoAdSet[];
  ads: DemoAdRow[];
  creatives: DemoCreative[];
  spendByDay: DemoSpendDay[];
  adLeads: DemoAdLead[];
  attribution: DemoAttributionRow[];
};
