/**
 * Mock Service Worker (MSW) Server Setup
 * 
 * Sets up MSW for intercepting HTTP requests during testing.
 * This allows us to mock API responses without needing a real server.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup the mock server with our handlers
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error',
  });
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
});

// Close server after all tests
afterAll(() => {
  server.close();
});