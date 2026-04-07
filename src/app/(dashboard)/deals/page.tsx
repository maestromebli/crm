import { DealsListPage, dealsRootMetadata } from "./_components/DealsListPage";

export const metadata = dealsRootMetadata;

export default function DealsIndexPage() {
  return <DealsListPage view="all" />;
}
