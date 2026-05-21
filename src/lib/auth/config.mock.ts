/**
 * Authentication Configuration (Mock)
 * 
 * This is a simplified mock version of the auth configuration for use during build
 * to prevent dependency errors with bcrypt and other native dependencies.
 */

// Import Auth.js types for compatibility
import { UserRole } from '@prisma/client';
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";


import type { ExtendedSession} from './types';
import type { Session} from "next-auth";
import type { JWT } from "next-auth/jwt";

// Mock PrismaAdapter
const MockPrismaAdapter = (): Record<string, () => Promise<unknown>> => {
  return {
    createUser: () => Promise.resolve({}),
    getUser: () => Promise.resolve({}),
    getUserByEmail: () => Promise.resolve({}),
    getUserByAccount: () => Promise.resolve({}),
    updateUser: () => Promise.resolve({}),
    deleteUser: () => Promise.resolve({}),
    linkAccount: () => Promise.resolve({}),
    unlinkAccount: () => Promise.resolve({}),
    createSession: () => Promise.resolve({}),
    getSessionAndUser: () => Promise.resolve(null),
    updateSession: () => Promise.resolve({}),
    deleteSession: () => Promise.resolve({}),
    createVerificationToken: () => Promise.resolve({}),
    useVerificationToken: () => Promise.resolve({}),
  };
};

// Helper to ensure role is valid UserRole
const ensureUserRole = (role: unknown): UserRole => {
  if (typeof role === 'string') {
    const upperRole = role.toUpperCase();
    switch (upperRole) {
      case 'ADMIN':
        return UserRole.ADMIN;
      case 'USER':
      default:
        return UserRole.USER;
    }
  }

  // Handle enum values
  if (role === UserRole.ADMIN) {
    return UserRole.ADMIN;
  }
  return UserRole.USER;
};

/**
 * Main authentication configuration options
 */
export const authConfig = {
  // Use mock adapter
   
  adapter: MockPrismaAdapter() as unknown,

  // Configure authentication providers
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        identifier: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      authorize() {
        // Mock authorize function that always returns null in build environment
        return null;
      }
    })
  ],
  
  // Configure session handling
  session: {
    // @ts-ignore - Type compatibility between Auth.js versions
    strategy: "jwt" as const, // Use JWT for easier integration with existing code
    maxAge: 14 * 24 * 60 * 60, // 14 days (reduced from 30 for security)
  },
  
  // Custom pages
  pages: {
    signIn: "/login",
    error: "/login",
  },
  
  // Callbacks to customize authentication behavior
  callbacks: {
    // Add custom user data to session with type-safety
    // @ts-ignore - Type compatibility between Auth.js versions
    session({ session, token }: { session: Session; token: JWT }): ExtendedSession {
      // Cast session to properly typed object to avoid TypeScript errors with custom fields
      const typedSession = { ...session } as ExtendedSession;

      // Type-safe session user modifications
      if (token.sub !== undefined) {
        typedSession.user["id"] = token.sub;
      }

      // Add role to session with proper type handling
      if (token.role !== undefined) {
        // Map role string to UserRole enum value using the utility function
        typedSession.user.role = ensureUserRole(token.role);
      }

      // Add additional user data with type safety
      if (token.avatar !== undefined && typeof token.avatar === 'string') {
        typedSession.user.avatar = token.avatar;
      }

      return typedSession;
    },
    
    // Add custom user data to JWT token with type safety
    // @ts-ignore - Type compatibility between Auth.js versions
    jwt({ token, user }: { token: JWT; user?: unknown }): JWT {
      // Create a new token object to avoid mutation
      const newToken = { ...token };

      // Add user data to token when first signing in
      if (user && typeof user === 'object') {
        const userRecord = user as Record<string, unknown>;
        // Store role as proper Prisma UserRole enum value
        if (userRecord["role"]) {
          const lowerRole = String(userRecord["role"]).toLowerCase();
          // Match string role to appropriate UserRole
          switch (lowerRole.toUpperCase()) {
            case 'ADMIN':
              newToken.role = UserRole.ADMIN;
              break;
            case 'USER':
            default:
              newToken.role = UserRole.USER;
              break;
          }
        } else {
          newToken.role = UserRole.USER; // Default role
        }
        // Use undefined instead of null for avatar if it doesn't exist
        const avatar = userRecord["avatar"] as string | undefined;
        if (avatar !== undefined) {
          newToken.avatar = avatar;
        }
      }

      return newToken;
    }
  },
  
  // Security options
  secret: "mock-secret-for-build",
  debug: false,
};

// Export for backwards compatibility
export const authOptions = authConfig;

/**
 * Mock auth function that always returns null
 */
export function auth(): Promise<ExtendedSession | null> {
  return Promise.resolve(null);
}

// Create Auth.js v5 handler with typed parameters
// @ts-ignore - Type compatibility between Auth.js versions (adapter types don't match exactly)
const authHandler = NextAuth(authConfig) as unknown;

// Export handlers and auth actions for use in actions.ts
export const { handlers, signIn, signOut } = authHandler as {
  handlers: unknown;
  signIn: unknown;
  signOut: unknown;
};

// Export the auth handler as default for API route
export default authHandler;