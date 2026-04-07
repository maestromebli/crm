import type { Metadata } from "next";
import { NAV_SECTIONS } from "../../../../config/navigation";
import { getTargetWorkspaceSnapshot } from "../../../../features/target/data/repository";
import { TargetShell } from "../../../../features/target/TargetShell";
import { TargetViewBody } from "../../../../features/target/target-panels";
import { resolveTargetRoute } from "../../../../features/target/target-route";
import {
  buildModulePath,
  pageTitleFromPath,
  resolveNavContext,
} from "../../../../lib/navigation-resolve";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pathname = buildModulePath("/target", slug);
  return {
    title: pageTitleFromPath(pathname, "Таргет · ENVER CRM"),
  };
}

export default async function TargetModulePage({ params }: PageProps) {
  const { slug } = await params;
  const { view, pathname } = resolveTargetRoute(slug);
  const snapshot = await getTargetWorkspaceSnapshot();
  const ctx = resolveNavContext(pathname);

  const title =
    view === "invalid"
      ? "Сторінку не знайдено"
      : (ctx?.subItem?.label ?? ctx?.section.label ?? "Таргет");

  const description =
    view === "invalid"
      ? "Перевірте адресу або поверніться до огляду таргету."
      : (ctx?.subItem?.description ??
        "Кампанії, витрати, креативи та ліди з реклами Meta в одному блоці.");

  const section = NAV_SECTIONS.find((s) => s.id === "target");
  const tabs =
    section?.subItems?.map((s) => ({ href: s.href, label: s.label })) ?? [];

  return (
    <TargetShell title={title} description={description} tabs={tabs}>
      <TargetViewBody view={view} snapshot={snapshot} />
    </TargetShell>
  );
}
