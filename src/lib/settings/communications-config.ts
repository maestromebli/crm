/**
 * Структура `SystemSettings.communicationsJson`.
 * Секрети в API відповіді не повертаються — лише прапорці `*Set`.
 */

export type ChannelNotes = {
  enabled?: boolean;
  notes?: string | null;
};

export type TelegramChannelConfig = ChannelNotes & {
  botToken?: string | null;
  webhookUrl?: string | null;
  botUsername?: string | null;
  channelId?: string | null;
};

export type WhatsappChannelConfig = ChannelNotes & {
  cloudApiUrl?: string | null;
  accessToken?: string | null;
  phoneNumberId?: string | null;
  businessAccountId?: string | null;
  appSecret?: string | null;
};

export type ViberChannelConfig = ChannelNotes & {
  authToken?: string | null;
  webhookUrl?: string | null;
};

export type InstagramChannelConfig = ChannelNotes & {
  pageAccessToken?: string | null;
  pageId?: string | null;
  instagramBusinessAccountId?: string | null;
  webhookUrl?: string | null;
  verifyToken?: string | null;
};

export type FacebookChannelConfig = ChannelNotes & {
  pageAccessToken?: string | null;
  pageId?: string | null;
  appSecret?: string | null;
};

export type SmsChannelConfig = ChannelNotes & {
  provider?: string | null;
  apiUrl?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
  sender?: string | null;
  alphaName?: string | null;
};

/** SIP / VoIP / хмарна телефонія (Twilio, Binotel, Asterisk API, …). */
export type PhoneChannelConfig = ChannelNotes & {
  provider?: string | null;
  apiUrl?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
  sipDomain?: string | null;
  extension?: string | null;
  callerId?: string | null;
  fromNumber?: string | null;
};

export type CommunicationsIntegrationsConfig = {
  /** Робочий телефон менеджера / компанії для відображення клієнтам (E.164 бажано). */
  managerPhone?: string | null;
  managerDisplayName?: string | null;
  channels?: {
    telegram?: TelegramChannelConfig;
    whatsapp?: WhatsappChannelConfig;
    viber?: ViberChannelConfig;
    instagram?: InstagramChannelConfig;
    facebook?: FacebookChannelConfig;
    sms?: SmsChannelConfig;
    phone?: PhoneChannelConfig;
  };
};

const SECRET_KEYS_TELEGRAM = ["botToken"] as const;
const SECRET_KEYS_WHATSAPP = ["accessToken", "appSecret"] as const;
const SECRET_KEYS_VIBER = ["authToken"] as const;
const SECRET_KEYS_INSTAGRAM = ["pageAccessToken"] as const;
const SECRET_KEYS_FACEBOOK = ["pageAccessToken", "appSecret"] as const;
const SECRET_KEYS_SMS = ["apiKey", "apiSecret"] as const;
const SECRET_KEYS_PHONE = ["apiKey", "apiSecret"] as const;

