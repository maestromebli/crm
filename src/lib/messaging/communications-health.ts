import { prisma } from "../prisma";

const SETTINGS_ID = "default";
const KEY = "__communicationsHealth";
const POLICY_KEY = "__communicationsHealthPolicy";
const ALERTS_KEY = "__communicationsAlerts";

export type ChannelHealth = {
  lastWebhookAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  lastErrorAt?: string;
  lastError?: string;
  outboundSentCount?: number;
  outboundFailedCount?: number;
  deliveryFailedCount?: number;
};

type HealthStore = Record<string, Record<string, ChannelHealth>>;
type HealthPolicy = {
  deliveryFailAlertThreshold: number;
  outboundFailAlertThreshold: number;
};
export type CommunicationsAlert = {
  id: string;
  userId: string;
  channel: string;
  kind: "delivery_failed" | "outbound_failed";
  message: string;
  count: number;
  createdAt: string;
  readAt?: string;
};

async function readRoot(): Promise<Record<string, unknown>> {
  const row = await prisma.systemSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { communicationsJson: true },
  });
  if (!row?.communicationsJson || typeof row.communicationsJson !== "object") {
    return {};
  }
  return row.communicationsJson as Record<string, unknown>;
}

function parseStore(raw: unknown): HealthStore {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as HealthStore;
}

async function writeStore(store: HealthStore): Promise<void> {
  const root = await readRoot();
  await prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, communicationsJson: { ...root, [KEY]: store } as object },
    update: { communicationsJson: { ...root, [KEY]: store } as object },
  });
}

function parseAlerts(raw: unknown): CommunicationsAlert[] {
  if (!Array.isArray(raw)) return [];
  const parseKind = (
    value: unknown,
  ): "delivery_failed" | "outbound_failed" =>
    value === "delivery_failed" ? "delivery_failed" : "outbound_failed";
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x) => x as Record<string, unknown>)
    .map((x) => ({
      id: String(x.id ?? ""),
      userId: String(x.userId ?? ""),
      channel: String(x.channel ?? ""),
      kind: parseKind(x.kind),
      message: String(x.message ?? ""),
      count: Number(x.count ?? 0) || 0,
      createdAt: String(x.createdAt ?? new Date().toISOString()),
      readAt: typeof x.readAt === "string" ? x.readAt : undefined,
    }))
    .filter((x) => x.id && x.userId);
}

async function writeRoot(root: Record<string, unknown>): Promise<void> {
  await prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, communicationsJson: root as object },
    update: { communicationsJson: root as object },
  });
}

function shouldRaiseAlert(args: {
  userId: string;
  channel: string;
  kind: "delivery_failed" | "outbound_failed";
  count: number;
  threshold: number;
  alerts: CommunicationsAlert[];
}): boolean {
  if (args.count < args.threshold) return false;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentSame = args.alerts.find(
    (a) =>
      a.userId === args.userId &&
      a.channel === args.channel &&
      a.kind === args.kind &&
      new Date(a.createdAt).getTime() >= dayAgo,
  );
  return !recentSame;
}

function nextWith(
  current: ChannelHealth | undefined,
  patch: Partial<ChannelHealth>,
): ChannelHealth {
  return { ...(current ?? {}), ...patch };
}

export async function markChannelHealth(args: {
  userId: string;
  channel: string;
  type:
    | "webhook"
    | "inbound"
    | "outbound_sent"
    | "outbound_failed"
    | "delivery_failed"
    | "error";
  error?: string;
}): Promise<void> {
  const root = await readRoot();
  const store = parseStore(root[KEY]);
  const policy = parsePolicy(root[POLICY_KEY]);
  const alerts = parseAlerts(root[ALERTS_KEY]);
  const user = store[args.userId] ?? {};
  const ch = user[args.channel] ?? {};
  const now = new Date().toISOString();
  if (args.type === "webhook") {
    user[args.channel] = nextWith(ch, { lastWebhookAt: now });
  } else if (args.type === "inbound") {
    user[args.channel] = nextWith(ch, { lastInboundAt: now, lastWebhookAt: now });
  } else if (args.type === "outbound_sent") {
    user[args.channel] = nextWith(ch, {
      lastOutboundAt: now,
      outboundSentCount: (ch.outboundSentCount ?? 0) + 1,
    });
  } else if (args.type === "outbound_failed") {
    user[args.channel] = nextWith(ch, {
      lastOutboundAt: now,
      lastErrorAt: now,
      lastError: args.error ?? "outbound_failed",
      outboundFailedCount: (ch.outboundFailedCount ?? 0) + 1,
    });
    const next = user[args.channel]!;
    const failCount = next.outboundFailedCount ?? 0;
    if (
      shouldRaiseAlert({
        userId: args.userId,
        channel: args.channel,
        kind: "outbound_failed",
        count: failCount,
        threshold: policy.outboundFailAlertThreshold,
        alerts,
      })
    ) {
      alerts.unshift({
        id: `al:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        userId: args.userId,
        channel: args.channel,
        kind: "outbound_failed",
        count: failCount,
        message: `Outbound failures reached ${failCount} on ${args.channel}`,
        createdAt: now,
      });
    }
  } else if (args.type === "delivery_failed") {
    user[args.channel] = nextWith(ch, {
      lastErrorAt: now,
      lastError: args.error ?? "delivery_failed",
      deliveryFailedCount: (ch.deliveryFailedCount ?? 0) + 1,
    });
    const next = user[args.channel]!;
    const failCount = next.deliveryFailedCount ?? 0;
    if (
      shouldRaiseAlert({
        userId: args.userId,
        channel: args.channel,
        kind: "delivery_failed",
        count: failCount,
        threshold: policy.deliveryFailAlertThreshold,
        alerts,
      })
    ) {
      alerts.unshift({
        id: `al:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        userId: args.userId,
        channel: args.channel,
        kind: "delivery_failed",
        count: failCount,
        message: `Delivery failures reached ${failCount} on ${args.channel}`,
        createdAt: now,
      });
    }
  } else {
    user[args.channel] = nextWith(ch, {
      lastErrorAt: now,
      lastError: args.error ?? "error",
    });
  }
  store[args.userId] = user;
  root[KEY] = store;
  root[ALERTS_KEY] = alerts.slice(0, 400);
  await writeRoot(root);
}

