import Link from "next/link";
import { DataTableShell } from "../../components/shared/DataTableShell";
import { TargetCampaignsTable } from "./components/TargetCampaignsTable";
import { TargetAdsetsTable } from "./components/TargetAdsetsTable";
import { TargetAdsTable } from "./components/TargetAdsTable";
import { TargetCreativesGrid } from "./components/TargetCreativesGrid";
import { TargetStatusPill } from "./components/TargetStatusPill";
import { formatPct, formatUah } from "./format";
import type { TargetViewId } from "./target-route";
import type { TargetSyncStatus, TargetWorkspaceSnapshot } from "./types";

function KpiDelta({
  label,
  pct,
  variant,
}: {
  label: string;
  pct: number;
  variant: "spend" | "leads";
}) {
  const spendUp = pct > 0;
  const leadsUp = pct > 0;
  const color =
    variant === "spend"
      ? spendUp
        ? "text-amber-800"
        : "text-emerald-800"
      : leadsUp
        ? "text-emerald-800"
        : "text-rose-800";
  return (
    <p className="text-[10px] text-slate-600">
      {label}:{" "}
      <span className={`font-semibold ${color}`}>{formatPct(pct)}</span> до
      попереднього періоду
    </p>
  );
}

export function TargetOverviewPanel({
  snapshot,
}: {
  snapshot: TargetWorkspaceSnapshot;
}) {
  const { kpi, spendByDay, campaigns } = snapshot;
  const maxSpend = Math.max(...spendByDay.map((x) => x.spendUah), 1);

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-slate-500">
        Оновлено:{" "}
        {new Date(snapshot.generatedAt).toLocaleString("uk-UA", {
          dateStyle: "short",
          timeStyle: "short",
        })}
        {snapshot.source === "demo" ? (
          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            демо-дані
          </span>
        ) : (
          <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">
            БД
          </span>
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Витрати (7 дн.)",
            value: formatUah(kpi.spend7dUah),
            hint: "Усі кампанії за період",
            extra: (
              <KpiDelta label="Динаміка" pct={kpi.spendDeltaPct} variant="spend" />
            ),
          },
          {
            label: "Ліди (7 дн.)",
            value: String(kpi.leads7d),
            hint: "З реклами Meta",
            extra: (
              <KpiDelta label="Динаміка" pct={kpi.leadsDeltaPct} variant="leads" />
            ),
          },
          {
            label: "CPL (оцінка)",
            value: kpi.cplUah != null ? formatUah(kpi.cplUah) : "—",
            hint: "Витрати / лід",
            extra: null,
          },
          {
            label: "Активні кампанії",
            value: String(kpi.activeCampaigns),
            hint: "Зараз у показі",
            extra: null,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-3 shadow-sm"
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {k.label}
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--enver-text)]">{k.value}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{k.hint}</p>
            {k.extra}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <p className="text-[11px] font-semibold text-slate-800">Витрати по днях</p>
        <div className="mt-3 flex h-28 items-end gap-1">
          {spendByDay.map((d) => {
            const h = Math.round((d.spendUah / maxSpend) * 100);
            return (
              <div
                key={d.day}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${d.day}: ${formatUah(d.spendUah)}`}
              >
                <div
                  className="w-full max-w-[48px] rounded-t bg-gradient-to-t from-orange-600 to-orange-400"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[9px] text-slate-500">
                  {d.day.slice(8, 10)}.{d.day.slice(5, 7)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold text-slate-800">
          Кампанії (фрагмент)
        </p>
        <DataTableShell
          columns={["Кампанія", "Статус", "Канал", "Витрати", "Ліди", "CPL"]}
        >
          {campaigns.slice(0, 3).map((c) => (
            <tr key={c.id} className="border-t border-slate-100 text-slate-700">
              <td className="px-3 py-2 font-medium">{c.name}</td>
              <td className="px-3 py-2">
                <TargetStatusPill status={c.status} />
              </td>
              <td className="px-3 py-2 text-slate-600">{c.channel}</td>
              <td className="px-3 py-2">{formatUah(c.spendUah)}</td>
              <td className="px-3 py-2">{c.leads}</td>
              <td className="px-3 py-2">
                {c.cplUah != null ? formatUah(c.cplUah) : "—"}
              </td>
            </tr>
          ))}
        </DataTableShell>
        <p className="mt-2 text-[10px] text-slate-500">
          Повна таблиця з фільтрами та експортом — у{" "}
          <Link href="/target/campaigns" className="text-orange-700 underline">
            Кампанії
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function syncStateLabel(state: TargetSyncStatus["marketingApi"]["state"]): {
  text: string;
  className: string;
} {
  switch (state) {
    case "connected":
      return { text: "підключено", className: "text-emerald-700" };
    case "error":
      return { text: "помилка", className: "text-rose-700" };
    default:
      return { text: "не підключено", className: "text-amber-700" };
  }
}

export function TargetSyncPanel({ sync }: { sync: TargetSyncStatus }) {
  const m = syncStateLabel(sync.marketingApi.state);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-800">Маркетинговий API</p>
          <p className="mt-2 text-[11px] text-slate-600">
            Статус: <span className={`font-medium ${m.className}`}>{m.text}</span>
          </p>
          {sync.marketingApi.lastSyncAt && (
            <p className="mt-1 text-[10px] text-slate-500">
              Остання синхронізація:{" "}
              {new Date(sync.marketingApi.lastSyncAt).toLocaleString("uk-UA")}
            </p>
          )}
          {sync.marketingApi.lastError && (
            <p className="mt-1 text-[10px] text-rose-700">
              {sync.marketingApi.lastError}
            </p>
          )}
          <p className="mt-1 text-[10px] text-slate-500">
            Після збереження токена — імпорт кампаній, витрат і статистик.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-800">Вебхук лід-реклами</p>
          <p className="mt-2 text-[11px] text-slate-600">
            Остання доставка:{" "}
            <span className="text-slate-800">
              {sync.leadWebhook.lastDeliveryAt
                ? new Date(sync.leadWebhook.lastDeliveryAt).toLocaleString(
                    "uk-UA",
                  )
                : "—"}
            </span>
          </p>
          {sync.leadWebhook.lastError && (
            <p className="mt-1 text-[10px] text-rose-700">
              {sync.leadWebhook.lastError}
            </p>
          )}
          <p className="mt-1 text-[10px] text-slate-500">
            За 24 год: {sync.leadWebhook.deliveries24h} подій
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/50 px-4 py-3 text-[11px] text-slate-700">
        <p className="font-medium text-[var(--enver-text)]">Налаштування ключів</p>
        <p className="mt-1 text-slate-600">
          App ID, токени та ID рекламного акаунту — у{" "}
          <Link
            href="/settings/integrations/meta-target"
            className="text-orange-800 underline"
          >
            Налаштування → Instagram / Meta таргет
          </Link>
          . API для знімка даних:{" "}
          <code className="rounded bg-[var(--enver-card)] px-1 text-[10px] text-slate-800">
            GET /api/target/workspace
          </code>
        </p>
      </div>
    </div>
  );
}

export function TargetInvalidPanel() {
  return (
    <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] px-4 py-8 text-center text-sm text-slate-600 shadow-sm">
      <p>Такого підрозділу немає.</p>
      <Link href="/target" className="mt-2 inline-block text-orange-700 underline">
        Повернутися до огляду таргету
      </Link>
    </div>
  );
}

export function TargetViewBody({
  view,
  snapshot,
}: {
  view: TargetViewId;
  snapshot: TargetWorkspaceSnapshot;
}) {
  switch (view) {
    case "overview":
      return <TargetOverviewPanel snapshot={snapshot} />;
    case "campaigns":
      return <TargetCampaignsTable campaigns={snapshot.campaigns} />;
    case "adsets":
      return <TargetAdsetsTable adsets={snapshot.adsets} />;
    case "ads":
      return <TargetAdsTable ads={snapshot.ads} />;
    case "creatives":
      return <TargetCreativesGrid creatives={snapshot.creatives} />;
    case "spend":
      return <TargetSpendPanel snapshot={snapshot} />;
    case "leads":
      return <TargetLeadsPanel snapshot={snapshot} />;
    case "attribution":
      return <TargetAttributionPanel snapshot={snapshot} />;
    case "sync":
      return <TargetSyncPanel sync={snapshot.sync} />;
    default:
      return <TargetInvalidPanel />;
  }
}

function TargetSpendPanel({ snapshot }: { snapshot: TargetWorkspaceSnapshot }) {
  const total = snapshot.spendByDay.reduce((s, d) => s + d.spendUah, 0);
  const leads = snapshot.spendByDay.reduce((s, d) => s + d.leads, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <p className="text-[11px] text-slate-600">
          За вибраний тиждень: <strong>{formatUah(total)}</strong>, лідів:{" "}
          <strong>{leads}</strong>. Після інтеграції з Meta можна змінювати період
          і зрізати по кампаніях.
        </p>
      </div>
      <DataTableShell columns={["Дата", "Витрати", "Ліди", "CPL (день)"]}>
        {snapshot.spendByDay.map((d) => (
          <tr key={d.day} className="border-t border-slate-100 text-slate-700">
            <td className="px-3 py-2">{d.day}</td>
            <td className="px-3 py-2">{formatUah(d.spendUah)}</td>
            <td className="px-3 py-2">{d.leads}</td>
            <td className="px-3 py-2">
              {d.leads > 0 ? formatUah(Math.round(d.spendUah / d.leads)) : "—"}
            </td>
          </tr>
        ))}
      </DataTableShell>
    </div>
  );
}

function TargetLeadsPanel({ snapshot }: { snapshot: TargetWorkspaceSnapshot }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-600">
        Заявки з лід-форм Meta. Повний цикл — у{" "}
        <Link href="/leads" className="text-orange-700 underline">
          модулі лідів
        </Link>
        .
      </p>
      <DataTableShell
        columns={[
          "Контакт",
          "Телефон",
          "Кампанія",
          "Форма",
          "Час",
          "У CRM",
        ]}
      >
        {snapshot.adLeads.map((r) => (
          <tr key={r.id} className="border-t border-slate-100 text-slate-700">
            <td className="px-3 py-2 font-medium">{r.name}</td>
            <td className="px-3 py-2 text-slate-600">{r.phone}</td>
            <td className="px-3 py-2 text-slate-600">{r.campaignName}</td>
            <td className="px-3 py-2">{r.formName}</td>
            <td className="px-3 py-2 text-slate-600">{r.receivedAt}</td>
            <td className="px-3 py-2 text-slate-800">{r.crmLeadTitle}</td>
          </tr>
        ))}
      </DataTableShell>
    </div>
  );
}

function TargetAttributionPanel({
  snapshot,
}: {
  snapshot: TargetWorkspaceSnapshot;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-600">
        Звʼязок UTM і рекламних позначок з сесіями та замовленнями (агрегація з
        демо-даних).
      </p>
      <DataTableShell
        columns={["source", "medium", "campaign", "Сесії", "Ліди", "Замовлення"]}
      >
        {snapshot.attribution.map((r, i) => (
          <tr key={i} className="border-t border-slate-100 text-slate-700">
            <td className="px-3 py-2 font-mono text-[11px]">{r.source}</td>
            <td className="px-3 py-2 font-mono text-[11px]">{r.medium}</td>
            <td className="px-3 py-2 font-mono text-[11px]">{r.campaign}</td>
            <td className="px-3 py-2">{r.sessions.toLocaleString("uk-UA")}</td>
            <td className="px-3 py-2">{r.leads}</td>
            <td className="px-3 py-2">{r.deals}</td>
          </tr>
        ))}
      </DataTableShell>
    </div>
  );
}
