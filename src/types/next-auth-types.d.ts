/**
 * NextAuth Type Extensions
 * 
 * Extends the default NextAuth types to include additional user properties
 * like role and avatar.
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
      role: UserRole;
      avatar?: string;
    } & DefaultSession['user'];
  }

  /**
   * Extends the default user to include custom properties
   */
  interface User {
    role: UserRole;
    avatar?: string;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extends the default JWT to include custom properties
   */
  interface JWT {
    role?: UserRole;
    avatar?: string; 
  }
}
