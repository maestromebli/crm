"use client";

import type { ReactNode } from "react";

export function DealOperationalGrid({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="space-y-3">{left}</div>
      <aside className="space-y-3">{right}</aside>
    </section>
  );
}
