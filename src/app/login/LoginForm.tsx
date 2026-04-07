"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { tryReadResponseJson } from "@/lib/http/read-response-json";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [hostHint, setHostHint] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/auth/config");
        const j = await tryReadResponseJson<{ nextAuthUrl?: string | null }>(r);
        const configured = j?.nextAuthUrl?.trim();
        if (!configured || cancelled) return;
        const cfg = new URL(configured);
        const here = `${window.location.protocol}//${window.location.host}`;
        const cfgOrigin = `${cfg.protocol}//${cfg.host}`;
        if (cfgOrigin !== here) {
          setHostHint(
            `Відкрито ${here}, а в .env.local задано NEXTAUTH_URL=${configured}. Для NextAuth це різні сайти — вхід часто падає. Відкрийте саме ${cfgOrigin}/login або змініть NEXTAUTH_URL і перезапустіть pnpm dev.`,
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setPending(false);
    if (res?.error) {
      let extra = "";
      if (process.env.NODE_ENV === "development") {
        try {
          const ar = await fetch("/api/debug/auth-status");
          const d = await tryReadResponseJson<{
            hasDatabaseUrl?: boolean;
            dbOk?: boolean;
            adminUserFound?: boolean;
            adminPasswordAdmin123?: boolean;
            prismaError?: string | null;
          }>(ar);
          if (d) {
            extra = ` [dev] БД: url=${d.hasDatabaseUrl ? "є" : "немає"}, звʼязок=${d.dbOk ? "ok" : "ні"}, admin=${d.adminUserFound ? "є" : "немає"}, пароль admin123=${d.adminPasswordAdmin123 ? "ok" : "ні"}${d.prismaError ? `, помилка: ${d.prismaError}` : ""}`;
          }
        } catch {
          /* ignore */
        }
      }
      setError(
        "Невірний email або пароль, або зламався крок входу (CSRF / JWT). Перевірте admin@enver.com / admin123. Також: у .env.local той самий DATABASE_URL + перезапуск pnpm dev; pnpm db:check-admin." +
          extra,
      );
      return;
    }
    window.location.href = "/crm/dashboard";
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold leading-tight text-[var(--enver-text)]">
          Увійти в ENVER CRM
        </h2>
        <p className="text-xs text-slate-500">
          Керуйте лідами, проєктами та виробництвом з єдиного робочого місця.
        </p>
      </div>

      {hostHint ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          {hostHint}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-medium text-slate-700"
          >
            Ел. пошта
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue="admin@enver.com"
            className="block w-full rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3 py-2 text-sm text-[var(--enver-text)] shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="admin@enver.com"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-xs font-medium text-slate-700"
          >
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            defaultValue="admin123"
            className="block w-full rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3 py-2 text-sm text-[var(--enver-text)] shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="••••••••"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-slate-900/20 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 disabled:opacity-60"
      >
        {pending ? "Вхід…" : "Увійти"}
      </button>

      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <div className="mb-1 font-medium text-slate-600">
          Облікові записи (після seed)
        </div>
        <div className="flex flex-col gap-1">
          <span>
            <strong>Адміністратор:</strong>{" "}
            <code className="rounded bg-[var(--enver-card)] px-1">admin@enver.com</code> /{" "}
            <code className="rounded bg-[var(--enver-card)] px-1">admin123</code>
            <span className="text-slate-400"> — повний доступ</span>
          </span>
          <span>
            <strong>Демо:</strong>{" "}
            <code className="rounded bg-[var(--enver-card)] px-1">demo@enver.local</code> /{" "}
            <code className="rounded bg-[var(--enver-card)] px-1">demo123</code>
          </span>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        Заходячи в систему, ви погоджуєтесь з{" "}
        <Link
          href="#"
          className="underline underline-offset-2 hover:text-slate-600"
        >
          умовами використання
        </Link>{" "}
        та{" "}
        <Link
          href="#"
          className="underline underline-offset-2 hover:text-slate-600"
        >
          політикою конфіденційності
        </Link>
        .
      </p>
    </form>
  );
}
