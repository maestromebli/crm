import { getServerSession } from "next-auth";
import { authOptions } from "./options";

export async function getSessionUserId(): Promise<string | null> {
  const s = await getServerSession(authOptions);
  return s?.user?.id ?? null;
}
