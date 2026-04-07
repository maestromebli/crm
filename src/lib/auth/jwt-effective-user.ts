import type { JWT } from "next-auth/jwt";

import type { Role } from "@prisma/client";

import { findUserRowWithMenuAccessFallback } from "../users/user-row-with-menu-access";

import { sanitizeMenuAccess } from "../navigation-access";



/**

 * Оновлює поля effective* у JWT за `sub` та опційним `impersonateUserId`.

 * SUPER_ADMIN без імпersonації: не кладемо список усіх прав у токен — це роздуває

 * session cookie (>~4KB) і NextAuth «мовчки» не встановлює сесію (виглядає як невірний пароль).

 */

export async function refreshEffectiveUserFields(token: JWT): Promise<JWT> {

  const loginId = token.sub;

  if (!loginId) return token;



  const impersonateId =

    typeof token.impersonateUserId === "string"

      ? token.impersonateUserId

      : undefined;



  const effectiveId = impersonateId ?? loginId;



  const row = await findUserRowWithMenuAccessFallback({ id: effectiveId });



  if (!row) {

    if (impersonateId) delete token.impersonateUserId;

    return token;

  }



  const loginRole = token.role as Role | undefined;



  token.effectiveRole = row.role;

  token.effectiveEmail = row.email;

  token.effectiveName = row.name;



  if (loginRole === "SUPER_ADMIN" && !impersonateId) {

    token.effectivePermissionKeys = [];

    token.permissionKeys = [];

    token.menuAccess = null;

    return token;

  }



  const keys = row.permissions.map((p) => p.permission.key as string);

  token.effectivePermissionKeys = keys;

  token.menuAccess =
    row.role === "ADMIN"
      ? null
      : (sanitizeMenuAccess(row.menuAccess) ?? null);



  return token;

}


