import type { ReactNode } from "react";

export default function CrmProductionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 bg-gradient-to-b from-slate-100/90 via-slate-50/80 to-white">
      {children}
    </div>
  );
}
