import {
  ModuleCatchAllPage,
  moduleCatchAllMetadata,
} from "../../_components/ModuleCatchAllPage";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export function generateMetadata(props: PageProps) {
  return moduleCatchAllMetadata({ ...props, baseHref: "/files" });
}

export default function FilesCatchAllPage(props: PageProps) {
  return <ModuleCatchAllPage {...props} baseHref="/files" />;
}
