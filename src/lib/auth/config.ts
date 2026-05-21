/**
 * Authentication Configuration
 * 
 * Core Auth.js v4 configuration for secure authentication.
 * Implements session management, credential validation, and role-based access control.
 */

// Move imports to the top before usage
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import NextAuth, { getServerSession as nextAuthGetServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/server/db";
import { logger } from '@/utils/logger';


import type { ExtendedSession} from './types';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";

/**
 * Main authentication configuration options
 */
export const authConfig = {
  // Use real PrismaAdapter for database integration
  // @ts-ignore - Type compatibility between Auth.js versions
  adapter: PrismaAdapter(prisma),
  
  // Configure authentication providers
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        identifier: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      // @ts-ignore - Type compatibility between Auth.js versions
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials.password) {
          return null;
        }
        
        try {
          // Find the user by email or username
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: credentials.identifier },
                { userName: credentials.identifier }
              ]
            }
          });
          
          // If user not found, return null
          if (!user?.hashedPassword) {
            return null;
          }
          
          // Compare passwords
          const passwordMatch = await compare(
            credentials.password,
            user.hashedPassword
          );
          
          // If password doesn't match, return null
          if (!passwordMatch) {
            return null;
          }
          
          // Return the user for authentication
          return {
            id: user["id"],
            name: user.userName,
            email: user.email,
            role: user.role,
            avatar: user.avatar
          };
        } catch (error: unknown) {
          logger.error("Authorization error");
          if (process.env.NODE_ENV !== 'production') {
            logger.debug("Auth details:", error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error));
          }
          return null;
        }
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
    session({ session, token }: { session: unknown; token: { sub?: string; role?: string; avatar?: unknown } }): Promise<ExtendedSession> {
      // Add user data to session with proper type handling
      const sessionWithUser = session as { user?: { id?: string; role?: string; avatar?: string } };
      if (sessionWithUser.user) {
        // Add user ID from token
        if (token.sub) {
          sessionWithUser.user["id"] = token.sub;
        }

        // Add role to session
        if (token.role) {
          sessionWithUser.user.role = token.role;
        }

        // Add avatar if available
        if (token.avatar && typeof token.avatar === 'string') {
          sessionWithUser.user.avatar = token.avatar;
        }
      }

      return Promise.resolve(sessionWithUser as ExtendedSession);
    },

    // Add custom user data to JWT token
    // @ts-ignore - Type compatibility between Auth.js versions
    jwt({ token, user }: { token: { role?: string; avatar?: unknown }; user?: { role?: string; avatar?: unknown } }): Promise<{ role?: string; avatar?: unknown }> {
      // Create a new token object to avoid mutation
      const newToken = { ...token };

      // Add user data to token when first signing in
      if (user) {
        if (user.role !== undefined) {
          newToken.role = user.role;
        }
        if (user.avatar !== undefined) {
          newToken.avatar = user.avatar;
        }
      }

      return Promise.resolve(newToken);
    }
  },
  
  // Security options - require proper environment variables
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== 'production',
};

// Export for backwards compatibility
export const authOptions = authConfig;

/**
 * Auth function that provides session access for server-side and API routes
 */
export async function auth(
  req?: NextApiRequest | GetServerSidePropsContext['req'],
  res?: NextApiResponse | GetServerSidePropsContext['res']
): Promise<ExtendedSession | null> {
  try {
    // Use getServerSession from next-auth with proper error handling
    // For Pages Router, we need to pass req, res, and authConfig
    // @ts-ignore - Type compatibility between Auth.js versions
    const session = await nextAuthGetServerSession(req, res, authConfig);
    
    // If no session, return null
    if (!session) {
      return null;
    }
    
    // Cast session to ExtendedSession type with safety checks
    const extendedSession = session as ExtendedSession;

    // Ensure the session has a user with proper role
    // Role is already a UserRole enum from the token

    return extendedSession;
  } catch (error: unknown) {
    logger.error('Auth function error:', error);
    return null;
  }
}

// Create Auth.js handler and export it
// @ts-ignore - Type compatibility between Auth.js versions (adapter types don't match exactly)
const authHandler = NextAuth(authConfig) as unknown;

// Export the auth handler as default for API route
export default authHandler;

// Export signIn and signOut functions for server-side usage
// These are mock implementations since NextAuth v4 doesn't provide these as separate functions
export function signIn(): Promise<never> {
  // In NextAuth v4, signIn is handled via the API route
  // This is a placeholder for compatibility
  return Promise.reject(new Error('signIn should be used through the API route /api/auth/signin'));
}

export function signOut(): Promise<never> {
  // In NextAuth v4, signOut is handled via the API route
  // This is a placeholder for compatibility
  return Promise.reject(new Error('signOut should be used through the API route /api/auth/signout'));
}