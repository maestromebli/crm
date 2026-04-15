"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { emitRobotEmotion } from "./robotEmotion";

type Props = {
  devHint?: string;
};

export function LoginForm({ devHint }: Props) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-5"
      method="post"
      action="/api/auth/callback/credentials"
      onSubmit={() => {
        startTransition(() => {
          setError(null);
        });
        emitRobotEmotion("loading");
      }}
      onInvalid={() => emitRobotEmotion("sad")}
    >
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-semibold tracking-tight text-white">
            EN
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            ENVER CRM-ERP SYSTEM
          </span>
        </div>
        <h2 className="text-lg font-semibold leading-tight text-slate-900">
          Увійти в ENVER CRM
        </h2>
        <p className="text-xs text-slate-500">
          Керуйте лідами, проектами та виробництвом з єдиного робочого місця.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            onFocus={() => emitRobotEmotion("thinking")}
            onChange={() => emitRobotEmotion("thinking")}
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="manager@enver.com"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label
              htmlFor="password"
              className="font-medium text-slate-700"
            >
              Пароль
            </label>
            <button
              type="button"
              onClick={() => setPasswordVisible((v) => !v)}
              className="text-[11px] text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            >
              {passwordVisible ? "Сховати" : "Показати"}
            </button>
          </div>
          <input
            id="password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            required
            onFocus={() => emitRobotEmotion("thinking")}
            onChange={() => emitRobotEmotion("thinking")}
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="••••••••"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            name="remember"
            onChange={() => emitRobotEmotion("wink")}
            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Запам’ятати мене на цьому пристрої</span>
        </label>
        <button
          type="button"
          className="cursor-not-allowed text-slate-400"
          aria-disabled="true"
        >
          Забули пароль?
        </button>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-slate-900/20 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Вхід..." : "Увійти"}
      </button>

      {devHint ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          <div className="mb-1 font-medium text-slate-600">
            Режим розробки
          </div>
          <div className="flex flex-col gap-0.5">
            <span>Email: <code className="rounded bg-white px-1">admin@enver.com</code></span>
            <span>Пароль: <code className="rounded bg-white px-1">admin123</code></span>
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-slate-400">
        Заходячи в систему, ви погоджуєтесь з{" "}
        <Link href="#" className="underline underline-offset-2 hover:text-slate-600">
          умовами використання
        </Link>{" "}
        та{" "}
        <Link href="#" className="underline underline-offset-2 hover:text-slate-600">
          політикою конфіденційності
        </Link>
        .
      </p>
    </form>
  );
}

