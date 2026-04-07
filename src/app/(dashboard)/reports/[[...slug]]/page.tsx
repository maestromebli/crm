import {
  ModuleCatchAllPage,
  moduleCatchAllMetadata,
} from "../../_components/ModuleCatchAllPage";
import { AiV2InsightCard } from "../../../../features/ai-v2";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export function generateMetadata(props: PageProps) {
  return moduleCatchAllMetadata({ ...props, baseHref: "/reports" });
}

export default function ReportsCatchAllPage(props: PageProps) {
  return (
    <div className="space-y-3">
      <AiV2InsightCard context="dashboard" />
      <ModuleCatchAllPage {...props} baseHref="/reports" />
    </div>
  );
}
