import {
  ModuleCatchAllPage,
  moduleCatchAllMetadata,
} from "../../_components/ModuleCatchAllPage";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export function generateMetadata(props: PageProps) {
  return moduleCatchAllMetadata({ ...props, baseHref: "/handoff" });
}

export default function HandoffCatchAllPage(props: PageProps) {
  return <ModuleCatchAllPage {...props} baseHref="/handoff" />;
}
