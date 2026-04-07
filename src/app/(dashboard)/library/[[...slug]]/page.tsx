import {
  ModuleCatchAllPage,
  moduleCatchAllMetadata,
} from "../../_components/ModuleCatchAllPage";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export function generateMetadata(props: PageProps) {
  return moduleCatchAllMetadata({ ...props, baseHref: "/library" });
}

export default function LibraryCatchAllPage(props: PageProps) {
  return <ModuleCatchAllPage {...props} baseHref="/library" />;
}
