import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { refreshEffectiveUserFields } from "./jwt-effective-user";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  // NextAuth v5-подібна опція; типи v4 можуть не містити поля.
  // @ts-expect-error trustHost для деплою за reverse proxy
  trustHost: true,
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        try {
          const user = await prisma.user.findFirst({
            where: {
              email: {
                equals: email,
                mode: "insensitive",
              },
            },
            include: {
              permissions: { include: { permission: true } },
            },
          });
          if (!user) {
            if (process.env.NODE_ENV === "development") {
               
              console.warn(
                "[auth] Користувача не знайдено:",
                email,
                "— виконайте pnpm db:seed або pnpm db:ensure-admin",
              );
            }
            return null;
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            if (process.env.NODE_ENV === "development") {
               
              console.warn("[auth] Невірний пароль для:", user.email);
            }
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            role: user.role,
            permissionKeys: user.permissions.map((p) => p.permission.key),
          };
        } catch (e) {
          if (process.env.NODE_ENV === "development") {
             
            console.error("[auth] Помилка БД при вході:", e);
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.permissionKeys =
          user.role === "SUPER_ADMIN"
            ? []
            : (user.permissionKeys ?? []);
      }

      if (
        trigger === "update" &&
        session &&
        typeof session === "object" &&
        "impersonateUserId" in session &&
        token.role === "SUPER_ADMIN"
      ) {
        const raw = (session as { impersonateUserId?: string | null })
          .impersonateUserId;
        if (raw === null || raw === "") {
          delete token.impersonateUserId;
        } else if (typeof raw === "string") {
          const id = raw.trim();
          const exists = await prisma.user.findUnique({
            where: { id },
            select: { id: true },
          });
          if (exists) {
            token.impersonateUserId = exists.id;
          }
        }
      }

      try {
        return await refreshEffectiveUserFields(token);
      } catch (e) {
         
        console.error(
          "[auth] refreshEffectiveUserFields не вдалась (вхід без розширених effective*-полів):",
          e,
        );
        return token;
      }
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        const loginId = token.sub;
        const impersonating =
          typeof token.impersonateUserId === "string" &&
          token.impersonateUserId.length > 0;
        const effectiveId = impersonating
          ? (token.impersonateUserId as string)
          : loginId;

        session.user.id = effectiveId;
        session.user.role = (token.effectiveRole ?? token.role) as typeof session.user.role;
        session.user.permissionKeys =
          (token.effectivePermissionKeys as string[] | undefined) ??
          (token.permissionKeys as string[] | undefined) ??
          [];
        session.user.realRole = token.role as typeof session.user.role;
        session.user.impersonatorId = impersonating ? loginId : undefined;
        session.user.menuAccess =
          (token.menuAccess as typeof session.user.menuAccess | undefined) ??
          null;
        if (typeof token.effectiveEmail === "string") {
          session.user.email = token.effectiveEmail;
        }
        if (token.effectiveName !== undefined) {
          session.user.name = token.effectiveName ?? undefined;
        }
      }
      return session;
    },
  },
};
