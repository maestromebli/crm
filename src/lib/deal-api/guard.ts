import { NextResponse } from "next/server";
import { requireSessionUser } from "../authz/api-guard";

/** @deprecated Використовуйте {@link requireSessionUser} + перевірки прав. */
export async function requireSessionUserId(): Promise<
  string | NextResponse
> {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  return user.id;
}
