import type { ConstructorWorkspace } from "@prisma/client";
import type { SessionUser } from "@/lib/authz/api-guard";
import {
  hasEffectivePermission,
  isAdminLikeScope,
  P,
} from "@/lib/authz/permissions";

type WorkspaceScope = Pick<ConstructorWorkspace, "assignedConstructorUserId" | "dealId"> & {
  dealOwnerId: string;
};

function isAdminLike(user: SessionUser): boolean {
  return isAdminLikeScope({
    realRole: user.realRole,
    dbRole: user.dbRole,
  });
}

function isProductionLeadLike(user: SessionUser): boolean {
  return (
    user.dbRole === "TEAM_LEAD" ||
    user.dbRole === "HEAD_MANAGER" ||
    user.dbRole === "PROCUREMENT_MANAGER" ||
    hasEffectivePermission(user.permissionKeys, P.PRODUCTION_ORDERS_MANAGE, {
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    }) ||
    hasEffectivePermission(user.permissionKeys, P.PRODUCTION_LAUNCH, {
      realRole: user.realRole,
      impersonatorId: user.impersonatorId,
    })
  );
}

function isSalesOwner(user: SessionUser, workspace: WorkspaceScope): boolean {
  return user.dbRole === "SALES_MANAGER" && workspace.dealOwnerId === user.id;
}

function isAssignedConstructor(user: SessionUser, workspace: WorkspaceScope): boolean {
  return (
    workspace.assignedConstructorUserId === user.id ||
    user.dbRole === "PRODUCTION_WORKER" ||
    user.dbRole === "CUTTING" ||
    user.dbRole === "EDGING" ||
    user.dbRole === "DRILLING" ||
    user.dbRole === "ASSEMBLY" ||
    user.dbRole === "CONSTRUCTOR"
  );
}

export function constructorRoleLabel(user: SessionUser): string {
  if (isAdminLike(user)) return "ADMIN";
  if (isProductionLeadLike(user)) return "HEAD_OF_PRODUCTION";
  if (user.dbRole === "MEASURER") return "MEASURER";
  if (user.dbRole === "SALES_MANAGER") return "SALES_MANAGER";
  if (
    user.dbRole === "PRODUCTION_WORKER" ||
    user.dbRole === "CUTTING" ||
    user.dbRole === "EDGING" ||
    user.dbRole === "DRILLING" ||
    user.dbRole === "ASSEMBLY" ||
    user.dbRole === "CONSTRUCTOR"
  ) {
    return "CONSTRUCTOR";
  }
  return user.dbRole;
}

export function canViewConstructorWorkspace(user: SessionUser, workspace: WorkspaceScope): boolean {
  if (isAdminLike(user) || isProductionLeadLike(user)) return true;
  if (isSalesOwner(user, workspace)) return true;
  return isAssignedConstructor(user, workspace);
}

export function canEditConstructorTechSpec(user: SessionUser, workspace: WorkspaceScope): boolean {
  return isAdminLike(user) || isProductionLeadLike(user);
}

export function canCreateConstructorQuestion(user: SessionUser, workspace: WorkspaceScope): boolean {
  if (!canViewConstructorWorkspace(user, workspace)) return false;
  return isAdminLike(user) || isProductionLeadLike(user) || isSalesOwner(user, workspace) || isAssignedConstructor(user, workspace);
}

export function canAnswerConstructorQuestion(user: SessionUser, workspace: WorkspaceScope): boolean {
  return isAdminLike(user) || isProductionLeadLike(user) || isSalesOwner(user, workspace) || user.dbRole === "MEASURER";
}

export function canUploadConstructorFile(user: SessionUser, workspace: WorkspaceScope): boolean {
  if (!canViewConstructorWorkspace(user, workspace)) return false;
  return isAdminLike(user) || isProductionLeadLike(user) || isAssignedConstructor(user, workspace);
}

export function canSubmitConstructorVersion(user: SessionUser, workspace: WorkspaceScope): boolean {
  return canUploadConstructorFile(user, workspace) && isAssignedConstructor(user, workspace);
}

export function canReviewConstructorVersion(user: SessionUser, workspace: WorkspaceScope): boolean {
  return isAdminLike(user) || isProductionLeadLike(user);
}

export function canApproveConstructorVersion(user: SessionUser, workspace: WorkspaceScope): boolean {
  return isAdminLike(user) || isProductionLeadLike(user);
}

export function canReturnConstructorVersion(user: SessionUser, workspace: WorkspaceScope): boolean {
  return canApproveConstructorVersion(user, workspace);
}

export function canHandoffConstructorWorkspace(user: SessionUser, workspace: WorkspaceScope): boolean {
  return isAdminLike(user) || isProductionLeadLike(user);
}
