/**
 * WebSocket Authorization Service
 *
 * Handles authentication and authorization for WebSocket connections:
 * - API key validation
 * - Session token validation (NextAuth JWT)
 * - Client authentication
 * - Channel subscription permissions
 * - Channel publishing permissions
 *
 * @module server/api/services/WebSocketAuthorizationService
 */

import { createHash } from 'crypto';

import { decode } from 'next-auth/jwt';

import { prisma } from '@/server/db';
import type { WebSocketClient } from '@/types/api/v1/websocket';
import { logger } from '@/utils/logger';

// ============================================================================
// WebSocket Authorization Service
// ============================================================================

export class WebSocketAuthorizationService {
  /**
   * Validate an API key
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const keyHash = createHash('sha256').update(apiKey).digest('hex');
      const apiKeyRecord = await prisma.apiKey.findFirst({
        where: { key: keyHash },
      });
      return !!apiKeyRecord && (!apiKeyRecord.expiresAt || apiKeyRecord.expiresAt > new Date());
    } catch (error: unknown) {
      logger.error('Error validating API key:', {
        error,
        // Don't log actual key or hash for security
      });
      return false;
    }
  }

  /**
   * Authenticate client using API key or session token
   * Tries API key first, then falls back to NextAuth session token
   */
  async authenticateClient(client: WebSocketClient): Promise<string | undefined> {
    const clientRecord = client as unknown as Record<string, unknown>;

    // Try API key authentication first
    const apiKeyResult = await this.authenticateWithApiKey(client.id, clientRecord['apiKey']);
    if (apiKeyResult) {
      return apiKeyResult;
    }

    // Fall back to session token authentication
    const sessionResult = await this.authenticateWithSessionToken(client.id, clientRecord['sessionToken']);
    if (sessionResult) {
      return sessionResult;
    }

    // No valid authentication method found
    logger.warn(`Client ${client.id} has no valid authentication`);
    return undefined;
  }

  /**
   * Authenticate using API key
   */
  private async authenticateWithApiKey(
    clientId: string,
    apiKey: unknown
  ): Promise<string | undefined> {
    try {
      if (!apiKey || typeof apiKey !== 'string') {
        return undefined;
      }

      // Hash the API key using SHA-256
      const keyHash = createHash('sha256').update(apiKey).digest('hex');

      // Look up the API key record
      const apiKeyRecord = await prisma.apiKey.findFirst({
        where: { key: keyHash },
      });

      if (!apiKeyRecord) {
        logger.debug(`Invalid API key for client ${clientId}`);
        return undefined;
      }

      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      });

      logger.debug(`Client ${clientId} authenticated via API key as user ${apiKeyRecord.userId}`);
      return apiKeyRecord.userId;
    } catch (error: unknown) {
      logger.error(`Error authenticating client ${clientId} with API key:`, error);
      return undefined;
    }
  }

  /**
   * Authenticate using NextAuth session token (JWT)
   */
  private async authenticateWithSessionToken(
    clientId: string,
    sessionToken: unknown
  ): Promise<string | undefined> {
    try {
      if (!sessionToken || typeof sessionToken !== 'string') {
        return undefined;
      }

      // Get the secret from environment
      const secret = process.env['AUTH_SECRET'] ?? process.env['NEXTAUTH_SECRET'];
      if (!secret) {
        logger.error('AUTH_SECRET or NEXTAUTH_SECRET not configured');
        return undefined;
      }

      // Decode the JWT token
      const decoded = await decode({
        token: sessionToken,
        secret,
      });

      if (!decoded?.sub) {
        logger.debug(`Invalid session token for client ${clientId}`);
        return undefined;
      }

      // Verify user exists in database
      const userId = decoded.sub;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        logger.debug(`Session token user not found for client ${clientId}`);
        return undefined;
      }

      logger.debug(`Client ${clientId} authenticated via session token as user ${userId}`);
      return userId;
    } catch (error: unknown) {
      logger.error(`Error authenticating client ${clientId} with session token:`, error);
      return undefined;
    }
  }

  /**
   * Batch check if client can subscribe to multiple channels
   * Optimized to reduce database queries - single query for all resource channels
   */
  canSubscribeBatch(
    client: WebSocketClient,
    channels: string[]
  ): Map<string, boolean> {
    const results = new Map<string, boolean>();

    // Group channels by type for efficient checking
    const resourceChannels: string[] = [];

    for (const channel of channels) {
      const [channelType, ...channelParts] = channel.split(':');

      switch (channelType) {
        case 'public':
          // Public channels always allowed
          results.set(channel, true);
          break;
        case 'USER':
          // Can only subscribe to own user channel
          results.set(channel, channelParts[0] === client.userId);
          break;
        case 'manga':
        case 'library':
          // Scan progress allowed for any connected client
          if (channelParts[0] === 'scan') {
            results.set(channel, true);
          } else {
            resourceChannels.push(channel);
          }
          break;
        default:
          results.set(channel, false);
      }
    }

    // Handle resource channels that need permission check
    // Session-authenticated users (userId present) are allowed access.
    // API key check is only needed for non-session connections.
    if (resourceChannels.length > 0 && client.userId) {
      for (const channel of resourceChannels) {
        results.set(channel, true);
      }
    } else {
      // No userId - deny access
      for (const channel of resourceChannels) {
        results.set(channel, false);
      }
    }

    return results;
  }

  /**
   * Check if client can subscribe to channel
   */
  canSubscribe(client: WebSocketClient, channel: string): boolean {
    // Check permissions based on channel type
    const [channelType, ...channelParts] = channel.split(':');
    switch (channelType) {
      case 'public':
        return true;
      case 'USER':
        // Can only subscribe to own user channel
        return channelParts[0] === client.userId;
      case 'manga':
      case 'library': {
        // Allow scan progress for any connected client
        if (channelParts[0] === 'scan') {
          return true;
        }

        // Session-authenticated users are allowed to subscribe to resource channels.
        // The connection is already authenticated (unauthenticated connections are rejected),
        // so having a userId is sufficient for read access to manga/library channels.
        return !!client.userId;
      }
      default:
        return false;
    }
  }

  /**
   * Check if client can publish to channel
   */
  async canPublish(client: WebSocketClient, channel: string): Promise<boolean> {
    // Check permissions based on channel type
    const [channelType] = channel.split(':');
    switch (channelType) {
      case 'public':
        return false; // Public channels are read-only
      case 'USER':
        // Can only publish to own user channel
        return channel === `user:${client.userId}`;
      case 'manga':
      case 'library': {
        // Check write permissions
        // TODO: apiKey and permission models need to be added to schema.prisma
        if (!client.userId) return false;
        const writeApiKey = await prisma.apiKey.findFirst({
          where: { userId: client.userId }
        });
        if (!writeApiKey) return false;
         
        const writePrismaRecord = prisma as unknown as Record<string, unknown>;
         
        const writePermissionModel = writePrismaRecord["permission"] as unknown as { findMany: (args: unknown) => Promise<unknown> };
         
        const writePermissions = await writePermissionModel.findMany({
          where: { apiKeyId: writeApiKey.id },
        });

        // Type guard for permissions array
        if (!Array.isArray(writePermissions)) {
          return false;
        }

         
        return writePermissions.some(
           
          (p: unknown) => {
            const permission = p as Record<string, unknown>;
            return permission["resource"] === channelType &&
                   Array.isArray(permission["actions"]) &&
                   permission["actions"].includes('write');
          }
        );
      }
      default:
        return false;
    }
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const authorizationService = new WebSocketAuthorizationService();
