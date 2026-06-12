/**
 * API Authentication Service
 *
 * Handles API key generation, validation, and permission management.
 *
 * Key design: raw keys are `mk_<64 hex chars>` (256 bits of entropy) and only
 * the SHA-256 digest is persisted. High-entropy keys don't need a slow hash —
 * a deterministic digest allows O(1) `findUnique` lookup instead of scanning
 * every key with bcrypt.compare on each request.
 */
import crypto from 'crypto';

import { prisma } from '@/server/db';
import type { ApiAuth } from '@/types/api/common';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { Prisma } from '@prisma/client';

export interface Permission {
  resource: string;
  actions: string[];
  scope?: string;
}

export interface GeneratedApiKey {
  id: string;
  key: string; // Raw key, only returned on creation
  name: string;
  expiresAt?: Date | null;
  createdAt: Date;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  permissions: Permission[];
  rateLimit: number;
  enabled: boolean;
  expiresAt?: Date | null;
  lastUsedAt?: Date | null;
  createdAt: Date;
}

/** Compute the stored digest for a raw API key */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function toPermission(p: { resource: string; actions: string[]; scope: string | null }): Permission {
  return {
    resource: p.resource,
    actions: p.actions,
    ...(p.scope !== null ? { scope: p.scope } : {})
  };
}

function toPermissionCreateData(p: Permission): { resource: string; actions: string[]; scope?: string } {
  return {
    resource: p.resource,
    actions: p.actions,
    ...(p.scope !== undefined ? { scope: p.scope } : {})
  };
}

function buildApiKeyCreateData(
  userId: string,
  name: string,
  hashedKey: string,
  permissions: Permission[],
  expiresAt?: Date
): Prisma.ApiKeyCreateInput {
  return {
    key: hashedKey,
    name,
    user: { connect: { id: userId } },
    ...(expiresAt !== undefined ? { expiresAt } : {}),
    permissions: { create: permissions.map(toPermissionCreateData) }
  };
}

function asError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

function logServiceError(message: string, error: unknown): void {
  logger.error(message, { error: error instanceof Error ? error.message : String(error) });
}

/**
 * API Authentication Service
 *
 * Manages API keys and permissions
 */
export class ApiAuthService {
  /**
   * Generate a new API key
   */
  async generateApiKey(
    userId: string,
    name: string,
    permissions: Permission[],
    expiresAt?: Date
  ): Promise<AsyncResult<GeneratedApiKey, Error>> {
    try {
      const rawKey = `mk_${crypto.randomBytes(32).toString('hex')}`;
      const apiKey = await prisma.apiKey.create({
        data: buildApiKeyCreateData(userId, name, hashApiKey(rawKey), permissions, expiresAt)
      });
      logger.info(`API key "${name}" created for user ${userId}`);
      return createSuccessResult({
        id: apiKey.id,
        key: rawKey, // Return raw key only once
        name: apiKey.name,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt
      });
    } catch (error: unknown) {
      logServiceError('Failed to generate API key', error);
      return createErrorResult(asError(error, 'Failed to generate API key'));
    }
  }

  /**
   * Validate an API key
   */
  async validateApiKey(rawKey: string): Promise<AsyncResult<ApiAuth, Error>> {
    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: { key: hashApiKey(rawKey) },
        include: {
          user: { select: { id: true, email: true, role: true } },
          permissions: true
        }
      });
      if (!apiKey || !apiKey.enabled) {
        return createErrorResult(new Error('Invalid API key'));
      }
      if (apiKey.expiresAt !== null && apiKey.expiresAt <= new Date()) {
        return createErrorResult(new Error('API key expired'));
      }
      this.touchLastUsed(apiKey.id);
      return createSuccessResult({
        apiKey: apiKey.id,
        userId: apiKey.userId,
        user: {
          id: apiKey.user.id,
          email: apiKey.user.email,
          role: apiKey.user.role
        },
        permissions: apiKey.permissions.map(toPermission)
      });
    } catch (error: unknown) {
      logServiceError('Failed to validate API key', error);
      return createErrorResult(asError(error, 'Failed to validate API key'));
    }
  }

  /** Update last-used without blocking the request path */
  private touchLastUsed(keyId: string): void {
    prisma.apiKey
      .update({ where: { id: keyId }, data: { lastUsedAt: new Date() } })
      .catch((error: unknown) => {
        logServiceError('Failed to update API key lastUsedAt', error);
      });
  }

  /**
   * Check if auth has required permission
   */
  hasPermission(
    auth: ApiAuth,
    resource: string,
    action: string,
    scope?: string
  ): boolean {
    return auth.permissions?.some((p: Permission) => {
      if (p.resource !== resource && p.resource !== '*') return false;
      if (!p.actions.includes(action) && !p.actions.includes('*')) return false;
      if (scope && p.scope && p.scope !== scope) return false;
      return true;
    }) ?? false;
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string, userId: string): Promise<AsyncResult<boolean, Error>> {
    try {
      // Verify ownership
      const apiKey = await prisma.apiKey.findFirst({
        where: { id: keyId, userId }
      });
      if (!apiKey) {
        return createErrorResult(new Error('API key not found'));
      }
      await prisma.apiKey.delete({ where: { id: keyId } });
      logger.info(`API key ${keyId} revoked`);
      return createSuccessResult(true);
    } catch (error: unknown) {
      logServiceError(`Failed to revoke API key ${keyId}`, error);
      return createErrorResult(asError(error, 'Failed to revoke API key'));
    }
  }

  /**
   * List API keys for a user
   */
  async listApiKeys(userId: string): Promise<AsyncResult<ApiKeySummary[], Error>> {
    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: { userId },
        include: { permissions: true },
        orderBy: { createdAt: 'desc' }
      });
      const keys = apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        permissions: key.permissions.map(toPermission),
        rateLimit: key.rateLimit,
        enabled: key.enabled,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt
      }));
      return createSuccessResult(keys);
    } catch (error: unknown) {
      logServiceError('Failed to list API keys', error);
      return createErrorResult(asError(error, 'Failed to list API keys'));
    }
  }

  /**
   * Update API key permissions
   */
  async updateApiKeyPermissions(
    keyId: string,
    userId: string,
    permissions: Permission[]
  ): Promise<AsyncResult<boolean, Error>> {
    try {
      // Verify ownership
      const apiKey = await prisma.apiKey.findFirst({
        where: { id: keyId, userId }
      });
      if (!apiKey) {
        return createErrorResult(new Error('API key not found'));
      }
      const permissionRows = permissions.map((p) => ({ apiKeyId: keyId, ...toPermissionCreateData(p) }));
      await prisma.$transaction([
        prisma.permission.deleteMany({ where: { apiKeyId: keyId } }),
        prisma.permission.createMany({ data: permissionRows })
      ]);
      return createSuccessResult(true);
    } catch (error: unknown) {
      logServiceError(`Failed to update permissions for API key ${keyId}`, error);
      return createErrorResult(asError(error, 'Failed to update API key permissions'));
    }
  }
}

// Export singleton instance
export const apiAuthService = new ApiAuthService();
