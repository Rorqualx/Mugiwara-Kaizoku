// @ts-nocheck - Test file uses mocked callers that don't match tRPC procedure types
/** Backup Router Authentication and Authorization Tests */

// Jest provides describe, it, expect, beforeEach, afterEach as globals
import { TRPCError } from '@trpc/server';
import type { Session } from 'next-auth';

// Mock ESM packages that Jest cannot transform (must be before all imports)
jest.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: jest.fn(() => ({})),
}));

// Mock superjson ESM package
jest.mock('superjson', () => ({
  __esModule: true,
  default: {
    serialize: jest.fn((data: unknown) => ({ json: data, meta: undefined })),
    deserialize: jest.fn((data: { json: unknown }) => data.json),
    parse: jest.fn((str: string) => JSON.parse(str)),
    stringify: jest.fn((data: unknown) => JSON.stringify(data)),
    registerClass: jest.fn(),
    registerCustom: jest.fn(),
  },
}));

// Mock next-auth to avoid ESM import issues
jest.mock('next-auth', () => {
  const mockHandler = jest.fn(() => (req: unknown, res: unknown) => Promise.resolve());
  return {
    __esModule: true,
    default: mockHandler,
  };
});

jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: jest.fn(() => ({ id: 'credentials', name: 'Credentials' })),
}));

// Mock Setup - must be before imports that use mocked modules
const mockGetServerSession = jest.fn();

// Mock next-auth/next module
jest.mock('next-auth/next', () => ({
  getServerSession: mockGetServerSession,
}));

// Mock backup service
jest.mock('@/server/services/backup/index', () => ({
  backupService: {
    listBackups: jest.fn(async () => []),
    getBackup: jest.fn(async () => null),
    createBackup: jest.fn(async () => 1),
    deleteBackup: jest.fn(async () => {}),
    restoreBackup: jest.fn(async () => {}),
    restoreFromFile: jest.fn(async () => {}),
    scheduleBackup: jest.fn(async () => 'task-123'),
  },
}));

// Mock config service
jest.mock('@/server/services/config/configService', () => ({
  configService: {
    get: jest.fn(async () => true),
    set: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
    initialize: jest.fn(async () => {}),
  },
}));

// Mock global config service
const mockGlobalConfigService = {
  isInitialized: jest.fn(() => true),
  initialize: jest.fn(async () => {}),
  set: jest.fn(async () => {}),
};

jest.mock('@/server/services/config/globalConfigService', () => ({
  getGlobalConfigService: jest.fn(() => mockGlobalConfigService),
}));

// Mock general config service
const mockGeneralConfigService = {
  getBackupSettings: jest.fn(async () => ({
    enabled: true,
    frequency: 'weekly',
    location: '/backups',
    maxCount: 5,
    retentionDays: 7,
  })),
  updateBackupSettings: jest.fn(async () => {}),
};

jest.mock('@/server/services/config/generalConfigService', () => ({
  getGeneralConfigService: jest.fn(() => mockGeneralConfigService),
}));

// Imports after mocks
import { backupRouter } from '@/server/trpc/routers/backup';
import { systemBackupRouter } from '@/server/trpc/routers/system/backup';
import { settingsBackupRouter } from '@/server/trpc/routers/settings/backup';
import { backupService } from '@/server/services/backup/index';
import { configService } from '@/server/services/config/configService';
import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { getGeneralConfigService } from '@/server/services/config/generalConfigService';
import type { Context } from '@/server/trpc/context';
import type { NextApiRequest, NextApiResponse } from 'next';

