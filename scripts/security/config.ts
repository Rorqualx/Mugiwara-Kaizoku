/**
 * Security validation configuration
 */

import type { SecurityConfig, SecretPattern } from './types';

/**
 * Secret detection patterns
 */
export const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'Generic API Key',
    pattern: /(?:api[_-]?key|apikey|api[_-]?secret)[\s]*[=:][\s]*['"]([a-zA-Z0-9_\-]{20,})['"]/gi,
    entropy: 3.5,
    severity: 'critical',
    description: 'Generic API key pattern detected',
  },
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/,
    severity: 'critical',
    description: 'AWS Access Key ID detected',
  },
  {
    name: 'AWS Secret Key',
    pattern: /aws[_-]?secret[_-]?access[_-]?key[\s]*[=:][\s]*['"]([a-zA-Z0-9/+=]{40})['"]/gi,
    severity: 'critical',
    description: 'AWS Secret Access Key detected',
  },
  {
    name: 'GitHub Token',
    pattern: /gh[ps]_[a-zA-Z0-9]{36,}/,
    severity: 'critical',
    description: 'GitHub Personal Access Token detected',
  },
  {
    name: 'JWT Token',
    pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
    severity: 'high',
    description: 'JWT token detected',
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN\s+(?:RSA|EC|OPENSSH|DSA|PGP)\s+PRIVATE\s+KEY-----/,
    severity: 'critical',
    description: 'Private key detected',
  },
  {
    name: 'Database Connection String',
    pattern:
      /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@[^:]+:[0-9]+/,
    severity: 'critical',
    description: 'Database connection string with credentials detected',
  },
  {
    name: 'Generic Password',
    pattern: /(?:password|passwd|pwd)[\s]*[=:][\s]*['"]([^'"\s]{8,})['"]/gi,
    entropy: 3.0,
    severity: 'high',
    description: 'Hardcoded password detected',
  },
  {
    name: 'Generic Secret',
    pattern: /(?:secret|token|auth)[\s]*[=:][\s]*['"]([a-zA-Z0-9_\-]{20,})['"]/gi,
    entropy: 3.5,
    severity: 'high',
    description: 'Generic secret or token detected',
  },
  {
    name: 'Stripe API Key',
    pattern: /sk_live_[a-zA-Z0-9]{24,}/,
    severity: 'critical',
    description: 'Stripe live API key detected',
  },
  {
    name: 'SendGrid API Key',
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/,
    severity: 'critical',
    description: 'SendGrid API key detected',
  },
  {
    name: 'Twilio API Key',
    pattern: /SK[a-f0-9]{32}/,
    severity: 'critical',
    description: 'Twilio API key detected',
  },
  {
    name: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{48}/,
    severity: 'critical',
    description: 'OpenAI API key detected',
  },
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z_-]{35}/,
    severity: 'critical',
    description: 'Google API key detected',
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}/,
    severity: 'critical',
    description: 'Slack token detected',
  },
];

/**
 * Default security configuration
 */
export const DEFAULT_CONFIG: SecurityConfig = {
  secrets: {
    enabled: true,
    excludePaths: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/*.min.js',
      '**/*.map',
      '**/package-lock.json',
      '**/bun.lockb',
      '**/pnpm-lock.yaml',
      '**/.env.example',
      '**/.env.template',
      '**/tests/fixtures/**',
      '**/__mocks__/**',
    ],
    customPatterns: SECRET_PATTERNS,
  },
  dependencies: {
    enabled: true,
    verifyAll: true, // Verify all dependencies, not just new ones
    blockOnCritical: true,
    blockOnHigh: true,
  },
  auth: {
    enabled: true,
    requireProtectedForMutations: true,
    requireOwnershipChecks: true,
    allowlistedPublicMutations: [
      'login',
      'register',
      'forgotPassword',
      'resetPassword',
      'verifyEmail',
    ],
  },
  architecturalDrift: {
    enabled: true,
    forbiddenPatterns: [
      "createHash\\(['\"](md5|sha1)['\"]\\)", // Weak crypto
      'localStorage\\.setItem\\([^,]*token', // Token in localStorage (XSS risk)
      '\\beval\\s*\\(', // eval usage
      'new\\s+Function\\s*\\(', // Function constructor
      'Math\\.random\\(\\).*(?:token|secret|key)', // Math.random for security
      'dangerouslySetInnerHTML', // XSS risk
      "\\$queryRaw`.*\\$\\{", // Unsafe raw SQL with interpolation
      '(?<!bcrypt|argon2).*password.*=.*["\']', // Plaintext password assignment
    ],
    requiredPatterns: [
      // These patterns should exist in auth-related files
      "import.*bcrypt.*from\\s+['\"]bcrypt['\"]", // bcrypt for passwords
      'httpOnly:\\s*true', // httpOnly cookies for auth
    ],
  },
  raceConditions: {
    enabled: true,
    warnOnly: true, // Don't block, just warn
  },
  businessLogic: {
    enabled: true,
    warnOnly: true, // Don't block, just warn
  },
  performance: {
    timeout: 60000, // 60 seconds
    parallelChecks: true,
  },
};

