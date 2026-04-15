import { notFound, redirect } from "next/navigation";
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
  canDeleteLeadByRole,
  hasEffectivePermission,
  P,
} from "../../../../lib/authz/permissions";
import { getSessionAccess } from "../../../../lib/authz/session-access";
import { parseLeadsSlug } from "../../../../lib/leads-route";
import {
  buildModulePath,
  pageTitleFromPath,
  resolveNavContext,
} from "../../../../lib/navigation-resolve";

export const dynamic = "force-dynamic";

const LEAD_DETAIL_TABS = new Set([
  "overview",
  "pricing",
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
      dbRole: access.dbRole,
      impersonatorId: access.impersonatorId,
    };
    const canUploadLeadFiles = hasEffectivePermission(
      access.permissionKeys,
      P.FILES_UPLOAD,
      permCtx,
    );
    const canCreateLead = hasEffectivePermission(
      access.permissionKeys,
      P.LEADS_CREATE,
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
        canCreateLead={canCreateLead}
        kpiCounts={kpiCounts ?? undefined}
        showKpiStrip={showKpi && kpiCounts != null}
      />
    );
  }

  if (parsed.kind === "detail") {
    if (parsed.tab === "kp") {
      redirect(`/leads/${parsed.leadId}/pricing`);
    }
    const lead = await getLeadById(parsed.leadId, ctx);
    if (!lead) {
      notFound();
    }
    if (parsed.tab && !LEAD_DETAIL_TABS.has(parsed.tab)) {
      notFound();
    }
    const permCtx = {
      realRole: access.realRole,
      dbRole: access.dbRole,
      impersonatorId: access.impersonatorId,
    };
    const caps = buildLeadDetailCapabilityFlags(access.permissionKeys, permCtx);
    const allowedTabs = buildAllowedLeadTabs(caps);
    if (parsed.tab && !allowedTabs.has(parsed.tab)) {
      redirect(`/leads/${parsed.leadId}`);
    }
    return (
      <LeadDetailView
        lead={lead}
        tab={parsed.tab}
        canUpdateLead={caps.canUpdateLead}
        canDeleteLead={caps.canDeleteLead}
        canViewMessages={caps.canViewMessages}
        canConvertToDeal={caps.canConvertToDeal}
        canViewLeadFiles={caps.canViewLeadFiles}
        canUploadLeadFiles={caps.canUploadLeadFiles}
        canSearchContacts={caps.canSearchContacts}
        canViewTasks={caps.canViewTasks}
        canCreateTasks={caps.canCreateTasks}
        canUpdateTasks={caps.canUpdateTasks}
        canAssignLead={caps.canAssignLead}
        canViewEstimates={caps.canViewEstimates}
        canCreateEstimate={caps.canCreateEstimate}
        canUpdateEstimate={caps.canUpdateEstimate}
        canViewCost={caps.canViewCost}
      />
    );
  }

  notFound();
}

type LeadPermCtx = {
  realRole: string;
  dbRole: string;
  impersonatorId?: string | null;
};

function buildLeadDetailCapabilityFlags(
  permissionKeys: string[],
  permCtx: LeadPermCtx,
) {
  const canDeleteLead = canDeleteLeadByRole(permCtx);
  const canUpdateLead = hasEffectivePermission(
    permissionKeys,
    P.LEADS_UPDATE,
    permCtx,
  );
  return {
    canUpdateLead,
    canDeleteLead,
    canViewMessages: hasEffectivePermission(
      permissionKeys,
      P.NOTIFICATIONS_VIEW,
      permCtx,
    ),
    canConvertToDeal:
      canUpdateLead &&
      hasEffectivePermission(permissionKeys, P.DEALS_CREATE, permCtx),
    canViewLeadFiles: hasEffectivePermission(
      permissionKeys,
      P.FILES_VIEW,
      permCtx,
    ),
    canUploadLeadFiles: hasEffectivePermission(
      permissionKeys,
      P.FILES_UPLOAD,
      permCtx,
    ),
    canSearchContacts: hasEffectivePermission(
      permissionKeys,
      P.CONTACTS_VIEW,
      permCtx,
    ),
    canViewTasks: hasEffectivePermission(permissionKeys, P.TASKS_VIEW, permCtx),
    canCreateTasks: hasEffectivePermission(
      permissionKeys,
      P.TASKS_CREATE,
      permCtx,
    ),
    canUpdateTasks: hasEffectivePermission(
      permissionKeys,
      P.TASKS_UPDATE,
      permCtx,
    ),
    canAssignLead: hasEffectivePermission(
      permissionKeys,
      P.LEADS_ASSIGN,
      permCtx,
    ),
    canViewEstimates: hasEffectivePermission(
      permissionKeys,
      P.ESTIMATES_VIEW,
      permCtx,
    ),
    canCreateEstimate:
      canUpdateLead &&
      hasEffectivePermission(permissionKeys, P.ESTIMATES_CREATE, permCtx),
    canUpdateEstimate:
      canUpdateLead &&
      hasEffectivePermission(permissionKeys, P.ESTIMATES_UPDATE, permCtx),
    canViewCost: hasEffectivePermission(permissionKeys, P.COST_VIEW, permCtx),
  };
}

function buildAllowedLeadTabs(
  caps: ReturnType<typeof buildLeadDetailCapabilityFlags>,
): Set<string> {
  const tabs = new Set<string>(["overview", "contact", "activity", "ai"]);
  if (caps.canViewMessages) tabs.add("messages");
  if (caps.canViewTasks) tabs.add("tasks");
  if (caps.canViewLeadFiles) tabs.add("files");
  if (caps.canViewEstimates) {
    tabs.add("pricing");
  }
  return tabs;
}
