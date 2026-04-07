"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xl border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-3 py-1 text-sm text-[var(--enver-text)] shadow-sm transition-[border-color,box-shadow] duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--enver-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enver-accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enver-bg)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

