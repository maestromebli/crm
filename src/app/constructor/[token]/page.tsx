import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConstructorWorkspaceClient } from "@/features/production/ui/constructor/ConstructorWorkspaceClient";

type Props = { params: Promise<{ token: string }> };

export default async function ConstructorWorkspacePage(props: Props) {
  const { token } = await props.params;
  const tokenPath = `/constructor/${token}`;

  const flow = await prisma.productionFlow.findFirst({
    where: { constructorWorkspaceUrl: { contains: tokenPath } },
    select: {
      id: true,
      number: true,
      clientName: true,
      title: true,
      dueDate: true,
      constructorName: true,
      constructorWorkspaceUrl: true,
      questions: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, text: true, status: true, authorName: true, createdAt: true },
      },
      filePackages: {
        orderBy: { uploadedAt: "desc" },
        take: 10,
        include: { files: true },
      },
    },
  });

  if (!flow) notFound();

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <ConstructorWorkspaceClient
        flow={{
          id: flow.id,
          number: flow.number,
          clientName: flow.clientName,
          title: flow.title,
          dueDate: flow.dueDate?.toISOString() ?? null,
          constructorName: flow.constructorName,
          questions: flow.questions.map((item) => ({
            id: item.id,
            text: item.text,
            status: item.status,
            authorName: item.authorName,
            createdAt: item.createdAt.toISOString(),
          })),
          filePackages: flow.filePackages.map((pkg) => ({
            id: pkg.id,
            packageName: pkg.packageName,
            versionLabel: pkg.versionLabel,
            uploadedAt: pkg.uploadedAt.toISOString(),
            filesCount: pkg.files.length,
          })),
        }}
        token={token}
      />
    </main>
  );
}
