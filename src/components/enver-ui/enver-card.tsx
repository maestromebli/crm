import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export type EnverCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Elevated shadow for primary panels */
  elevated?: boolean;
};

/**
 * Standard surface card — rounded-xl, border, dark surface.
 */
export function EnverCard({
  className,
  children,
  elevated,
  ...rest
}: EnverCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)] transition-[box-shadow,border-color] duration-200",
        elevated && "shadow-[var(--enver-shadow-lg)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
