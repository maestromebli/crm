"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TemplateEditor } from "@/features/contracts/components/template-editor";
import { SettingsShell } from "@/components/settings/SettingsShell";

type TemplateModel = {
  id: string;
  code: string;
  name: string;
  documentType: string;
  language: string;
  bodyHtml: string;
  bodyDocxTemplateUrl?: string;
  variablesSchemaJson: unknown;
  settingsJson: unknown;
  status: string;
};

export default function ContractTemplateDetailPage() {
  const params = useParams<{ templateId: string }>();
  const router = useRouter();
  const templateId = params.templateId;
  const [data, setData] = useState<TemplateModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!templateId) return;
    let mounted = true;
    void fetch(`/api/contract-templates/${templateId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: TemplateModel) => {
        if (!mounted) return;
        setData(json);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [templateId]);

  const initial = useMemo(
    () =>
      data ?? {
        code: "",
        name: "",
        documentType: "contract",
        language: "uk",
        bodyHtml: "<p>Новий шаблон</p>",
        bodyDocxTemplateUrl: "",
        variablesSchemaJson: [],
        settingsJson: {},
      },
    [data],
  );

  return (
    <SettingsShell title="Редактор шаблону договору" description="Чернетка/публікація з версіями">
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Завантаження...
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              onClick={async () => {
                if (!data?.id) return;
                await fetch(`/api/contract-templates/${data.id}/публікації`, { method: "POST" });
                router.refresh();
              }}
            >
              Опублікувати
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              onClick={async () => {
                if (!data?.id) return;
                const r = await fetch(`/api/contract-templates/${data.id}/duplicate`, {
                  method: "POST",
                });
                const created = (await r.json()) as { id?: string };
                if (created?.id) router.push(`/settings/contracts/${created.id}`);
              }}
            >
              Дублювати у нову версію
            </button>
            <button
              type="button"
              className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs text-rose-700"
              onClick={async () => {
                if (!data?.id) return;
                await fetch(`/api/contract-templates/${data.id}/archive`, { method: "POST" });
                router.push("/settings/contracts");
              }}
            >
              Архівувати
            </button>
          </div>
          <TemplateEditor
            initial={initial}
            onSave={async (next) => {
              if (!data?.id) return;
              await fetch(`/api/contract-templates/${data.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(next),
              });
              router.refresh();
            }}
          />
        </>
      )}
    </SettingsShell>
  );
}
