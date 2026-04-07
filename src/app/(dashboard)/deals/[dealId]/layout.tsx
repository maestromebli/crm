import { Suspense } from "react";
import { EntitySubnav } from "../../../../components/shared/EntitySubnav";

type Props = {
  children: React.ReactNode;
  params: Promise<{ dealId: string }>;
};

function DealSubnavFallback() {
  return (
    <div
      className="min-h-[48px] border-b border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80"
      aria-hidden
    />
  );
}

export default async function DealEntityLayout({ children, params }: Props) {
  const { dealId } = await params;
  return (
    <>
      <Suspense fallback={<DealSubnavFallback />}>
        <EntitySubnav entityId={dealId} kind="deal" />
      </Suspense>
      {children}
    </>
  );
}
