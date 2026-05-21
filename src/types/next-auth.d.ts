/**
 * NextAuth Type Extensions
 *
 * Extends NextAuth types to include custom user properties.
 */

import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Extends the default session to include custom user properties
   */
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      userName: string;
      role: UserRole;
      avatar?: string | null;
    } & DefaultSession['user'];
  }

  /**
   * Extends the default user to include custom properties
   */
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    userName: string;
    role: UserRole;
    avatar?: string | null;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extends the default JWT to include custom properties
   */
  interface JWT {
    id?: string;
    userName?: string;
    role?: UserRole;
    avatar?: string | null;
  }
}