import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ContactsPage } from "../../../../components/contacts/ContactsPage";
import { ContactDetailView } from "../../../../components/contacts/ContactDetailView";
import {
  getContactAttachments,
  getContactById,
  getContactLeadMessages,
  getContactRelatedTasks,
  listContactsByView,
} from "../../../../features/contacts/queries";
import {
  hasEffectivePermission,
  P,
} from "../../../../lib/authz/permissions";
import { getSessionAccess } from "../../../../lib/authz/session-access";
import {
  CONTACT_DETAIL_TABS,
  parseContactsSlug,
} from "../../../../lib/contacts-route";
import {
  buildModulePath,
  pageTitleFromPath,
  resolveNavContext,
} from "../../../../lib/navigation-resolve";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pathname = buildModulePath("/contacts", slug);
  return {
    title: pageTitleFromPath(pathname, "Контакти · ENVER CRM"),
  };
}

export default async function ContactsRoutePage({ params }: PageProps) {
  const { slug } = await params;
  if (slug && slug.length > 2) {
    notFound();
  }

  const access = await getSessionAccess();
  if (!access) {
    redirect("/login");
  }

  const permCtx = {
    realRole: access.realRole,
    impersonatorId: access.impersonatorId,
  };

  const canViewContacts = hasEffectivePermission(
    access.permissionKeys,
    P.CONTACTS_VIEW,
    permCtx,
  );
  if (!canViewContacts) {
    redirect("/crm/dashboard");
  }

  const parsed = parseContactsSlug(slug);

  if (parsed.kind === "list") {
    const { rows, error } = await listContactsByView(parsed.view, access.ctx);
    const listPath =
      parsed.view === "all" ? "/contacts" : `/contacts/${parsed.view}`;
    const navCtx = resolveNavContext(listPath);
    const title = navCtx?.subItem?.label ?? "Контакти";
    const description = navCtx?.subItem?.description;

    return (
      <ContactsPage
        title={title}
        description={description}
        view={parsed.view}
        rows={rows}
        hint={error}
      />
    );
  }

  let tab = parsed.tab;
  if (tab === "overview") {
    tab = null;
  }
  if (tab && !CONTACT_DETAIL_TABS.has(tab)) {
    notFound();
  }

  const contact = await getContactById(parsed.contactId, access.ctx);
  if (!contact) {
    notFound();
  }

  const canUpdateContact = hasEffectivePermission(
    access.permissionKeys,
    P.LEADS_UPDATE,
    permCtx,
  );
  const canViewFiles = hasEffectivePermission(
    access.permissionKeys,
    P.FILES_VIEW,
    permCtx,
  );
  const canViewTasks = hasEffectivePermission(
    access.permissionKeys,
    P.TASKS_VIEW,
    permCtx,
  );
  const canViewMessages = hasEffectivePermission(
    access.permissionKeys,
    P.NOTIFICATIONS_VIEW,
    permCtx,
  );
  const allowedTabs = new Set<string>([
    "overview",
    "deals",
    "activity",
    ...(canViewMessages ? ["conversations"] : []),
    ...(canViewFiles ? ["files"] : []),
    ...(canViewTasks ? ["tasks"] : []),
  ]);
  if (tab && !allowedTabs.has(tab)) {
    redirect(`/contacts/${contact.id}`);
  }

  const [messages, tasks, attachments] = await Promise.all([
    getContactLeadMessages(contact.id, access.ctx),
    getContactRelatedTasks(contact.id, access.ctx),
    getContactAttachments(contact.id, access.ctx),
  ]);

  return (
    <ContactDetailView
      contact={contact}
      tab={tab}
      messages={messages}
      tasks={tasks}
      attachments={attachments}
      canUpdateContact={canUpdateContact}
      canViewMessages={canViewMessages}
      canViewTasks={canViewTasks}
      canViewFiles={canViewFiles}
    />
  );
}
