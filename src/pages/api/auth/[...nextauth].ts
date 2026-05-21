/**
 * NextAuth v4 API Route
 *
 * This route handles all NextAuth v4 authentication requests.
 *
 * @module pages/api/auth/[...nextauth]
 */
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { UserRole } from '@/hooks/useAuth';
import { prisma } from '@/server/db';
import { eventEmitter } from '@/server/services/eventEmitter';
import { EventType, EventSource } from '@/server/services/events/eventTypes';
import { sanitizeError } from '@/server/utils/log-sanitizer';
import { logSecurityEvent, SecurityEventType } from '@/server/utils/security-logger';
import { logger } from '@/utils/logger';

import type { NextAuthOptions } from "next-auth";
// Type for user data returned from the authorize function
type AuthorizedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
};

// Extended session user type with our custom properties
interface ExtendedSessionUser {
  id?: string | undefined;
  name?: string | null | undefined;
  email?: string | null | undefined;
  image?: string | null | undefined;
  role: UserRole;
  avatar: string | null;
}

// Extended JWT token type with our custom properties
interface ExtendedJWT {
  sub?: string | undefined;
  role?: string | undefined;
  avatar?: string | null | undefined;
  [key: string]: unknown;
}
// Helper to map Prisma UserRole enum to our domain UserRole enum
const mapPrismaRoleToDomain = (prismaRole: unknown): UserRole => {
  const roleStr = String(prismaRole).toLowerCase();
  // Match the string value to our domain UserRole enum (compare lowercase)
  switch (roleStr) {
    case 'admin': return UserRole.ADMIN;
    case 'guest': return UserRole.GUEST;
    case 'user':
    default: return UserRole.USER;
  }
};

// Constants for brute force protection
const LOCKOUT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const MAX_FAILED_ATTEMPTS = 5;

// Types for auth helper functions
interface LoginContext {
  identifier: string;
  ipAddress: string;
  userAgent?: string | undefined;
}

interface UserLoginContext extends LoginContext {
  userId: string;
  userName: string;
  email: string;
  role: string;
}

// Helper: Count failed login attempts
async function getFailedAttemptCount(identifier: string): Promise<number> {
  return prisma.systemEvent.count({
    where: {
      type: 'user.login.failed',
      details: {
        path: ['identifier'],
        equals: identifier
      },
      timestamp: {
        gte: new Date(Date.now() - LOCKOUT_WINDOW_MS)
      }
    }
  });
}

// Helper: Check and handle account lockout
async function handleAccountLockout(
  context: LoginContext,
  failedAttempts: number
): Promise<boolean> {
  if (failedAttempts < MAX_FAILED_ATTEMPTS) {
    return false; // Not locked
  }

  // Log account lockout event
  await eventEmitter.emitWithTracking({
    type: EventType.USER_SUSPICIOUS_ACTIVITY,
    source: EventSource.USER,
    metadata: {
      identifier: context.identifier,
      reason: 'Account temporarily locked due to multiple failed login attempts',
      ipAddress: context.ipAddress,
      failedAttempts,
      lockoutDuration: '30 minutes',
      timestamp: new Date().toISOString()
    }
  });

  logSecurityEvent(SecurityEventType.LOGIN_BLOCKED, {
    username: context.identifier,
    ipAddress: context.ipAddress,
    reason: 'Account temporarily locked due to multiple failed login attempts',
    failedAttempts,
    lockoutDuration: '30 minutes',
    ...(context.userAgent && { userAgent: context.userAgent }),
  });

  logger.warn(`Account lockout triggered for ${context.identifier} from IP ${context.ipAddress}`);
  return true; // Account is locked
}

