import type { Metadata } from "next";
import { InboxShell } from "../../../../features/inbox/components/InboxShell";
import {
  buildModulePath,
  pageTitleFromPath,
} from "../../../../lib/navigation-resolve";
import { inboxRouteConfig } from "../../../../lib/inbox-route";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pathname = buildModulePath("/inbox", slug);
  return {
    title: pageTitleFromPath(pathname, "Вхідні · ENVER CRM"),
  };
}

export default async function InboxPage({ params }: PageProps) {
  const { slug } = await params;
  const { initialTab, channelFilter } = inboxRouteConfig(slug);

  return (
    <main className="flex min-h-[calc(100vh-56px)] flex-col bg-slate-50 px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col rounded-2xl border border-slate-200 bg-[var(--enver-card)]/90 shadow-sm shadow-slate-900/5">
        <InboxShell
          initialTab={initialTab}
          channelFilter={channelFilter}
        />
      </div>
    </main>
  );
}
