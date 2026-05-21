/**
 * Test setup for API integration tests
 *
 * IMPORTANT: All jest.mock() calls MUST be at the top of this file
 * before any other imports to ensure proper mock hoisting in ESM.
 */

// ============================================================================
// Global API Mocks - Must be first for ESM compatibility
// ============================================================================

// Mock the API middleware to bypass authentication
// This allows tests to set req.auth manually without going through real auth
jest.mock('@/server/api/middleware/apiMiddleware', () => ({
  apiMiddleware: (handler: unknown) => handler,
  AuthContext: {},
}));

// Mock api-route-factory to use the mocked middleware
jest.mock('@/utils/api-route-factory', () => {
  const actual = jest.requireActual('@/utils/api-route-factory');
  return {
    ...actual,
    // Override createApiRoute to skip middleware wrapping
    createApiRoute: (config: Record<string, unknown>) => {
      const handlers = config['handlers'] as Record<string, unknown>;
      return async (req: Record<string, unknown>, res: Record<string, unknown>) => {
        const method = req['method'] as string;
        const handler = handlers[method];
        if (!handler) {
          const statusFn = res['status'] as (code: number) => { json: (data: unknown) => void };
          statusFn(405).json({ status: 'error', error: { code: 'METHOD_NOT_ALLOWED' } });
          return;
        }

        // Check auth if required
        if (config['requireAuth'] && !req['auth']) {
          const statusFn = res['status'] as (code: number) => { json: (data: unknown) => void };
          statusFn(401).json({ status: 'error', error: { code: 'UNAUTHORIZED' } });
          return;
        }

        // Validate request body for POST/PUT/PATCH
        const validation = config['validation'] as Record<string, unknown> | undefined;
        if (validation?.[method] && req['body']) {
          const schema = validation[method] as { safeParse: (data: unknown) => { success: boolean; error?: { errors: unknown[] } } };
          const result = schema.safeParse(req['body']);
          if (!result.success) {
            const statusFn = res['status'] as (code: number) => { json: (data: unknown) => void };
            statusFn(400).json({
              status: 'error',
              error: {
                code: 'INTERNAL_ERROR',
                message: result.error?.errors[0] ? String((result.error.errors[0] as Record<string, unknown>)['message']) : 'Validation failed'
              }
            });
            return;
          }
        }

        // Execute handler
        try {
          await (handler as (req: unknown, res: unknown) => Promise<void>)(req, res);
        } catch (error) {
          const statusFn = res['status'] as (code: number) => { json: (data: unknown) => void };
          statusFn(500).json({
            status: 'error',
            error: {
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      };
    },
  };
});

// ============================================================================
// Environment Setup
// ============================================================================

// Set up environment variables - use Object.defineProperty for NODE_ENV
Object.defineProperty(process.env, 'NODE_ENV', {
  value: 'test',
  writable: true,
  enumerable: true,
  configurable: true
});
process.env["DATABASE_URL"] = 'postgresql://test:test@localhost:5432/test';
process.env.AUTH_SECRET = 'test-auth-secret';
process.env["NEXT_PUBLIC_APP_URL"] = 'http://localhost:3000';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Add custom matchers
expect.extend({
  toBeValidApiResponse(received) {
    const pass = 
      received &&
      typeof received === 'object' &&
      'status' in received &&
      ['success', 'error'].includes(received["status"]);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid API response`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid API response with status 'success' or 'error'`,
        pass: false,
      };
    }
  },
  
  toHaveApiError(received, code) {
    const hasError = 
      received &&
      typeof received === 'object' &&
      received["status"] === 'error' &&
      received.error &&
      typeof received.error === 'object';

    if (!hasError) {
      return {
        message: () => `expected ${JSON.stringify(received)} to have an API error`,
        pass: false,
      };
    }

    if (code && received.error.code !== code) {
      return {
        message: () => `expected error code '${received.error.code}' to be '${code}'`,
        pass: false,
      };
    }

    return {
      message: () => `expected ${JSON.stringify(received)} not to have an API error${code ? ` with code '${code}'` : ''}`,
      pass: true,
    };
  },
});

// Extend Jest matchers TypeScript definitions
declare module 'jest' {
  interface Matchers<R> {
    toBeValidApiResponse(): R;
    toHaveApiError(code?: string): R;
  }
}