/**
 * Forbidden cryptographic patterns (architectural drift)
 */
export const FORBIDDEN_CRYPTO_PATTERNS = [
  {
    pattern: /createHash\(['"]md5['"]\)/,
    message: 'MD5 is cryptographically broken. Use bcrypt for passwords, SHA-256+ for hashing.',
    severity: 'critical' as const,
  },
  {
    pattern: /createHash\(['"]sha1['"]\)/,
    message: 'SHA-1 is cryptographically broken. Use bcrypt for passwords, SHA-256+ for hashing.',
    severity: 'critical' as const,
  },
  {
    pattern: /Math\.random\(\).*(?:token|secret|key|password)/i,
    message: 'Math.random() is not cryptographically secure. Use crypto.randomBytes().',
    severity: 'critical' as const,
  },
];

/**
 * Forbidden authentication patterns
 */
export const FORBIDDEN_AUTH_PATTERNS = [
  {
    pattern: /localStorage\.setItem\([^,]*['"](?:token|auth|jwt|session)['"]/i,
    message: 'Storing auth tokens in localStorage is vulnerable to XSS. Use httpOnly cookies.',
    severity: 'critical' as const,
  },
  {
    pattern: /sessionStorage\.setItem\([^,]*['"](?:token|auth|jwt|session)['"]/i,
    message: 'Storing auth tokens in sessionStorage is vulnerable to XSS. Use httpOnly cookies.',
    severity: 'high' as const,
  },
];

/**
 * Forbidden code execution patterns
 */
export const FORBIDDEN_CODE_EXEC_PATTERNS = [
  {
    pattern: /\beval\s*\(/,
    message: 'eval() is extremely dangerous and should never be used.',
    severity: 'critical' as const,
  },
  {
    pattern: /new\s+Function\s*\(/,
    message: 'Function constructor is as dangerous as eval(). Avoid dynamic code execution.',
    severity: 'critical' as const,
  },
  {
    pattern: /dangerouslySetInnerHTML/,
    message: 'dangerouslySetInnerHTML can lead to XSS. Sanitize input or use safe alternatives.',
    severity: 'high' as const,
  },
];

/**
 * Required security patterns for auth files
 */
export const REQUIRED_AUTH_FILE_PATTERNS = [
  {
    filePattern: /auth|login|session/i,
    pattern: /import.*(?:bcrypt|argon2)/,
    message: 'Auth files should use bcrypt or argon2 for password hashing',
    severity: 'high' as const,
  },
  {
    filePattern: /auth|login|session/i,
    pattern: /httpOnly:\s*true/,
    message: 'Auth cookies should have httpOnly flag set',
    severity: 'high' as const,
  },
];

/**
 * Package name patterns that indicate hallucination
 */
export const HALLUCINATION_PATTERNS = [
  /.*-helper$/,
  /.*-helpers$/,
  /.*-utils$/,
  /.*-util$/,
  /.*-toolkit$/,
  /.*-tools$/,
  /async-.*-mutex/,
  /.*-starlette-.*/,
  /.*-fastapi-.*/,
  /react-.*-hook$/,
  /next-.*-helper$/,
];

/**
 * File patterns to exclude from various checks
 */
export const EXCLUDE_PATTERNS = {
  secrets: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/*.min.js',
    '**/*.map',
    '**/package-lock.json',
    '**/bun.lockb',
    '**/pnpm-lock.yaml',
    '**/.env.example',
    '**/.env.template',
    '**/tests/fixtures/**',
    '**/__mocks__/**',
    '**/scripts/security/**', // Don't scan our own security scripts
  ],
  auth: [
    '**/node_modules/**',
    '**/tests/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
  ],
  all: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
  ],
};

/**
 * Known safe packages (to reduce false positives in hallucination detection)
 */
export const KNOWN_SAFE_PACKAGES = new Set([
  // Core dependencies
  'react',
  'react-dom',
  'next',
  'typescript',
  '@types/react',
  '@types/node',

  // Common utilities
  'lodash',
  'axios',
  'date-fns',
  'zod',

  // Already in use in this project
  '@tanstack/react-query',
  '@trpc/client',
  '@trpc/server',
  '@trpc/react-query',
  '@trpc/next',
  '@mantine/core',
  '@mantine/hooks',
  '@mantine/form',
  '@mantine/notifications',
  '@prisma/client',
  'prisma',
  'next-auth',
  'bcrypt',
  '@types/bcrypt',
  'socket.io',
  'socket.io-client',
  'pino',
  'zustand',

  // Additional verified packages (added during security testing)
  '@motionone/dom',
  '@types/bcryptjs',
  '@types/jszip',
  'formidable',
  '@types/dompurify',
  '@types/react-window',
  'esbuild-node-externals',
]);

/**
 * CVE severity thresholds
 */
export const CVE_SEVERITY_THRESHOLD = {
  block: ['critical', 'high'],
  warn: ['medium'],
  ignore: ['low', 'info'],
} as const;
