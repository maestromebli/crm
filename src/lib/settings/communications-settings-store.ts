import { prisma } from "../prisma";
import {
  defaultCommunicationsConfig,
  mergeCommunicationsPatch,
  parseCommunicationsJson,
  toSafeCommunicationsDto,
  type CommunicationsIntegrationsConfig,
  type CommunicationsIntegrationsSafe,
} from "./communications-config";

const SETTINGS_ID = "default";
const USER_COMMUNICATIONS_KEY = "__userCommunications";

async function getSettingsRawJson(): Promise<Record<string, unknown>> {
  const row = await prisma.systemSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { communicationsJson: true },
  });
  if (!row?.communicationsJson || typeof row.communicationsJson !== "object") {
    return {};
  }
  return row.communicationsJson as Record<string, unknown>;
}

export async function getCommunicationsConfig(): Promise<CommunicationsIntegrationsConfig> {
  const raw = await getSettingsRawJson();
  return parseCommunicationsJson(raw);
}

export async function getCommunicationsConfigSafe(): Promise<CommunicationsIntegrationsSafe> {
  const c = await getCommunicationsConfig();
  return toSafeCommunicationsDto(c);
}

export async function upsertCommunicationsConfig(
  patch: Partial<CommunicationsIntegrationsConfig>,
  userId: string,
): Promise<CommunicationsIntegrationsConfig> {
  const current = await getCommunicationsConfig();
  const next = mergeCommunicationsPatch(current, patch);
  const raw = await getSettingsRawJson();
  const userMapRaw = raw[USER_COMMUNICATIONS_KEY];
  await prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      communicationsJson: {
        ...(next as unknown as Record<string, unknown>),
        ...(userMapRaw ? { [USER_COMMUNICATIONS_KEY]: userMapRaw } : {}),
      } as object,
      updatedById: userId,
    },
    update: {
      communicationsJson: {
        ...(next as unknown as Record<string, unknown>),
        ...(userMapRaw ? { [USER_COMMUNICATIONS_KEY]: userMapRaw } : {}),
      } as object,
      updatedById: userId,
    },
  });
  return next;
}

function readUserMap(
  root: Record<string, unknown>,
): Record<string, CommunicationsIntegrationsConfig> {
  const raw = root[USER_COMMUNICATIONS_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, CommunicationsIntegrationsConfig> = {};
  for (const [userId, value] of Object.entries(raw as Record<string, unknown>)) {
    out[userId] = parseCommunicationsJson(value);
  }
  return out;
}

function readUserMapRaw(root: Record<string, unknown>): Record<string, unknown> {
  const raw = root[USER_COMMUNICATIONS_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

async function writeUserMap(
  userMap: Record<string, CommunicationsIntegrationsConfig>,
  userId: string,
): Promise<void> {
  const root = await getSettingsRawJson();
  await prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      communicationsJson: {
        ...root,
        [USER_COMMUNICATIONS_KEY]: userMap,
      } as object,
      updatedById: userId,
    },
    update: {
      communicationsJson: {
        ...root,
        [USER_COMMUNICATIONS_KEY]: userMap,
      } as object,
      updatedById: userId,
    },
  });
}

export async function getUserCommunicationsConfig(
  userId: string,
): Promise<CommunicationsIntegrationsConfig> {
  const root = await getSettingsRawJson();
  const userMap = readUserMap(root);
  return userMap[userId] ?? defaultCommunicationsConfig();
}

export async function getUserCommunicationsConfigSafe(
  userId: string,
): Promise<CommunicationsIntegrationsSafe> {
  const c = await getUserCommunicationsConfig(userId);
  return toSafeCommunicationsDto(c);
}

export async function upsertUserCommunicationsConfig(
  targetUserId: string,
  patch: Partial<CommunicationsIntegrationsConfig>,
  actorUserId: string,
): Promise<CommunicationsIntegrationsConfig> {
  const root = await getSettingsRawJson();
  const userMap = readUserMap(root);
  const current = userMap[targetUserId] ?? defaultCommunicationsConfig();
  const next = mergeCommunicationsPatch(current, patch);
  userMap[targetUserId] = next;
  await writeUserMap(userMap, actorUserId);
  return next;
}

export async function getEffectiveCommunicationsConfigForUser(
  userId: string,
): Promise<CommunicationsIntegrationsConfig> {
  const global = await getCommunicationsConfig();
  const personal = await getUserCommunicationsConfig(userId);
  return mergeCommunicationsPatch(global, personal);
}

export async function findUserIdByWhatsappPhoneNumberId(
  phoneNumberId: string,
): Promise<string | null> {
  const id = phoneNumberId.trim();
  if (!id) return null;
  const root = await getSettingsRawJson();
  const users = readUserMapRaw(root);
  for (const [userId, conf] of Object.entries(users)) {
    const parsed = parseCommunicationsJson(conf);
    const configured = parsed.channels?.whatsapp?.phoneNumberId?.trim();
    if (configured && configured === id) return userId;
  }
  return null;
}

export async function findUserIdByViberAuthToken(
  authToken: string,
): Promise<string | null> {
  const token = authToken.trim();
  if (!token) return null;
  const root = await getSettingsRawJson();
  const users = readUserMapRaw(root);
  for (const [userId, conf] of Object.entries(users)) {
    const parsed = parseCommunicationsJson(conf);
    const configured = parsed.channels?.viber?.authToken?.trim();
    if (configured && configured === token) return userId;
  }
  return null;
}
