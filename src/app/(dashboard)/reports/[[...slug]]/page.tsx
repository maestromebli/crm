import {
  ModuleCatchAllPage,
  moduleCatchAllMetadata,
} from "../../_components/ModuleCatchAllPage";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export function generateMetadata(props: PageProps) {
  return moduleCatchAllMetadata({ ...props, baseHref: "/reports" });
}

export default function ReportsCatchAllPage(props: PageProps) {
  return <ModuleCatchAllPage {...props} baseHref="/reports" />;
}
