import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { ConstructorHubWorkspacePage } from "@/features/production/ui/constructor-hub";
import { getConstructorHubWorkspace } from "@/features/production/server/queries/get-constructor-hub-workspace";

export const metadata: Metadata = {
  title: "Робоча зона конструктора · ENVER CRM",
  description: "Окремий модуль роботи конструктора для підготовки файлів у виробництво.",
};

export default async function ConstructorHubRoute(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const result = await getConstructorHubWorkspace({ id, session });
  if ("reason" in result) {
    if (result.reason === "access_denied") redirect("/access-denied");
    notFound();
  }

  return <ConstructorHubWorkspacePage workspace={result.workspace} />;
}
