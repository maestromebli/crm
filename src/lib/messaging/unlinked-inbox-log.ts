import { prisma } from "../prisma";

const SETTINGS_ID = "default";
const STORE_KEY = "__inboxUnlinked";
const MAX_ITEMS = 300;

export type UnlinkedInboundItem = {
  id: string;
  channel: "telegram" | "whatsapp" | "viber" | "instagram";
  text: string;
  externalId: string;
  from: string;
  ownerUserId?: string | null;
  receivedAt: string;
};

function parseItems(raw: unknown): UnlinkedInboundItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x) => x as Record<string, unknown>)
    .map((x) => ({
      id: String(x.id ?? ""),
      channel: (x.channel === "telegram" ||
      x.channel === "whatsapp" ||
      x.channel === "viber" ||
      x.channel === "instagram"
        ? x.channel
        : "telegram") as UnlinkedInboundItem["channel"],
      text: String(x.text ?? ""),
      externalId: String(x.externalId ?? ""),
      from: String(x.from ?? ""),
      ownerUserId:
        typeof x.ownerUserId === "string" ? x.ownerUserId : null,
      receivedAt: String(x.receivedAt ?? new Date().toISOString()),
    }))
    .filter((x) => x.id && x.externalId && x.text);
}

export async function appendUnlinkedInbound(
  item: Omit<UnlinkedInboundItem, "id" | "receivedAt"> & {
    receivedAt?: string;
  },
): Promise<void> {
  const row = await prisma.systemSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { communicationsJson: true },
  });
  const obj =
    row?.communicationsJson && typeof row.communicationsJson === "object"
      ? (row.communicationsJson as Record<string, unknown>)
      : {};
  const current = parseItems(obj[STORE_KEY]);
  const nextItem: UnlinkedInboundItem = {
    id: `${item.channel}:${item.externalId}`,
    channel: item.channel,
    text: item.text,
    externalId: item.externalId,
    from: item.from,
      ownerUserId: item.ownerUserId ?? null,
    receivedAt: item.receivedAt ?? new Date().toISOString(),
  };
  const merged = [nextItem, ...current.filter((x) => x.id !== nextItem.id)].slice(
    0,
    MAX_ITEMS,
  );

  await prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      communicationsJson: {
        ...obj,
        [STORE_KEY]: merged,
      } as object,
    },
    update: {
      communicationsJson: {
        ...obj,
        [STORE_KEY]: merged,
      } as object,
    },
  });
}

export async function getUnlinkedInbound(
  limit = 100,
): Promise<UnlinkedInboundItem[]> {
  const row = await prisma.systemSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { communicationsJson: true },
  });
  const obj =
    row?.communicationsJson && typeof row.communicationsJson === "object"
      ? (row.communicationsJson as Record<string, unknown>)
      : {};
  return parseItems(obj[STORE_KEY]).slice(0, Math.max(1, Math.min(limit, 300)));
}