// Helper: Log failed login attempt
async function logLoginFailure(
  context: LoginContext,
  reason: string,
  userId?: string,
  userName?: string,
  failedAttempts?: number
): Promise<void> {
  const metadata: Record<string, unknown> = {
    identifier: context.identifier,
    reason,
    ipAddress: context.ipAddress,
    timestamp: new Date().toISOString()
  };

  if (userId) {
    metadata['userId'] = userId;
    metadata['userName'] = userName ?? '';
    metadata['failedAttempts'] = (failedAttempts ?? 0) + 1;
    metadata['remainingAttempts'] = Math.max(0, MAX_FAILED_ATTEMPTS - ((failedAttempts ?? 0) + 1));
  }

  await eventEmitter.emitWithTracking({
    type: EventType.USER_LOGIN_FAILED,
    source: EventSource.USER,
    ...(userId && { userId }),
    metadata
  });

  logSecurityEvent(SecurityEventType.LOGIN_FAILED, {
    ...(userId && { userId: parseInt(userId, 10) }),
    username: userName ?? context.identifier,
    ipAddress: context.ipAddress,
    reason,
    ...(context.userAgent && { userAgent: context.userAgent }),
    ...(failedAttempts !== undefined && {
      failedAttempts: failedAttempts + 1,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - (failedAttempts + 1))
    })
  });
}

// Helper: Log successful login
async function logLoginSuccess(context: UserLoginContext): Promise<void> {
  await eventEmitter.emitWithTracking({
    type: EventType.USER_LOGGED_IN,
    source: EventSource.USER,
    userId: context.userId,
    metadata: {
      userId: context.userId,
      userName: context.userName,
      email: context.email,
      role: context.role,
      ipAddress: context.ipAddress,
      timestamp: new Date().toISOString()
    }
  });

  logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
    userId: parseInt(context.userId, 10),
    username: context.userName,
    ipAddress: context.ipAddress,
    ...(context.userAgent && { userAgent: context.userAgent }),
    action: 'login',
  });
}

// Helper: Clear failed login attempts on successful login
async function clearFailedAttempts(identifier: string): Promise<void> {
  await prisma.systemEvent.deleteMany({
    where: {
      type: 'user.login.failed',
      details: {
        path: ['identifier'],
        equals: identifier
      }
    }
  });
}
/**
 * Authentication configuration options for NextAuth
 */