function isSecretSet(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export function defaultCommunicationsConfig(): CommunicationsIntegrationsConfig {
  return {
    managerPhone: null,
    managerDisplayName: null,
    channels: {
      telegram: { enabled: false },
      whatsapp: { enabled: false },
      viber: { enabled: false },
      instagram: { enabled: false },
      facebook: { enabled: false },
      sms: { enabled: false },
      phone: { enabled: false },
    },
  };
}

export function parseCommunicationsJson(
  raw: unknown,
): CommunicationsIntegrationsConfig {
  const base = defaultCommunicationsConfig();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  const ch = o.channels;
  const mergedChannels = { ...base.channels };
  if (ch && typeof ch === "object" && !Array.isArray(ch)) {
    for (const key of Object.keys(mergedChannels) as Array<
      keyof NonNullable<CommunicationsIntegrationsConfig["channels"]>
    >) {
      const patch = (ch as Record<string, unknown>)[key];
      if (patch && typeof patch === "object" && !Array.isArray(patch)) {
        mergedChannels[key] = {
          ...(mergedChannels[key] as object),
          ...patch,
        } as never;
      }
    }
  }
  return {
    managerPhone:
      typeof o.managerPhone === "string" ? o.managerPhone.trim() || null : base.managerPhone,
    managerDisplayName:
      typeof o.managerDisplayName === "string"
        ? o.managerDisplayName.trim() || null
        : base.managerDisplayName,
    channels: mergedChannels,
  };
}

/** Відповідь GET: без секретів, з прапорцями наявності. */
export type CommunicationsIntegrationsSafe = {
  managerPhone: string | null;
  managerDisplayName: string | null;
  channels: {
    telegram: Omit<TelegramChannelConfig, "botToken"> & { botTokenSet: boolean };
    whatsapp: Omit<WhatsappChannelConfig, "accessToken" | "appSecret"> & {
      accessTokenSet: boolean;
      appSecretSet: boolean;
    };
    viber: Omit<ViberChannelConfig, "authToken"> & { authTokenSet: boolean };
    instagram: Omit<InstagramChannelConfig, "pageAccessToken"> & {
      pageAccessTokenSet: boolean;
    };
    facebook: Omit<FacebookChannelConfig, "pageAccessToken" | "appSecret"> & {
      pageAccessTokenSet: boolean;
      appSecretSet: boolean;
    };
    sms: Omit<SmsChannelConfig, "apiKey" | "apiSecret"> & {
      apiKeySet: boolean;
      apiSecretSet: boolean;
    };
    phone: Omit<PhoneChannelConfig, "apiKey" | "apiSecret"> & {
      apiKeySet: boolean;
      apiSecretSet: boolean;
    };
  };
};

function stripTelegram(
  c: TelegramChannelConfig | undefined,
): CommunicationsIntegrationsSafe["channels"]["telegram"] {
  const x = c ?? {};
  return {
    enabled: x.enabled ?? false,
    notes: x.notes ?? null,
    webhookUrl: x.webhookUrl ?? null,
    botUsername: x.botUsername ?? null,
    channelId: x.channelId ?? null,
    botTokenSet: isSecretSet(x.botToken),
  };
}

function stripWhatsapp(
  c: WhatsappChannelConfig | undefined,
): CommunicationsIntegrationsSafe["channels"]["whatsapp"] {
  const x = c ?? {};
  return {
    enabled: x.enabled ?? false,
    notes: x.notes ?? null,
    cloudApiUrl: x.cloudApiUrl ?? null,
    phoneNumberId: x.phoneNumberId ?? null,
    businessAccountId: x.businessAccountId ?? null,
    accessTokenSet: isSecretSet(x.accessToken),
    appSecretSet: isSecretSet(x.appSecret),
  };
}

function stripViber(
  c: ViberChannelConfig | undefined,
): CommunicationsIntegrationsSafe["channels"]["viber"] {
  const x = c ?? {};
  return {
    enabled: x.enabled ?? false,
    notes: x.notes ?? null,
    webhookUrl: x.webhookUrl ?? null,
    authTokenSet: isSecretSet(x.authToken),
  };
}

function stripInstagram(
  c: InstagramChannelConfig | undefined,
): CommunicationsIntegrationsSafe["channels"]["instagram"] {
  const x = c ?? {};
  return {
    enabled: x.enabled ?? false,
    notes: x.notes ?? null,
    pageId: x.pageId ?? null,
    instagramBusinessAccountId: x.instagramBusinessAccountId ?? null,
    webhookUrl: x.webhookUrl ?? null,
    verifyToken: x.verifyToken ?? null,
    pageAccessTokenSet: isSecretSet(x.pageAccessToken),
  };
}

function stripFacebook(
  c: FacebookChannelConfig | undefined,
): CommunicationsIntegrationsSafe["channels"]["facebook"] {
  const x = c ?? {};
  return {
    enabled: x.enabled ?? false,
    notes: x.notes ?? null,
    pageId: x.pageId ?? null,
    pageAccessTokenSet: isSecretSet(x.pageAccessToken),
    appSecretSet: isSecretSet(x.appSecret),
  };
}

function stripSms(
  c: SmsChannelConfig | undefined,
): CommunicationsIntegrationsSafe["channels"]["sms"] {
  const x = c ?? {};
  return {
    enabled: x.enabled ?? false,
    notes: x.notes ?? null,
    provider: x.provider ?? null,
    apiUrl: x.apiUrl ?? null,
    sender: x.sender ?? null,
    alphaName: x.alphaName ?? null,
    apiKeySet: isSecretSet(x.apiKey),
    apiSecretSet: isSecretSet(x.apiSecret),
  };
}

function stripPhone(
  c: PhoneChannelConfig | undefined,
): CommunicationsIntegrationsSafe["channels"]["phone"] {
  const x = c ?? {};
  return {
    enabled: x.enabled ?? false,
    notes: x.notes ?? null,
    provider: x.provider ?? null,
    apiUrl: x.apiUrl ?? null,
    sipDomain: x.sipDomain ?? null,
    extension: x.extension ?? null,
    callerId: x.callerId ?? null,
    fromNumber: x.fromNumber ?? null,
    apiKeySet: isSecretSet(x.apiKey),
    apiSecretSet: isSecretSet(x.apiSecret),
  };
}

export function toSafeCommunicationsDto(
  config: CommunicationsIntegrationsConfig,
): CommunicationsIntegrationsSafe {
  const ch = config.channels ?? {};
  return {
    managerPhone: config.managerPhone ?? null,
    managerDisplayName: config.managerDisplayName ?? null,
    channels: {
      telegram: stripTelegram(ch.telegram),
      whatsapp: stripWhatsapp(ch.whatsapp),
      viber: stripViber(ch.viber),
      instagram: stripInstagram(ch.instagram),
      facebook: stripFacebook(ch.facebook),
      sms: stripSms(ch.sms),
      phone: stripPhone(ch.phone),
    },
  };
}

function mergeChannel<T extends Record<string, unknown>>(
  current: T,
  patch: Partial<T> | undefined,
  secretKeys: readonly string[],
): T {
  if (!patch) return current;
  const out = { ...current } as T;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (secretKeys.includes(k)) {
      if (typeof v === "string" && v.trim() === "") continue;
      (out as Record<string, unknown>)[k] = v;
      continue;
    }
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function mergeCommunicationsPatch(
  current: CommunicationsIntegrationsConfig,
  patch: Partial<CommunicationsIntegrationsConfig>,
): CommunicationsIntegrationsConfig {
  const base = parseCommunicationsJson(current);
  const curCh = { ...(base.channels ?? {}) };
  const pCh = patch.channels;

  const next: CommunicationsIntegrationsConfig = {
    managerPhone:
      patch.managerPhone !== undefined
        ? patch.managerPhone?.trim() || null
        : base.managerPhone,
    managerDisplayName:
      patch.managerDisplayName !== undefined
        ? patch.managerDisplayName?.trim() || null
        : base.managerDisplayName,
    channels: curCh,
  };

  if (!pCh) return parseCommunicationsJson(next);

  if (pCh.telegram !== undefined) {
    curCh.telegram = mergeChannel(
      (curCh.telegram ?? {}) as Record<string, unknown>,
      pCh.telegram as Record<string, unknown>,
      [...SECRET_KEYS_TELEGRAM],
    ) as TelegramChannelConfig;
  }
  if (pCh.whatsapp !== undefined) {
    curCh.whatsapp = mergeChannel(
      (curCh.whatsapp ?? {}) as Record<string, unknown>,
      pCh.whatsapp as Record<string, unknown>,
      [...SECRET_KEYS_WHATSAPP],
    ) as WhatsappChannelConfig;
  }
  if (pCh.viber !== undefined) {
    curCh.viber = mergeChannel(
      (curCh.viber ?? {}) as Record<string, unknown>,
      pCh.viber as Record<string, unknown>,
      [...SECRET_KEYS_VIBER],
    ) as ViberChannelConfig;
  }
  if (pCh.instagram !== undefined) {
    curCh.instagram = mergeChannel(
      (curCh.instagram ?? {}) as Record<string, unknown>,
      pCh.instagram as Record<string, unknown>,
      [...SECRET_KEYS_INSTAGRAM],
    ) as InstagramChannelConfig;
  }
  if (pCh.facebook !== undefined) {
    curCh.facebook = mergeChannel(
      (curCh.facebook ?? {}) as Record<string, unknown>,
      pCh.facebook as Record<string, unknown>,
      [...SECRET_KEYS_FACEBOOK],
    ) as FacebookChannelConfig;
  }
  if (pCh.sms !== undefined) {
    curCh.sms = mergeChannel(
      (curCh.sms ?? {}) as Record<string, unknown>,
      pCh.sms as Record<string, unknown>,
      [...SECRET_KEYS_SMS],
    ) as SmsChannelConfig;
  }
  if (pCh.phone !== undefined) {
    curCh.phone = mergeChannel(
      (curCh.phone ?? {}) as Record<string, unknown>,
      pCh.phone as Record<string, unknown>,
      [...SECRET_KEYS_PHONE],
    ) as PhoneChannelConfig;
  }

  return parseCommunicationsJson(next);
}
