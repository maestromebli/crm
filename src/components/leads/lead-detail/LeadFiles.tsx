"use client";

import type { LeadAttachmentListItem } from "../../../features/leads/queries";
import { LeadFilesTabClient } from "../LeadFilesTabClient";

type LeadFilesProps = {
  leadId: string;
  attachments: LeadAttachmentListItem[];
  canUpload: boolean;
};

export function LeadFiles({
  leadId,
  attachments,
  canUpload,
}: LeadFilesProps) {
  return (
    <LeadFilesTabClient
      leadId={leadId}
      attachments={attachments}
      canUpload={canUpload}
    />
  );
}
