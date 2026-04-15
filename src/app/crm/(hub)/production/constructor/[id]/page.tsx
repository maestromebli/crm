import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { ConstructorHubWorkspacePage } from "@/features/production/ui/constructor-hub";
import {
  getConstructorHubWorkspace,
  getConstructorHubWorkspaceDemo,
} from "@/features/production/server/queries/get-constructor-hub-workspace";

export const metadata: Metadata = {
  title: "Рабочая зона конструктора · ENVER CRM",
  description: "Операционный workspace конструктора для подготовки файлов к производству.",
};

export default async function ConstructorHubRoute(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  if (id === "demo") {
    const workspace = getConstructorHubWorkspaceDemo({ id, session });
    return <ConstructorHubWorkspacePage workspace={workspace} />;
  }

  const result = await getConstructorHubWorkspace({ id, session });
  if ("reason" in result) {
    if (result.reason === "access_denied") redirect("/access-denied");
    notFound();
  }

  return <ConstructorHubWorkspacePage workspace={result.workspace} />;
}