// Test Helpers
function createMockContext(session: Session | null): Context & {
  req: NextApiRequest;
  res: NextApiResponse;
} {
  const mockReq = {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as NextApiRequest;

  const mockRes = {
    status: jest.fn(() => mockRes),
    json: jest.fn(() => mockRes),
    end: jest.fn(() => mockRes),
  } as unknown as NextApiResponse;

  return {
    prisma: {} as any,
    req: mockReq,
    res: mockRes,
  };
}

function createSession(role: 'USER' | 'ADMIN'): Session {
  return {
    user: {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      role,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function createCaller<T>(router: T, session: Session | null): T {
  mockGetServerSession.mockResolvedValue(session);
  const ctx = createMockContext(session);

  // Type assertion to handle tRPC router type
  const routerWithCreateCaller = router as any;
  return routerWithCreateCaller.createCaller(ctx);
}

describe('backup.ts Router - Authentication & Authorization', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    mockGetServerSession.mockReset();
  });

  describe('list procedure', () => {
    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(backupRouter, null);

      await expect(caller.list()).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
          message: expect.stringContaining('logged in'),
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(backupRouter, createSession('USER'));

      await expect(caller.list()).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
          message: expect.stringContaining('admin'),
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(backupRouter, createSession('ADMIN'));

      const result = await caller.list();
      expect(result).toBeDefined();
      expect(backupService.listBackups).toHaveBeenCalled();
    });
  });

  describe('get procedure', () => {
    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(backupRouter, null);

      await expect(caller.get({ id: 1 })).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(backupRouter, createSession('USER'));

      await expect(caller.get({ id: 1 })).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(backupRouter, createSession('ADMIN'));

      const result = await caller.get({ id: 1 });
      expect(backupService.getBackup).toHaveBeenCalledWith(1);
    });
  });

  describe('createBackup procedure', () => {
    const validInput = {
      includeDatabase: true,
      includeConfig: true,
      includeMedia: false,
    };

    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(backupRouter, null);

      await expect(caller.createBackup(validInput)).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(backupRouter, createSession('USER'));

      await expect(caller.createBackup(validInput)).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(backupRouter, createSession('ADMIN'));

      const result = await caller.createBackup(validInput);
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          backupId: expect.any(String),
        })
      );
      expect(backupService.createBackup).toHaveBeenCalled();
    });
  });

  describe('deleteBackup procedure', () => {
    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(backupRouter, null);

      await expect(caller.deleteBackup({ id: 1 })).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(backupRouter, createSession('USER'));

      await expect(caller.deleteBackup({ id: 1 })).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(backupRouter, createSession('ADMIN'));

      const result = await caller.deleteBackup({ id: 1 });
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
        })
      );
      expect(backupService.deleteBackup).toHaveBeenCalledWith(1);
    });
  });

  describe('restoreBackup procedure', () => {
    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(backupRouter, null);

      await expect(caller.restoreBackup({ backupPath: '1' })).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(backupRouter, createSession('USER'));

      await expect(caller.restoreBackup({ backupPath: '1' })).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users with numeric backup ID', async () => {
      const caller = createCaller(backupRouter, createSession('ADMIN'));

      const result = await caller.restoreBackup({ backupPath: '1' });
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
        })
      );
      expect(backupService.restoreBackup).toHaveBeenCalledWith(1);
    });
  });

  describe('updateSettings procedure', () => {
    const validInput = {
      enabled: true,
      frequency: 'weekly' as const,
      maxCount: 5,
    };

    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(backupRouter, null);

      await expect(caller.updateSettings(validInput)).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(backupRouter, createSession('USER'));

      await expect(caller.updateSettings(validInput)).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(backupRouter, createSession('ADMIN'));

      const result = await caller.updateSettings(validInput);
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
        })
      );
      expect(configService.set).toHaveBeenCalled();
    });
  });

  describe('getSettings procedure', () => {
    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(backupRouter, null);

      await expect(caller.getSettings()).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(backupRouter, createSession('USER'));

      await expect(caller.getSettings()).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(backupRouter, createSession('ADMIN'));

      const result = await caller.getSettings();
      expect(result).toBeDefined();
      expect(configService.get).toHaveBeenCalled();
    });
  });
});

