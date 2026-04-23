import { permanentRedirect } from "next/navigation";

export default async function ConstructorHubLegacyRoute(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  permanentRedirect(`/crm/constructor/${id}`);
}
