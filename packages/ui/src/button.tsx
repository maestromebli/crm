"use client";

import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";
import { clsx } from "clsx";

type ButtonProps = DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> & {
  variant?: "primary" | "outline";
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const styles =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-900"
      : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 focus-visible:ring-slate-200";

  return <button className={clsx(base, styles, className)} {...props} />;
}

