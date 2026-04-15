"use client";

import { useCallback, useEffect, useState } from "react";
import { SettingsCard } from "../../../../components/settings/SettingsCard";
import type {
  CommunicationsIntegrationsConfig,
  CommunicationsIntegrationsSafe,
} from "../../../../lib/settings/communications-config";
import { patchJson } from "../../../../lib/api/patch-json";

type LoadState = "idle" | "loading" | "error" | "ready";

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="text-[11px] text-slate-600">
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
    />
  );
}

function SecretInput({
  id,
  label,
  configured,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  configured: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel htmlFor={id}>
        {label}
        {configured && (
          <span className="ml-1 text-[10px] font-normal text-emerald-600">
            (збережено)
          </span>
        )}
      </FieldLabel>
      <input
        id={id}
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          placeholder ??
          (configured ? "Залиште порожнім, щоб не змінювати" : "Введіть ключ / токен")
        }
        className="w-full rounded-md border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-xs outline-none focus:border-slate-900"
      />
    </div>
  );
}

function createQuickVerifyToken() {
  const random = Math.random().toString(36).slice(2, 10);
  return `ig-${Date.now().toString(36)}-${random}`;
}

type Props = {
  apiBasePath?: string;
  managerCardTitle?: string;
  managerCardDescription?: string;
  saveHint?: string;
  hiddenChannels?: Array<keyof CommunicationsIntegrationsSafe["channels"]>;
  footerNote?: React.ReactNode;
};

