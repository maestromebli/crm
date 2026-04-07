import { redirect } from "next/navigation";
import { getSessionAccess } from "../../../../../../../lib/authz/session-access";

type PageProps = {
  params: Promise<{ leadId: string; estimateId: string }>;
};

/** Перегляд версії смети на ліді тимчасово вимкнений — повертаємо на картку ліда. */
export default async function EstimateVersionPreviewPage({ params }: PageProps) {
  const access = await getSessionAccess();
  if (!access) redirect("/login");

  const { leadId } = await params;
  redirect(`/leads/${leadId}`);
}
