import type { ReactNode } from "react";

export function DealHubLayout(props: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside className="space-y-3">{props.left}</aside>
      <main className="space-y-3">{props.center}</main>
      <aside className="space-y-3">{props.right}</aside>
    </div>
  );
}
