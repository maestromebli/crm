import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/options";

/**
 * Єдина кешована точка читання server session в межах одного RSC-запиту.
 * Це прибирає дубльовані звернення до сесії з layout/page/helper.
 */
export const getCachedServerSession = cache(() => getServerSession(authOptions));
