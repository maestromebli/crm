import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";
import type { MenuAccessState } from "../lib/navigation-access";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      permissionKeys: string[];
      /** UNIX-час (сек) моменту останнього входу. */
      authenticatedAt?: number;
      /** UNIX-час (сек) останньої зафіксованої активності. */
      lastActivityAt?: number;
      /** Обмеження пунктів меню (null = усі підпункти дозволені). */
      menuAccess: MenuAccessState | null;
      /** Роль акаунта, під яким виконано вхід (не змінюється при імпersonації). */
      realRole: Role;
      /** Якщо задано — це id реального SUPER_ADMIN, сесія показує іншого користувача. */
      impersonatorId?: string;
    };
  }

  interface User {
    role: Role;
    permissionKeys: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    permissionKeys?: string[];
    authenticatedAt?: number;
    lastActivityAt?: number;
    sessionExpiredAt?: number;
    impersonateUserId?: string;
    effectiveRole?: Role;
    effectivePermissionKeys?: string[];
    effectiveEmail?: string;
    effectiveName?: string | null;
    menuAccess?: import("../lib/navigation-access").MenuAccessState | null;
  }
}
