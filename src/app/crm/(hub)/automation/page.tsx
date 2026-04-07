import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { AutomationBuilderClient } from "./AutomationBuilderClient";

export const metadata: Metadata = {
  title: "Automation Engine · ENVER CRM",
  description: "Візуальні автоматизації для Deal-centric процесу.",
};

export default async function AutomationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return <AutomationBuilderClient />;
}
