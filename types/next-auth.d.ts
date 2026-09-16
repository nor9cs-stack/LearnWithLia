import type { DefaultSession } from "next-auth";
import type { Role } from "@/app/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    role: Role;
    mustChangePassword: boolean;
    sessionVersion: number;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      mustChangePassword: boolean;
      sessionVersion: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    mustChangePassword?: boolean;
    sessionVersion?: number;
  }
}
