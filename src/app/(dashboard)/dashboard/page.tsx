import { redirect } from "next/navigation";

/**
 * Канонічний операційний дашборд — `/crm/dashboard`.
 */
export default function DashboardLegacyRedirect() {
  redirect("/crm/dashboard");
}