export const authOptions: NextAuthOptions = {
  // Cast PrismaAdapter to fix type incompatibility
  // @ts-ignore - We're handling the adapter type mismatch intentionally
  adapter: PrismaAdapter(prisma),
  providers: [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      identifier: { label: "Username or Email", type: "text" },
      password: { label: "Password", type: "password" }
    },
    // Define the return type of authorize to match NextAuth expectations
    // @ts-ignore - We'll handle the type conversion in the function
    async authorize(credentials, request) {
      if (!credentials?.identifier || !credentials.password) {
        return null;
      }

      try {
        const ipAddress = (request.headers?.['x-forwarded-for'] as string | undefined)
          ?? (request.headers?.['x-real-ip'] as string | undefined)
          ?? 'unknown';
        const userAgent = request.headers?.['user-agent'] as string | undefined;
        const loginContext: LoginContext = {
          identifier: credentials.identifier,
          ipAddress,
          userAgent
        };

        // SECURITY: Brute force protection - Check for account lockout (OWASP A07:2021)
        const failedAttempts = await getFailedAttemptCount(credentials.identifier);
        const isLocked = await handleAccountLockout(loginContext, failedAttempts);
        if (isLocked) {
          return null;
        }

        // Find the user by email or username
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.identifier },
              { userName: credentials.identifier }
            ]
          }
        });

        // If user not found, log failure and return null
        if (!user?.hashedPassword) {
          await logLoginFailure(loginContext, 'User not found');
          return null;
        }

        // Compare passwords
        const passwordMatch = await compare(credentials.password, user.hashedPassword);
        if (!passwordMatch) {
          await logLoginFailure(
            loginContext,
            'Invalid password',
            String(user.id),
            user.userName,
            failedAttempts
          );
          return null;
        }

        // SECURITY: Clear failed login attempts on successful login
        await clearFailedAttempts(credentials.identifier);

        // Record last successful login timestamp
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() }
        });

        // Log successful login
        await logLoginSuccess({
          ...loginContext,
          userId: String(user.id),
          userName: user.userName,
          email: user.email,
          role: String(user.role)
        });

        // Return the user with properly typed data
        return {
          id: String(user.id),
          name: user.userName,
          email: user.email,
          role: String(user.role).toLowerCase(),
          avatar: user.avatar
        };
      } catch (error: unknown) {
        logger.error("Authorization error");
        // SECURITY: Use sanitized error logging to prevent credential leaks
        if (process.env.NODE_ENV !== 'production') {
          logger.debug("Auth error details:", sanitizeError(error));
        }
        return null;
      }
    }
  })],

  session: {
    strategy: "jwt",
    // SECURITY: Reduced from 14 days to 1 day to limit token hijacking window (OWASP A07:2021)
    // Stolen tokens now expire after 24 hours instead of 2 weeks
    maxAge: 24 * 60 * 60, // 1 day (86400 seconds)
    // SECURITY: Refresh token every hour if user is active to maintain session
    updateAge: 60 * 60, // 1 hour (3600 seconds)
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  callbacks: {
    // Add custom user data to session
    // Note: We extend the default session with custom properties
    session({ session, token }) {
      // Cast token to our extended type for type-safe access
      const extendedToken = token as ExtendedJWT;

      // Extract user properties with explicit typing to satisfy strict checks
      // NextAuth guarantees session.user exists in this callback
      const userName: string | null | undefined = session.user.name;
      const userEmail: string | null | undefined = session.user.email;
      const userImage: string | null | undefined = session.user.image;

      // Create extended user object with our custom properties
      const extendedUser: ExtendedSessionUser = {
        id: extendedToken.sub,
        name: userName,
        email: userEmail,
        image: userImage,
        // Use the domain UserRole enum value based on the token role string
        role: extendedToken.role ? mapPrismaRoleToDomain(extendedToken.role) : UserRole.USER,
        avatar: extendedToken.avatar && typeof extendedToken.avatar === 'string' ? extendedToken.avatar : null
      };
      // Return session with extended user - cast to satisfy NextAuth types
      return {
        ...session,
        user: extendedUser
      } as typeof session;
    },
    // Add custom user data to JWT token
    // Note: We extend the default JWT with custom properties
    jwt({ token, user }) {
      // User from credentials provider has role as property
      const authUser = user as AuthorizedUser | undefined;

      // Build extended token without mutating the original
      // Only add custom properties on initial sign-in when user is provided
      const extendedToken: ExtendedJWT = {
        ...token,
        // Preserve existing role/avatar or add new ones from authUser
        role: authUser?.role ?? (token as ExtendedJWT).role,
        avatar: authUser?.avatar !== undefined ? authUser.avatar : (token as ExtendedJWT).avatar
      };

      // Cast to satisfy NextAuth JWT type
      return extendedToken as typeof token;
    }
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  // Require explicit AUTH_DEBUG flag AND development mode for debug
  // SECURITY: Never enable debug in production as it may leak sensitive data
  debug: process.env['AUTH_DEBUG'] === 'true' && process.env.NODE_ENV !== 'production',

  // Custom logger to prevent sensitive data leaks
  logger: {
    error(code, metadata) {
      // Never log metadata in production - may contain sensitive info
      if (process.env.NODE_ENV === 'production') {
        logger.error(`Auth error: ${code}`);
      } else {
        logger.error(`Auth error: ${code}`, { code, metadata });
      }
    },
    warn(code) {
      logger.warn(`Auth warning: ${code}`);
    },
    debug(code, metadata) {
      // Debug logs only in development
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`Auth debug: ${code}`, { code, metadata });
      }
    },
  },
};
// Create NextAuth handler with shared configuration
export default NextAuth(authOptions);