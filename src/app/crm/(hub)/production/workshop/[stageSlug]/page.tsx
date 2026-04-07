import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { WorkshopKanbanClient } from "@/features/production/ui/workshop/WorkshopKanbanClient";
import {
  WORKSHOP_STAGE_LABEL_UK,
  stageKeyFromSlug,
} from "@/features/production/workshop-stages";

type Props = {
  params: Promise<{ stageSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { stageSlug } = await params;
  const key = stageKeyFromSlug(stageSlug);
  if (!key) {
    return { title: "Цеховий Kanban · ENVER CRM" };
  }
  return {
    title: `${WORKSHOP_STAGE_LABEL_UK[key]} · Цех · ENVER CRM`,
    description: `Kanban дільниці «${WORKSHOP_STAGE_LABEL_UK[key]}».`,
  };
}

export default async function WorkshopStagePage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  const { stageSlug } = await params;
  const stageKey = stageKeyFromSlug(stageSlug);
  if (!stageKey) {
    notFound();
  }
  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <WorkshopKanbanClient initialStageKey={stageKey} />
    </main>
  );
}
