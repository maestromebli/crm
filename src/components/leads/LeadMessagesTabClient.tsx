"use client";

import { useRouter } from "next/navigation";
import { CommunicationHub } from "../../features/communication/ui/CommunicationHub";
import { LeadMessengerFloatingDock } from "./LeadMessengerFloatingDock";
import { LeadMessengerPanel } from "./LeadMessengerPanel";
import { useLeadMessengerThread } from "./useLeadMessengerThread";

type Props = {
  leadId: string;
  canPost: boolean;
};

export function LeadMessagesTabClient({ leadId, canPost }: Props) {
  const router = useRouter();
  const messenger = useLeadMessengerThread(leadId);

  return (
    <div className="space-y-10">
      <LeadMessengerPanel {...messenger} />
      <LeadMessengerFloatingDock {...messenger} />

      <section className="border-t border-slate-200 pt-8" aria-labelledby="lead-comm-hub-heading">
        <h2
          id="lead-comm-hub-heading"
          className="mb-1 text-base font-semibold text-[var(--enver-text)]"
        >
          Комунікація та нотатки
        </h2>
        <p className="mb-4 text-[12px] text-slate-600">
          Треди за каналами, внутрішні нотатки та AI — окремо від основного чату
          зверху.
        </p>
        <CommunicationHub
          leadId={leadId}
          canPostNotes={canPost}
          onPostedInternalNote={() => router.refresh()}
        />
      </section>
    </div>
  );
}
