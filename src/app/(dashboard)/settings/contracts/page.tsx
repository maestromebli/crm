"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TemplateVersionList } from "@/features/contracts/components/template-version-list";
import { SettingsShell } from "@/components/settings/SettingsShell";

type TemplateRow = {
  id: string;
  code: string;
  name: string;
  version: number;
  status: string;
  updatedAt: string;
};

export default function ContractsSettingsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void fetch("/api/contract-templates", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: TemplateRow[]) => {
        if (!mounted) return;
        setTemplates(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SettingsShell
      title="Шаблони договорів"
      description="Версійований редактор шаблонів, preview та публікація активної версії."
    >
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Завантаження шаблонів...
        </div>
      ) : (
        <TemplateVersionList
          items={templates}
          onOpen={(id) => router.push(`/settings/contracts/${id}`)}
        />
      )}
    </SettingsShell>
  );
}
