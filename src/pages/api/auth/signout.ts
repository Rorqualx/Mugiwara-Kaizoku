/**
 * Sign Out API Endpoint
 * 
 * Handles user sign out with NextAuth using the route factory pattern.
 * This is a compatibility endpoint that supports the NextAuth migration.
 * 
 * @module pages/api/auth/signout
 */

import { getServerSession } from 'next-auth/next';

import { eventEmitter } from '@/server/services/eventEmitter';
import { EventType, EventSource } from '@/server/services/events/eventTypes';
import { createApiRoute } from '@/utils/api-route-factory';
import type { ApiResponse } from '@/utils/api-route-factory';

import { authOptions } from './[...nextauth]';


// Type guard for session user
interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

function isSessionUser(user: unknown): user is SessionUser {
  return (
    typeof user === 'object' &&
    user !== null &&
    'id' in user &&
    typeof (user as Record<string, unknown>)['id'] === 'string'
  );
}

// Response type
interface SignOutResponse {
  message: string;
  redirect?: string;
}

const handler = createApiRoute({
  handlers: {
    POST: async (req, res): Promise<void> => {
    // Check if there's an active session
    const session = await getServerSession(req, res, authOptions);
    
    if (!session) {
      // No active session
      return res["status"](200).json({
        status: 'success',
        data: {
          message: 'No active session to sign out from'
        }
      } as ApiResponse<SignOutResponse>);
    }

    // Emit user logged out notification
    if (isSessionUser(session.user)) {
      const xForwardedFor = req.headers['x-forwarded-for'];
      const ipAddress = (typeof xForwardedFor === 'string' ? xForwardedFor : req.socket.remoteAddress) ?? '';

      await eventEmitter.emitWithTracking({
        type: EventType.USER_LOGGED_OUT,
        source: EventSource.USER,
        userId: session.user.id,
        metadata: {
          userId: session.user.id,
          userName: session.user.name ?? '',
          logoutType: 'manual',
          ipAddress
        }
      });
    }

    // For API routes, we can't directly handle the signout
    // We need to return instructions for the client to redirect
    
    // Return success response with redirect instructions
    return res["status"](200).json({
      status: 'success',
      data: {
        message: 'Signed out successfully',
        redirect: '/api/auth/signout'
      }
    } as ApiResponse<SignOutResponse>);
    }
  },
  requireAuth: false // Allow signout even without valid auth (handles expired sessions)
});

export default handler;
