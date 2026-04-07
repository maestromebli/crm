"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-[background-color,box-shadow,color,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enver-accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--enver-bg)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--enver-accent)] text-white shadow-sm hover:bg-[#5b4cdb] active:scale-[0.98]",
        enver:
          "bg-[var(--enver-accent)] text-white shadow-md shadow-[var(--enver-accent)]/20 hover:brightness-110 active:scale-[0.98]",
        enverGhost:
          "bg-transparent text-[var(--enver-text-muted)] hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]",
        enverDanger:
          "bg-[var(--enver-danger)]/90 text-white hover:bg-[var(--enver-danger)] active:scale-[0.98]",
        outline:
          "border border-[var(--enver-border)] bg-[var(--enver-surface)] text-[var(--enver-text)] hover:bg-[var(--enver-hover)]",
        ghost:
          "text-[var(--enver-text-muted)] hover:bg-[var(--enver-hover)] hover:text-[var(--enver-text)]",
        secondary:
          "bg-[var(--enver-hover)] text-[var(--enver-text)] hover:bg-[var(--enver-border-strong)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

