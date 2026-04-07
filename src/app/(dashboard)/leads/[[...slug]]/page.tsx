import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LeadDetailView } from "../../../../components/leads/LeadDetailView";
import { LeadsPage as LeadsListView } from "../../../../components/leads/LeadsPage";
import { LeadsPipelineView } from "../../../../components/leads/LeadsPipelineView";
import {
  getLeadById,
  getLeadKpiCounts,
  listLeadsByView,
} from "../../../../features/leads/queries";
import { canViewLeadsKpiStrip } from "../../../../lib/leads/lead-kpi-eligibility";
import {
  hasEffectivePermission,
  P,
} from "../../../../lib/authz/permissions";
import { getSessionAccess } from "../../../../lib/authz/session-access";
import { parseLeadsSlug } from "../../../../lib/leads-route";
import { redirect } from "next/navigation";
import {
  buildModulePath,
  pageTitleFromPath,
  resolveNavContext,
} from "../../../../lib/navigation-resolve";

const LEAD_DETAIL_TABS = new Set([
  "overview",
  "pricing",
  "kp",
  "contact",
  "messages",
  "tasks",
  "files",
  "activity",
  "ai",
]);

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pathname = buildModulePath("/leads", slug);
  return {
    title: pageTitleFromPath(pathname, "Ліди · ENVER CRM"),
  };
}

export default async function LeadsPage({ params }: PageProps) {
  const { slug } = await params;
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  const { ctx, userId } = access;

  if (slug?.[0] === "import") {
    redirect("/leads");
  }

  const parsed = parseLeadsSlug(slug);

  if (parsed.kind === "list") {
    if (parsed.view === "pipeline") {
      return <LeadsPipelineView />;
    }

    const { rows, error } = await listLeadsByView(
      parsed.view,
      ctx,
      parsed.view === "mine" ? { mineUserId: userId } : undefined,
    );
    const listPath =
      parsed.view === "all" ? "/leads" : `/leads/${parsed.view}`;
    const navCtx = resolveNavContext(listPath);
    const title = navCtx?.subItem?.label ?? "Ліди";
    const description = navCtx?.subItem?.description;
    const permCtx = {
      realRole: access.realRole,
      impersonatorId: access.impersonatorId,
    };
    const canUploadLeadFiles = hasEffectivePermission(
      access.permissionKeys,
      P.FILES_UPLOAD,
      permCtx,
    );

    const showKpi =
      parsed.view === "all" && canViewLeadsKpiStrip(access.realRole);
    const kpiCounts = showKpi ? await getLeadKpiCounts(ctx) : null;

    return (
      <LeadsListView
        title={title}
        description={description}
        view={parsed.view}
        rows={rows}
        hint={error}
        canUploadLeadFiles={canUploadLeadFiles}
        kpiCounts={kpiCounts ?? undefined}
        showKpiStrip={showKpi && kpiCounts != null}
      />
    );
  }

  if (parsed.kind === "detail") {
    const lead = await getLeadById(parsed.leadId, ctx);
    if (!lead) {
      notFound();
    }
    if (parsed.tab && !LEAD_DETAIL_TABS.has(parsed.tab)) {
      notFound();
    }
    const permCtx = {
      realRole: access.realRole,
      impersonatorId: access.impersonatorId,
    };
    const canUpdateLead = hasEffectivePermission(
      access.permissionKeys,
      P.LEADS_UPDATE,
      permCtx,
    );
    const canConvertToDeal =
      canUpdateLead &&
      hasEffectivePermission(
        access.permissionKeys,
        P.DEALS_CREATE,
        permCtx,
      );
    const canUploadLeadFiles = hasEffectivePermission(
      access.permissionKeys,
      P.FILES_UPLOAD,
      permCtx,
    );
    const canSearchContacts = hasEffectivePermission(
      access.permissionKeys,
      P.CONTACTS_VIEW,
      permCtx,
    );
    const canViewTasks = hasEffectivePermission(
      access.permissionKeys,
      P.TASKS_VIEW,
      permCtx,
    );
    const canCreateTasks = hasEffectivePermission(
      access.permissionKeys,
      P.TASKS_CREATE,
      permCtx,
    );
    const canUpdateTasks = hasEffectivePermission(
      access.permissionKeys,
      P.TASKS_UPDATE,
      permCtx,
    );
    const canAssignLead = hasEffectivePermission(
      access.permissionKeys,
      P.LEADS_ASSIGN,
      permCtx,
    );
    const canViewEstimates = hasEffectivePermission(
      access.permissionKeys,
      P.ESTIMATES_VIEW,
      permCtx,
    );
    const canCreateEstimate =
      canUpdateLead &&
      hasEffectivePermission(
        access.permissionKeys,
        P.ESTIMATES_CREATE,
        permCtx,
      );
    const canUpdateEstimate =
      canUpdateLead &&
      hasEffectivePermission(
        access.permissionKeys,
        P.ESTIMATES_UPDATE,
        permCtx,
      );
    const canViewCost = hasEffectivePermission(
      access.permissionKeys,
      P.COST_VIEW,
      permCtx,
    );
    return (
      <LeadDetailView
        lead={lead}
        tab={parsed.tab}
        canUpdateLead={canUpdateLead}
        canConvertToDeal={canConvertToDeal}
        canUploadLeadFiles={canUploadLeadFiles}
        canSearchContacts={canSearchContacts}
        canViewTasks={canViewTasks}
        canCreateTasks={canCreateTasks}
        canUpdateTasks={canUpdateTasks}
        canAssignLead={canAssignLead}
        canViewEstimates={canViewEstimates}
        canCreateEstimate={canCreateEstimate}
        canUpdateEstimate={canUpdateEstimate}
        canViewCost={canViewCost}
      />
    );
  }

  notFound();
}
