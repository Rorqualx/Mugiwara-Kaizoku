/** @jest-environment node */
/**
 * Seed/admin scripts: no published default credentials, no accidental
 * production runs. Also pins the compose file's database exposure.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface SeedCredentials {
  assertSeedAllowed(scriptName: string, env?: Record<string, string | undefined>): void;
  resolveSecret(envName: string, env?: Record<string, string | undefined>): { value: string; generated: boolean };
  describeSecret(envName: string, secret: { value: string; generated: boolean }): string;
}

const ROOT = join(__dirname, '..', '..');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS helper shared with plain-JS scripts
const seedCredentials = require('../../scripts/lib/seed-credentials.cjs') as SeedCredentials;

const SEED_SCRIPTS = [
  'scripts/database/seed-dev.js',
  'scripts/fix-admin-user.mjs',
  'scripts/utilities/create-admin-simple.js',
  'scripts/database/seed-api-key.js',
];

function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('assertSeedAllowed', () => {
  it('refuses to run when NODE_ENV=production', () => {
    expect(() => {
      seedCredentials.assertSeedAllowed('seed-dev.js', { NODE_ENV: 'production' });
    }).toThrow(/will not run with NODE_ENV=production/);
  });

  it('runs in production only with the explicit override', () => {
    expect(() => {
      seedCredentials.assertSeedAllowed('seed-dev.js', { NODE_ENV: 'production', ALLOW_SEED_IN_PRODUCTION: 'true' });
    }).not.toThrow();
    expect(() => {
      seedCredentials.assertSeedAllowed('seed-dev.js', { NODE_ENV: 'production', ALLOW_SEED_IN_PRODUCTION: '1' });
    }).toThrow();
  });

  it('runs in development and test', () => {
    expect(() => {
      seedCredentials.assertSeedAllowed('seed-dev.js', { NODE_ENV: 'development' });
      seedCredentials.assertSeedAllowed('seed-dev.js', {});
    }).not.toThrow();
  });
});

describe('resolveSecret', () => {
  it('uses the password supplied in the environment and does not echo it back', () => {
    const secret = seedCredentials.resolveSecret('SEED_ADMIN_PASSWORD', { SEED_ADMIN_PASSWORD: 'chosen-by-operator' });
    expect(secret).toEqual({ value: 'chosen-by-operator', generated: false });
    expect(seedCredentials.describeSecret('SEED_ADMIN_PASSWORD', secret)).not.toContain('chosen-by-operator');
  });

  it('generates a different random password each run when none is supplied', () => {
    const first = seedCredentials.resolveSecret('SEED_ADMIN_PASSWORD', {});
    const second = seedCredentials.resolveSecret('SEED_ADMIN_PASSWORD', { SEED_ADMIN_PASSWORD: '' });
    expect(first.generated).toBe(true);
    expect(first.value.length).toBeGreaterThanOrEqual(24);
    expect(second.value).not.toBe(first.value);
    expect(seedCredentials.describeSecret('SEED_ADMIN_PASSWORD', first)).toContain(first.value);
  });
});

describe('seed and admin scripts', () => {
  it.each(SEED_SCRIPTS)('%s hashes no hard-coded password', (script) => {
    const source = read(script);
    // bcrypt.hash('literal', ...) — the published-default-password pattern.
    expect(source).not.toMatch(/bcrypt\.hash\(\s*['"`]/);
    expect(source).not.toMatch(/admin123|test-password-123/);
    expect(source).not.toMatch(/password\s*=\s*['"`]/);
  });

  it.each(SEED_SCRIPTS)('%s refuses production through the shared guard', (script) => {
    expect(read(script)).toMatch(/seedCredentials\.assertSeedAllowed\(/);
  });

  it.each(SEED_SCRIPTS)('%s opens Prisma through the shared adapter-backed client', (script) => {
    const source = read(script);
    // Prisma 7 throws on `new PrismaClient()` without a driver adapter, and the
    // repo is `"type": "module"`, so `require` does not exist in a .js script.
    expect(source).not.toMatch(/new PrismaClient\(/);
    expect(source).not.toMatch(/\brequire\(/);
    const specifier = /['"]((?:\.\.?\/)+(?:lib\/)?seed-prisma\.mjs)['"]/.exec(source)?.[1];
    expect(specifier).toBeDefined();
    expect(existsSync(join(ROOT, script, '..', specifier ?? ''))).toBe(true);
  });

  it.each(SEED_SCRIPTS)('%s gives every new user the columns that have no database default', (script) => {
    // User.id has no @default and User.updatedAt is not @updatedAt.
    const creates = read(script).split('prisma.user.create(').slice(1);
    for (const call of creates) {
      expect(call.slice(0, 200)).toMatch(/\.\.\.(newUserFields\(\)|userFields)/);
    }
  });

  it.each(SEED_SCRIPTS)('%s can find the shared helper from where it lives', (script) => {
    const specifier = /['"]((?:\.\.?\/)+(?:lib\/)?seed-credentials\.cjs)['"]/.exec(read(script))?.[1];
    expect(specifier).toBeDefined();
    expect(existsSync(join(ROOT, script, '..', specifier ?? ''))).toBe(true);
  });
});

describe('docker-compose.bun.yml', () => {
  const compose = read('docker-compose.bun.yml');

  it('publishes Postgres on loopback only', () => {
    expect(compose).toMatch(/- "127\.0\.0\.1:\$\{DATABASE_PORT:-5432\}:5432"/);
    expect(compose).not.toMatch(/- "\$\{DATABASE_PORT:-5432\}:5432"/);
  });

  it('has no default database password: compose stops if DATABASE_PASSWORD is unset', () => {
    expect(compose).not.toMatch(/\$\{DATABASE_PASSWORD:-/);
    expect(compose).toMatch(/POSTGRES_PASSWORD: \$\{DATABASE_PASSWORD:\?/);
  });
});
