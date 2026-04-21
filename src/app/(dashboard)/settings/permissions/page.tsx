import type { Metadata } from "next";
import type { Role } from "@prisma/client";
import Link from "next/link";
import { CRM_ROLES_PRIMARY, ROLE_LABELS } from "../../../../config/user-roles";
import { ROLE_POLICY_SUMMARY_UK } from "../../../../lib/authz/role-access-policy";
import { P, requirePermissionForPage } from "../../../../lib/authz/page-auth";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { SettingsCard } from "../../../../components/settings/SettingsCard";

const ROLES_FOR_POLICY_DOC: readonly Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "HEAD_MANAGER",
  "SALES_MANAGER",
  "DIRECTOR",
];

export const metadata: Metadata = {
  title: "Права доступу · ENVER CRM",
};

export default async function SettingsPermissionsPage() {
  await requirePermissionForPage(P.ROLES_MANAGE);

  return (
    <SettingsShell
      title="Права доступу"
      description="Матриця ролей і модулів: перегляд, створення, зміна, видалення, експорт, AI та автоматизація."
    >
      <SettingsCard
        title="Політика ролей (канонічна)"
        description="Дефолтні права для нових користувачів задаються в коді; детальніше — role-access-policy.ts."
      >
        <ul className="space-y-3 text-[11px] text-slate-700">
          {ROLES_FOR_POLICY_DOC.map((r) => (
            <li
              key={r}
              className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
            >
              <p className="font-semibold text-[var(--enver-text)]">
                {ROLE_LABELS[r]}{" "}
                <span className="font-normal text-slate-400">({r})</span>
              </p>
              <p className="mt-1 text-slate-600">
                {ROLE_POLICY_SUMMARY_UK[r] ?? "—"}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] text-slate-500">
          Основні ролі для створення облікових записів:{" "}
          {CRM_ROLES_PRIMARY.map((r) => ROLE_LABELS[r]).join(" · ")}.
        </p>
      </SettingsCard>

      <SettingsCard
        title="Ролі та модулі"
        description="Персональні права та пункти меню — у профілі користувача."
      >
        <p className="text-[11px] text-slate-600">
          Ієрархічний доступ до пунктів меню (модуль → підпункти) налаштовується в{" "}
          <Link
            href="/settings/users"
            className="font-medium text-sky-700 underline-offset-2 hover:underline"
          >
            Користувачі та ролі
          </Link>
          : відкрийте користувача → вкладка «Доступ». Список синхронізований з{" "}
          <code className="rounded bg-slate-100 px-1">NAV_SECTIONS</code> у коді.
        </p>
      </SettingsCard>
    </SettingsShell>
  );
}
