/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  // Use jsdom for UI tests (React components, E2E tests)
  // Server-side tests can override with @jest-environment node
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.+(ts|tsx|js)',
    '**/__tests__/**/*.spec.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/src/pages/',  // API routes are not test files
    '<rootDir>/tests/e2e/',  // Playwright E2E tests (run separately with npx playwright test)
    '<rootDir>/tests/server/services/auto-labeling/',  // Bun-native suites (import bun:test) - run via `bun run test:bun`
    '<rootDir>/src/hooks/__tests__/useSuwayomiDownloads.test.tsx',  // Memory leak issue - TODO: fix
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@auth/prisma-adapter|@happy-dom|happy-dom|msw|@mswjs|@bundled-es-modules|until-async|strict-event-emitter|statuses)/)',
  ],
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/test/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  }
};