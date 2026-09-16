import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { Role, UserStatus } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

const dummyHashPromise = hashPassword("not-a-real-account-password!42");

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "development"
      ? "development-only-auth-secret-change-before-production"
      : undefined),
  trustHost: true,
  pages: { signIn: "/" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  providers: [
    Credentials({
      name: "LearnWithLia",
      credentials: {
        kind: { type: "text" },
        identifier: { type: "text" },
        password: { type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { kind, identifier, password } = parsed.data;
        const normalizedIdentifier = identifier.trim().toLowerCase();
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          "unknown";
        const [ipLimit, identifierLimit] = await Promise.all([
          checkRateLimit("login-ip", ip),
          checkRateLimit("login-identifier", `${kind}:${normalizedIdentifier}`),
        ]);
        if (!ipLimit.success || !identifierLimit.success) return null;

        const user =
          kind === "student"
            ? await db.user.findFirst({
                where: {
                  role: Role.STUDENT,
                  studentProfile: { studentNumberNormalized: normalizedIdentifier },
                },
              })
            : await db.user.findFirst({
                where: {
                  role: { in: [Role.OWNER, Role.TEACHER] },
                  emailNormalized: normalizedIdentifier,
                },
              });

        const hashToCheck = user?.passwordHash ?? (await dummyHashPromise);
        const passwordIsValid = await verifyPassword(hashToCheck, password).catch(() => false);
        if (!user || !passwordIsValid || user.status !== UserStatus.ACTIVE || user.archivedAt) {
          return null;
        }

        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    session({ session, token }) {
      const userId = typeof token.userId === "string" ? token.userId : undefined;
      const role = Object.values(Role).find((candidate) => candidate === token.role);
      if (userId && role && typeof token.sessionVersion === "number") {
        session.user.id = userId;
        session.user.role = role;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.sessionVersion = token.sessionVersion;
      }
      return session;
    },
  },
});
