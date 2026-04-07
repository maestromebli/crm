import type { Metadata } from "next";
import { ModuleWorkspace } from "../../../components/module/ModuleWorkspace";
import {
  buildModulePath,
  pageTitleFromPath,
} from "../../../lib/navigation-resolve";

type Props = {
  params: Promise<{ slug?: string[] }>;
  baseHref: string;
};

export async function moduleCatchAllMetadata({
  params,
  baseHref,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const pathname = buildModulePath(baseHref, slug);
  return {
    title: pageTitleFromPath(pathname, "ENVER CRM"),
  };
}

export async function ModuleCatchAllPage({ params, baseHref }: Props) {
  const { slug } = await params;
  const pathname = buildModulePath(baseHref, slug);
  return <ModuleWorkspace pathname={pathname} />;
}