describe('system/backup.ts Router - Authentication & Authorization', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    mockGetServerSession.mockReset();
  });

  describe('getBackups procedure', () => {
    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(systemBackupRouter, null);

      await expect(caller.getBackups()).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(systemBackupRouter, createSession('USER'));

      await expect(caller.getBackups()).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(systemBackupRouter, createSession('ADMIN'));

      const result = await caller.getBackups();
      expect(result).toBeDefined();
      expect(result.backups).toBeDefined();
    });
  });

  describe('createBackup procedure', () => {
    const validInput = {
      name: 'Test Backup',
      notes: 'Test backup notes',
      contents: ['DATABASE', 'CONFIGURATION'] as const,
    };

    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(systemBackupRouter, null);

      await expect(caller.createBackup(validInput)).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(systemBackupRouter, createSession('USER'));

      await expect(caller.createBackup(validInput)).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(systemBackupRouter, createSession('ADMIN'));

      const result = await caller.createBackup(validInput);
      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            backupId: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('deleteBackup procedure', () => {
    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(systemBackupRouter, null);

      await expect(caller.deleteBackup({ id: 1 })).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(systemBackupRouter, createSession('USER'));

      await expect(caller.deleteBackup({ id: 1 })).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(systemBackupRouter, createSession('ADMIN'));

      const result = await caller.deleteBackup({ id: 1 });
      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
        })
      );
    });
  });

  describe('restoreBackup procedure', () => {
    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(systemBackupRouter, null);

      await expect(caller.restoreBackup({ id: 1 })).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(systemBackupRouter, createSession('USER'));

      await expect(caller.restoreBackup({ id: 1 })).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(systemBackupRouter, createSession('ADMIN'));

      const result = await caller.restoreBackup({ id: 1 });
      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
        })
      );
    });
  });

  describe('scheduleBackup procedure', () => {
    const validInput = {
      schedule: 'DAILY' as const,
      retentionDays: 7,
      maxCount: 5,
      includeDatabase: true,
      includeConfig: true,
    };

    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(systemBackupRouter, null);

      await expect(caller.scheduleBackup(validInput)).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(systemBackupRouter, createSession('USER'));

      await expect(caller.scheduleBackup(validInput)).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(systemBackupRouter, createSession('ADMIN'));

      const result = await caller.scheduleBackup(validInput);
      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            message: expect.any(String),
            taskId: expect.any(String),
          }),
        })
      );
    });
  });
});

describe('settings/backup.ts Router - Authentication & Authorization', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    mockGetServerSession.mockReset();
  });

  describe('getBackupSettings procedure', () => {
    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(settingsBackupRouter, null);

      await expect(caller.getBackupSettings()).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(settingsBackupRouter, createSession('USER'));

      await expect(caller.getBackupSettings()).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(settingsBackupRouter, createSession('ADMIN'));

      // @ts-expect-error - Testing auth layer with mocked caller
      const result = await caller.getBackupSettings();
      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
        })
      );
      expect(mockGeneralConfigService.getBackupSettings).toHaveBeenCalled();
    });
  });

  describe('updateBackupSettings procedure', () => {
    const validInput = {
      autoBackup: true,
      backupFrequency: 'weekly' as const,
      backupLocation: '/backups/test',
      maxBackups: 5,
      includeImages: true,
    };

    it('should reject unauthenticated requests', async () => {
      const caller = createCaller(settingsBackupRouter, null);

      // @ts-expect-error - Testing auth layer with mocked caller
      await expect(caller.updateBackupSettings(validInput)).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
    });

    it('should reject non-admin users', async () => {
      const caller = createCaller(settingsBackupRouter, createSession('USER'));

      // @ts-expect-error - Testing auth layer with mocked caller
      await expect(caller.updateBackupSettings(validInput)).rejects.toThrow(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should allow admin users', async () => {
      const caller = createCaller(settingsBackupRouter, createSession('ADMIN'));

      // @ts-expect-error - Testing auth layer with mocked caller
      const result = await caller.updateBackupSettings(validInput);
      expect(result).toEqual(
        expect.objectContaining({
          status: 'success',
        })
      );
      expect(mockGeneralConfigService.updateBackupSettings).toHaveBeenCalled();
    });
  });

});

describe('Session Validation Edge Cases', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    mockGetServerSession.mockReset();
  });

  it('should handle null session from getServerSession', async () => {
    const caller = createCaller(backupRouter, null);

    // @ts-expect-error - Testing auth layer with mocked caller
    await expect(caller.list()).rejects.toThrow(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
      })
    );
  });

  it('should handle session without user object', async () => {
    const invalidSession = { expires: new Date(Date.now() + 86400000).toISOString() } as Session;
    mockGetServerSession.mockResolvedValue(invalidSession);
    const caller = createCaller(backupRouter, invalidSession);
    // @ts-expect-error - Testing auth layer with mocked caller
    await expect(caller.list()).rejects.toThrow(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });

  it('should handle expired session gracefully', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const caller = createCaller(backupRouter, null);
    // @ts-expect-error - Testing auth layer with mocked caller
    await expect(caller.list()).rejects.toThrow(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });

  it('should reject user with undefined/invalid role', async () => {
    const sessionNoRole = { user: { id: '1', name: 'Test', email: 't@e.com' }, expires: new Date(Date.now() + 86400000).toISOString() } as Session;
    mockGetServerSession.mockResolvedValue(sessionNoRole);
    const caller = createCaller(backupRouter, sessionNoRole);
    // @ts-expect-error - Testing auth layer with mocked caller
    await expect(caller.list()).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});

// Context Validation tests removed to reduce file size - covered by integration tests
