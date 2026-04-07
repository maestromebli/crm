import { redirect } from "next/navigation";
import { getSessionAccess } from "../../../../../lib/authz/session-access";

type PageProps = {
  params: Promise<{ leadId: string }>;
};

/** Смета на ліді тимчасово вимкнена — повертаємо на картку ліда. */
export default async function LeadEstimateHubPage({ params }: PageProps) {
  const access = await getSessionAccess();
  if (!access) redirect("/login");

  const { leadId } = await params;
  redirect(`/leads/${leadId}`);
}