export async function getCommunicationsHealth(): Promise<HealthStore> {
  return parseStore((await readRoot())[KEY]);
}

function parsePolicy(raw: unknown): HealthPolicy {
  const d: HealthPolicy = {
    deliveryFailAlertThreshold: 3,
    outboundFailAlertThreshold: 3,
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  const o = raw as Record<string, unknown>;
  const delivery = Number(o.deliveryFailAlertThreshold ?? d.deliveryFailAlertThreshold);
  const outbound = Number(o.outboundFailAlertThreshold ?? d.outboundFailAlertThreshold);
  return {
    deliveryFailAlertThreshold:
      Number.isFinite(delivery) && delivery > 0 ? Math.floor(delivery) : d.deliveryFailAlertThreshold,
    outboundFailAlertThreshold:
      Number.isFinite(outbound) && outbound > 0 ? Math.floor(outbound) : d.outboundFailAlertThreshold,
  };
}

export async function getCommunicationsHealthPolicy(): Promise<HealthPolicy> {
  const root = await readRoot();
  return parsePolicy(root[POLICY_KEY]);
}

export async function setCommunicationsHealthPolicy(
  patch: Partial<HealthPolicy>,
): Promise<HealthPolicy> {
  const root = await readRoot();
  const current = parsePolicy(root[POLICY_KEY]);
  const next = parsePolicy({
    ...current,
    ...patch,
  });
  await prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      communicationsJson: { ...root, [POLICY_KEY]: next } as object,
    },
    update: {
      communicationsJson: { ...root, [POLICY_KEY]: next } as object,
    },
  });
  return next;
}

export type WeeklyDigestRow = {
  userId: string;
  userLabel: string;
  channel: string;
  sent: number;
  outboundFailed: number;
  deliveryFailed: number;
  alert: boolean;
};

export function buildWeeklyDigest(args: {
  стан: HealthStore;
  policy: HealthPolicy;
  users: Array<{ id: string; name: string | null; email: string }>;
}): WeeklyDigestRow[] {
  const userLabel = new Map(
    args.users.map((u) => [u.id, u.name?.trim() || u.email]),
  );
  const rows: WeeklyDigestRow[] = [];
  for (const [uid, channels] of Object.entries(args.стан)) {
    for (const [channel, h] of Object.entries(channels)) {
      const sent = h.outboundSentCount ?? 0;
      const outboundFailed = h.outboundFailedCount ?? 0;
      const deliveryFailed = h.deliveryFailedCount ?? 0;
      if (sent + outboundFailed + deliveryFailed === 0) continue;
      const alert =
        outboundFailed >= args.policy.outboundFailAlertThreshold ||
        deliveryFailed >= args.policy.deliveryFailAlertThreshold;
      rows.push({
        userId: uid,
        userLabel: userLabel.get(uid) ?? uid,
        channel,
        sent,
        outboundFailed,
        deliveryFailed,
        alert,
      });
    }
  }
  rows.sort((a, b) => Number(b.alert) - Number(a.alert) || b.deliveryFailed - a.deliveryFailed || b.outboundFailed - a.outboundFailed);
  return rows;
}

export async function listCommunicationsAlerts(args: {
  userIds?: string[];
  unreadOnly?: boolean;
}): Promise<CommunicationsAlert[]> {
  const root = await readRoot();
  const alerts = parseAlerts(root[ALERTS_KEY]);
  const userSet = args.userIds?.length ? new Set(args.userIds) : null;
  return alerts.filter((a) => {
    if (userSet && !userSet.has(a.userId)) return false;
    if (args.unreadOnly && a.readAt) return false;
    return true;
  });
}

export async function acknowledgeCommunicationsAlert(args: {
  id: string;
  actorUserId: string;
  allowedUserIds?: string[];
}): Promise<boolean> {
  const root = await readRoot();
  const alerts = parseAlerts(root[ALERTS_KEY]);
  const allow = args.allowedUserIds?.length ? new Set(args.allowedUserIds) : null;
  let changed = false;
  const next = alerts.map((a) => {
    if (a.id !== args.id) return a;
    if (allow && !allow.has(a.userId)) return a;
    changed = true;
    return { ...a, readAt: a.readAt ?? new Date().toISOString() };
  });
  if (!changed) return false;
  root[ALERTS_KEY] = next;
  await writeRoot(root);
  return true;
}

export async function acknowledgeAllCommunicationsAlerts(args: {
  actorUserId: string;
  allowedUserIds?: string[];
  unreadOnly?: boolean;
}): Promise<number> {
  const root = await readRoot();
  const alerts = parseAlerts(root[ALERTS_KEY]);
  const allow = args.allowedUserIds?.length ? new Set(args.allowedUserIds) : null;
  const now = new Date().toISOString();
  let changed = 0;
  const next = alerts.map((a) => {
    if (allow && !allow.has(a.userId)) return a;
    if (args.unreadOnly && a.readAt) return a;
    if (a.readAt) return a;
    changed += 1;
    return { ...a, readAt: now };
  });
  if (changed === 0) return 0;
  root[ALERTS_KEY] = next;
  await writeRoot(root);
  return changed;
}