export function CommunicationsSettingsClient({
  apiBasePath = "/api/settings/communications",
  managerCardTitle = "Менеджер",
  managerCardDescription = "Публічний телефон та імʼя для клієнтів (кнопки «зателефонувати», підпис у месенджерах).",
  saveHint = "Потрібні права «Налаштування: керування». Секрети не повертаються в API після збереження — лише мітка «збережено».",
  hiddenChannels = [],
  footerNote = null,
}: Props) {
  const [load, setLoad] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CommunicationsIntegrationsSafe | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const [tgToken, setTgToken] = useState("");
  const [waToken, setWaToken] = useState("");
  const [waSecret, setWaSecret] = useState("");
  const [viberToken, setViberToken] = useState("");
  const [igToken, setIgToken] = useState("");
  const [fbToken, setFbToken] = useState("");
  const [fbSecret, setFbSecret] = useState("");
  const [smsKey, setSmsKey] = useState("");
  const [smsSecret, setSmsSecret] = useState("");
  const [phoneKey, setPhoneKey] = useState("");
  const [phoneSecret, setPhoneSecret] = useState("");

  const loadData = useCallback(async () => {
    setLoad("loading");
    setError(null);
    try {
      const res = await fetch(apiBasePath);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as CommunicationsIntegrationsSafe;
      setData(json);
      setLoad("ready");
      setTgToken("");
      setWaToken("");
      setWaSecret("");
      setViberToken("");
      setIgToken("");
      setFbToken("");
      setFbSecret("");
      setSmsKey("");
      setSmsSecret("");
      setPhoneKey("");
      setPhoneSecret("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка завантаження");
      setLoad("error");
    }
  }, [apiBasePath]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function onSave() {
    if (!data) return;
    setSaving(true);
    setSaveOk(false);
    try {
      const channels: NonNullable<
        CommunicationsIntegrationsConfig["channels"]
      > = {};

      const t = data.channels.telegram;
      channels.telegram = {
        enabled: t.enabled,
        notes: t.notes,
        webhookUrl: t.webhookUrl,
        botUsername: t.botUsername,
        channelId: t.channelId,
        ...(tgToken.trim() ? { botToken: tgToken.trim() } : {}),
      };

      const w = data.channels.whatsapp;
      channels.whatsapp = {
        enabled: w.enabled,
        notes: w.notes,
        cloudApiUrl: w.cloudApiUrl,
        phoneNumberId: w.phoneNumberId,
        businessAccountId: w.businessAccountId,
        ...(waToken.trim() ? { accessToken: waToken.trim() } : {}),
        ...(waSecret.trim() ? { appSecret: waSecret.trim() } : {}),
      };

      const v = data.channels.viber;
      channels.viber = {
        enabled: v.enabled,
        notes: v.notes,
        webhookUrl: v.webhookUrl,
        ...(viberToken.trim() ? { authToken: viberToken.trim() } : {}),
      };

      const i = data.channels.instagram;
      channels.instagram = {
        enabled: i.enabled,
        notes: i.notes,
        pageId: i.pageId,
        instagramBusinessAccountId: i.instagramBusinessAccountId,
        webhookUrl: i.webhookUrl,
        verifyToken: i.verifyToken,
        ...(igToken.trim() ? { pageAccessToken: igToken.trim() } : {}),
      };

      const f = data.channels.facebook;
      channels.facebook = {
        enabled: f.enabled,
        notes: f.notes,
        pageId: f.pageId,
        ...(fbToken.trim() ? { pageAccessToken: fbToken.trim() } : {}),
        ...(fbSecret.trim() ? { appSecret: fbSecret.trim() } : {}),
      };

      const s = data.channels.sms;
      channels.sms = {
        enabled: s.enabled,
        notes: s.notes,
        provider: s.provider,
        apiUrl: s.apiUrl,
        sender: s.sender,
        alphaName: s.alphaName,
        ...(smsKey.trim() ? { apiKey: smsKey.trim() } : {}),
        ...(smsSecret.trim() ? { apiSecret: smsSecret.trim() } : {}),
      };

      const p = data.channels.phone;
      channels.phone = {
        enabled: p.enabled,
        notes: p.notes,
        provider: p.provider,
        apiUrl: p.apiUrl,
        sipDomain: p.sipDomain,
        extension: p.extension,
        callerId: p.callerId,
        fromNumber: p.fromNumber,
        ...(phoneKey.trim() ? { apiKey: phoneKey.trim() } : {}),
        ...(phoneSecret.trim() ? { apiSecret: phoneSecret.trim() } : {}),
      };

      const out = await patchJson<{
        ok: boolean;
        data: CommunicationsIntegrationsSafe;
      }>(apiBasePath, {
        managerPhone: data.managerPhone,
        managerDisplayName: data.managerDisplayName,
        channels,
      });
      setError(null);
      setData(out.data);
      setSaveOk(true);
      setTgToken("");
      setWaToken("");
      setWaSecret("");
      setViberToken("");
      setIgToken("");
      setFbToken("");
      setFbSecret("");
      setSmsKey("");
      setSmsSecret("");
      setPhoneKey("");
      setPhoneSecret("");
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  if (load === "loading" || load === "idle") {
    return (
      <p className="text-xs text-slate-500">Завантаження…</p>
    );
  }
  if (load === "error" || !data) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
        {error ?? "Немає даних"}
        <button
          type="button"
          onClick={() => void loadData()}
          className="ml-2 underline"
        >
          Повторити
        </button>
      </div>
    );
  }

  const ch = data.channels;
  const hidden = new Set(hiddenChannels);

  function applyQuickInstagramSetup() {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    const webhookUrl = `${origin}/api/integrations/instagram/webhook`;
    const verifyToken = ch.instagram.verifyToken?.trim() || createQuickVerifyToken();
    setData({
      ...data,
      channels: {
        ...data.channels,
        instagram: {
          ...ch.instagram,
          enabled: true,
          webhookUrl,
          verifyToken,
          notes:
            ch.instagram.notes ??
            "Швидке підключення: вкажіть webhook URL і verify token у Meta App → Webhooks (Instagram).",
        },
      },
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
          {error}
        </p>
      )}
      {saveOk && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900">
          Збережено.
        </p>
      )}

      <SettingsCard
        title={managerCardTitle}
        description={managerCardDescription}
      >
        <div className="space-y-1.5">
          <FieldLabel>Телефон менеджера</FieldLabel>
          <TextInput
            value={data.managerPhone ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                managerPhone: e.target.value || null,
              })
            }
            placeholder="+380501234567"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Імʼя для відображення</FieldLabel>
          <TextInput
            value={data.managerDisplayName ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                managerDisplayName: e.target.value || null,
              })
            }
            placeholder="Олена, відділ продажу"
          />
        </div>
      </SettingsCard>

      {!hidden.has("telegram") ? (
      <SettingsCard
        title="Telegram"
        description="Bot API та вебхук. Для персонального маршруту використовуйте URL вебхука з userId (наприклад: /api/integrations/telegram/webhook?userId=<ваш_id>). Токен не показується після збереження."
      >
        <label className="flex items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            checked={ch.telegram.enabled}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  telegram: { ...ch.telegram, enabled: e.target.checked },
                },
              })
            }
          />
          Канал увімкнено
        </label>
        <SecretInput
          id="tg-token"
          label="Токен бота"
          configured={ch.telegram.botTokenSet}
          value={tgToken}
          onChange={setTgToken}
        />
        <div className="space-y-1.5">
          <FieldLabel>URL вебхука</FieldLabel>
          <TextInput
            value={ch.telegram.webhookUrl ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  telegram: { ...ch.telegram, webhookUrl: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Імʼя бота (@username)</FieldLabel>
          <TextInput
            value={ch.telegram.botUsername ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  telegram: { ...ch.telegram, botUsername: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>ID каналу / групи (опційно)</FieldLabel>
          <TextInput
            value={ch.telegram.channelId ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  telegram: { ...ch.telegram, channelId: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Нотатки</FieldLabel>
          <TextInput
            value={ch.telegram.notes ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  telegram: { ...ch.telegram, notes: e.target.value || null },
                },
              })
            }
          />
        </div>
      </SettingsCard>
      ) : null}

      {!hidden.has("whatsapp") ? (
      <SettingsCard
        title="WhatsApp (Meta Cloud API)"
        description="Токени з Meta for Developers."
      >
        <label className="flex items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            checked={ch.whatsapp.enabled}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  whatsapp: { ...ch.whatsapp, enabled: e.target.checked },
                },
              })
            }
          />
          Канал увімкнено
        </label>
        <div className="space-y-1.5">
          <FieldLabel>URL Cloud API (за замовчуванням graph.facebook.com)</FieldLabel>
          <TextInput
            value={ch.whatsapp.cloudApiUrl ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  whatsapp: { ...ch.whatsapp, cloudApiUrl: e.target.value || null },
                },
              })
            }
            placeholder="https://graph.facebook.com/v21.0/"
          />
        </div>
        <SecretInput
          id="wa-token"
          label="Токен доступу"
          configured={ch.whatsapp.accessTokenSet}
          value={waToken}
          onChange={setWaToken}
        />
        <SecretInput
          id="wa-appsec"
          label="Секрет застосунку"
          configured={ch.whatsapp.appSecretSet}
          value={waSecret}
          onChange={setWaSecret}
        />
        <div className="space-y-1.5">
          <FieldLabel>ID номера телефону</FieldLabel>
          <TextInput
            value={ch.whatsapp.phoneNumberId ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  whatsapp: { ...ch.whatsapp, phoneNumberId: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>ID бізнес-акаунта</FieldLabel>
          <TextInput
            value={ch.whatsapp.businessAccountId ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  whatsapp: {
                    ...ch.whatsapp,
                    businessAccountId: e.target.value || null,
                  },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Нотатки</FieldLabel>
          <TextInput
            value={ch.whatsapp.notes ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  whatsapp: { ...ch.whatsapp, notes: e.target.value || null },
                },
              })
            }
          />
        </div>
      </SettingsCard>
      ) : null}

      {!hidden.has("viber") ? (
      <SettingsCard title="Viber" description="Партнерський API Viber.">
        <label className="flex items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            checked={ch.viber.enabled}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  viber: { ...ch.viber, enabled: e.target.checked },
                },
              })
            }
          />
          Канал увімкнено
        </label>
        <SecretInput
          id="viber-tok"
          label="Токен авторизації"
          configured={ch.viber.authTokenSet}
          value={viberToken}
          onChange={setViberToken}
        />
        <div className="space-y-1.5">
          <FieldLabel>URL вебхука</FieldLabel>
          <TextInput
            value={ch.viber.webhookUrl ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  viber: { ...ch.viber, webhookUrl: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Нотатки</FieldLabel>
          <TextInput
            value={ch.viber.notes ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  viber: { ...ch.viber, notes: e.target.value || null },
                },
              })
            }
          />
        </div>
      </SettingsCard>
      ) : null}

      {!hidden.has("instagram") || !hidden.has("facebook") ? (
      <SettingsCard
        title="Instagram / Facebook"
        description="Токени сторінки та Instagram Business."
      >
        {!hidden.has("instagram") ? (
          <>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-2">
          <p className="text-[11px] text-emerald-900">
            Швидке підключення Instagram Direct
          </p>
          <button
            type="button"
            onClick={applyQuickInstagramSetup}
            className="mt-2 rounded-full border border-emerald-600 px-3 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
          >
            Заповнити webhook і verify token
          </button>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            checked={ch.instagram.enabled}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  instagram: { ...ch.instagram, enabled: e.target.checked },
                },
              })
            }
          />
          Instagram увімкнено
        </label>
        <SecretInput
          id="ig-tok"
          label="Токен доступу сторінки / Instagram"
          configured={ch.instagram.pageAccessTokenSet}
          value={igToken}
          onChange={setIgToken}
        />
        <div className="space-y-1.5">
          <FieldLabel>ID сторінки</FieldLabel>
          <TextInput
            value={ch.instagram.pageId ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  instagram: { ...ch.instagram, pageId: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>ID бізнес-акаунта Instagram</FieldLabel>
          <TextInput
            value={ch.instagram.instagramBusinessAccountId ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  instagram: {
                    ...ch.instagram,
                    instagramBusinessAccountId: e.target.value || null,
                  },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Webhook URL (для Meta Webhooks)</FieldLabel>
          <TextInput
            value={ch.instagram.webhookUrl ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  instagram: { ...ch.instagram, webhookUrl: e.target.value || null },
                },
              })
            }
            placeholder="https://crm.example.com/api/integrations/instagram/webhook"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Verify token (Meta Webhooks)</FieldLabel>
          <TextInput
            value={ch.instagram.verifyToken ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  instagram: { ...ch.instagram, verifyToken: e.target.value || null },
                },
              })
            }
            placeholder="ig-verify-token"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Нотатки (Instagram)</FieldLabel>
          <TextInput
            value={ch.instagram.notes ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  instagram: { ...ch.instagram, notes: e.target.value || null },
                },
              })
            }
          />
        </div>
          </>
        ) : (
          <p className="text-[11px] text-slate-500">
            Instagram налаштовується на цій сторінці окремо.
          </p>
        )}

        {!hidden.has("facebook") ? (
          <>
        <p className="pt-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          Facebook Messenger (окремо)
        </p>
        <label className="flex items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            checked={ch.facebook.enabled}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  facebook: { ...ch.facebook, enabled: e.target.checked },
                },
              })
            }
          />
          Facebook Messenger увімкнено
        </label>
        <SecretInput
          id="fb-tok"
          label="Токен доступу сторінки"
          configured={ch.facebook.pageAccessTokenSet}
          value={fbToken}
          onChange={setFbToken}
        />
        <SecretInput
          id="fb-sec"
          label="Секрет застосунку"
          configured={ch.facebook.appSecretSet}
          value={fbSecret}
          onChange={setFbSecret}
        />
        <div className="space-y-1.5">
          <FieldLabel>ID сторінки</FieldLabel>
          <TextInput
            value={ch.facebook.pageId ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  facebook: { ...ch.facebook, pageId: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Нотатки (Facebook)</FieldLabel>
          <TextInput
            value={ch.facebook.notes ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  facebook: { ...ch.facebook, notes: e.target.value || null },
                },
              })
            }
          />
        </div>
          </>
        ) : null}
      </SettingsCard>
      ) : null}

      {!hidden.has("sms") ? (
      <SettingsCard
        title="SMS"
        description="Провайдер SMS: API URL, ключі, імʼя відправника."
      >
        <label className="flex items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            checked={ch.sms.enabled}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  sms: { ...ch.sms, enabled: e.target.checked },
                },
              })
            }
          />
          Канал увімкнено
        </label>
        <div className="space-y-1.5">
          <FieldLabel>Провайдер (назва)</FieldLabel>
          <TextInput
            value={ch.sms.provider ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  sms: { ...ch.sms, provider: e.target.value || null },
                },
              })
            }
            placeholder="TurboSMS, Twilio, …"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Базовий URL API</FieldLabel>
          <TextInput
            value={ch.sms.apiUrl ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  sms: { ...ch.sms, apiUrl: e.target.value || null },
                },
              })
            }
          />
        </div>
        <SecretInput
          id="sms-key"
          label="API-ключ"
          configured={ch.sms.apiKeySet}
          value={smsKey}
          onChange={setSmsKey}
        />
        <SecretInput
          id="sms-sec"
          label="Секрет API"
          configured={ch.sms.apiSecretSet}
          value={smsSecret}
          onChange={setSmsSecret}
        />
        <div className="space-y-1.5">
          <FieldLabel>Відправник / альфа-імʼя</FieldLabel>
          <TextInput
            value={ch.sms.sender ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  sms: { ...ch.sms, sender: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Альфа-імʼя (окремо)</FieldLabel>
          <TextInput
            value={ch.sms.alphaName ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  sms: { ...ch.sms, alphaName: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Нотатки</FieldLabel>
          <TextInput
            value={ch.sms.notes ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  sms: { ...ch.sms, notes: e.target.value || null },
                },
              })
            }
          />
        </div>
      </SettingsCard>
      ) : null}

      {!hidden.has("phone") ? (
      <SettingsCard
        title="Телефонія (SIP / VoIP / хмарна АТС)"
        description="API оператора: дзвінки click-to-call, маршрутизація. Вкажіть провайдера вручну."
      >
        <label className="flex items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            checked={ch.phone.enabled}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  phone: { ...ch.phone, enabled: e.target.checked },
                },
              })
            }
          />
          Інтеграція увімкнена
        </label>
        <div className="space-y-1.5">
          <FieldLabel>Провайдер</FieldLabel>
          <TextInput
            value={ch.phone.provider ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  phone: { ...ch.phone, provider: e.target.value || null },
                },
              })
            }
            placeholder="Binotel, Twilio, Asterisk REST, …"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>URL API</FieldLabel>
          <TextInput
            value={ch.phone.apiUrl ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  phone: { ...ch.phone, apiUrl: e.target.value || null },
                },
              })
            }
          />
        </div>
        <SecretInput
          id="ph-key"
          label="API-ключ / SID"
          configured={ch.phone.apiKeySet}
          value={phoneKey}
          onChange={setPhoneKey}
        />
        <SecretInput
          id="ph-sec"
          label="Секрет API / токен"
          configured={ch.phone.apiSecretSet}
          value={phoneSecret}
          onChange={setPhoneSecret}
        />
        <div className="space-y-1.5">
          <FieldLabel>SIP-домен</FieldLabel>
          <TextInput
            value={ch.phone.sipDomain ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  phone: { ...ch.phone, sipDomain: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Внутрішній номер / ext</FieldLabel>
          <TextInput
            value={ch.phone.extension ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  phone: { ...ch.phone, extension: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Caller ID / номер зовнішньої лінії</FieldLabel>
          <TextInput
            value={ch.phone.callerId ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  phone: { ...ch.phone, callerId: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Номер відправника (E.164)</FieldLabel>
          <TextInput
            value={ch.phone.fromNumber ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  phone: { ...ch.phone, fromNumber: e.target.value || null },
                },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Нотатки</FieldLabel>
          <TextInput
            value={ch.phone.notes ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                channels: {
                  ...data.channels,
                  phone: { ...ch.phone, notes: e.target.value || null },
                },
              })
            }
          />
        </div>
      </SettingsCard>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-medium text-slate-50 shadow-sm shadow-slate-900/40 disabled:opacity-50"
        >
          {saving ? "Збереження…" : "Зберегти всі налаштування"}
        </button>
        <p className="text-[10px] text-slate-500">
          {saveHint}
        </p>
      </div>
      {footerNote ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {footerNote}
        </div>
      ) : null}
    </div>
  );
}
