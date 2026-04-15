"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[80px] w-full rounded-xl border border-[var(--enver-border)] bg-[var(--enver-input-bg)] px-3 py-2 text-sm text-[var(--enver-text)] shadow-sm shadow-black/25 transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--enver-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enver-accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enver-bg)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

