"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { tryReadResponseJson } from "@/lib/http/read-response-json";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [hostHint, setHostHint] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [capsLockOn, setCapsLockOn] = useState(false);

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

  const completion = ((emailValue.trim() ? 1 : 0) + (passwordValue ? 1 : 0)) / 2;

  return (
    <form className="login-auth-form space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold leading-tight text-[var(--enver-text)]">
          Ласкаво просимо!
        </h2>
        <p className="text-sm text-slate-500">
          Увійдіть у систему для продовження роботи
        </p>
        <div className="space-y-1.5 pt-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-300"
              style={{ width: `${completion * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Заповнення форми: {Math.round(completion * 100)}%
          </p>
        </div>
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

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              className="login-auth-input block w-full rounded-lg border border-slate-200 bg-[var(--enver-card)] py-2 pl-3 pr-10 text-sm text-[var(--enver-text)] shadow-sm outline-none transition"
              placeholder="Введіть email"
            />
            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700"
          >
            Пароль
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={passwordVisible ? "text" : "password"}
              autoComplete="current-password"
              required
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
              onKeyDown={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
              className="login-auth-input block w-full rounded-lg border border-slate-200 bg-[var(--enver-card)] py-2 pl-3 pr-16 text-sm text-[var(--enver-text)] shadow-sm outline-none transition"
              placeholder="Введіть пароль"
            />
            <Lock className="pointer-events-none absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <button
              type="button"
              onClick={() => setPasswordVisible((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label={passwordVisible ? "Сховати пароль" : "Показати пароль"}
            >
              {passwordVisible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {capsLockOn ? (
            <p className="text-[11px] text-amber-600">Caps Lock увімкнено</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <label className="inline-flex cursor-pointer items-center gap-2 text-slate-500">
          <input
            type="checkbox"
            name="remember"
            className="h-3.5 w-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
          />
          <span>Запам&apos;ятати мене</span>
        </label>
        <button
          type="button"
          className="text-amber-500 transition hover:text-amber-400"
        >
          Забули пароль?
        </button>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="login-auth-submit inline-flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
      >
        {pending ? "Вхід…" : "Увійти"}
      </button>

      <p className="text-[11px] text-slate-400">
        Заходячи в систему, ви погоджуєтесь з{" "}
        <Link
          href="/terms"
          className="underline underline-offset-2 hover:text-slate-600"
        >
          умовами використання
        </Link>{" "}
        та{" "}
        <Link
          href="/privacy"
          className="underline underline-offset-2 hover:text-slate-600"
        >
          політикою конфіденційності
        </Link>
        .
      </p>

      <p className="text-center text-[11px] text-slate-500">
        © 2026 <span className="text-amber-500">ENVER</span> CRM-ERP System OS.
        Усі права захищено.
      </p>
    </form>
  );
}
