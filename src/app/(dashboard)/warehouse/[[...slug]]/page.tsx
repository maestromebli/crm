import {
  ModuleCatchAllPage,
  moduleCatchAllMetadata,
} from "../../_components/ModuleCatchAllPage";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export function generateMetadata(props: PageProps) {
  return moduleCatchAllMetadata({ ...props, baseHref: "/warehouse" });
}

export default function WarehouseCatchAllPage(props: PageProps) {
  return <ModuleCatchAllPage {...props} baseHref="/warehouse" />;
}
