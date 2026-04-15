import { EntitySubnav } from "../../shared/EntitySubnav";
import { ContactActivityTabClient } from "../ContactActivityTabClient";
import { ContactHeader } from "../ContactHeader";
import { ContactOverviewClient } from "../ContactOverviewClient";
import {
  ContactConversationsTab,
  ContactDealsTab,
  ContactFilesTab,
  ContactTasksTab,
} from "./ContactTabs";
import type {
  ContactAttachmentRow,
  ContactDetailRow,
  ContactLeadMessageRow,
  ContactTaskRow,
} from "../../../features/contacts/queries";

export type ContactPageProps = {
  contact: ContactDetailRow;
  tab: string | null;
  messages: ContactLeadMessageRow[];
  tasks: ContactTaskRow[];
  attachments: ContactAttachmentRow[];
  canUpdateContact: boolean;
  canViewMessages: boolean;
  canViewTasks: boolean;
  canViewFiles: boolean;
};

export function ContactPage({
  contact,
  tab,
  messages,
  tasks,
  attachments,
  canUpdateContact,
  canViewMessages,
  canViewTasks,
  canViewFiles,
}: ContactPageProps) {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-[var(--enver-bg)]">
      <ContactHeader contact={contact} />
      <EntitySubnav
        entityId={contact.id}
        kind="contact"
        hiddenTabIds={[
          ...(canViewMessages ? [] : ["conversations"]),
          ...(canViewFiles ? [] : ["files"]),
          ...(canViewTasks ? [] : ["tasks"]),
        ]}
      />
      <div className="mx-auto max-w-7xl px-3 py-4 md:px-6">
        {!tab ? (
          <ContactOverviewClient
            contact={contact}
            canUpdate={canUpdateContact}
          />
        ) : tab === "deals" ? (
          <ContactDealsTab deals={contact.deals} />
        ) : tab === "conversations" && canViewMessages ? (
          <ContactConversationsTab messages={messages} />
        ) : tab === "files" && canViewFiles ? (
          <ContactFilesTab
            attachments={attachments}
            canDownload={canViewFiles}
          />
        ) : tab === "tasks" && canViewTasks ? (
          <ContactTasksTab tasks={tasks} />
        ) : tab === "activity" ? (
          <ContactActivityTabClient contactId={contact.id} />
        ) : null}
      </div>
    </div>
  );
}
