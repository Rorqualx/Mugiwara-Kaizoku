'use strict';

/**
 * Shared rules for scripts that create users or keys.
 *
 * - No credential is ever a published literal. A script takes it from an
 *   environment variable, or generates a random one and prints it once.
 * - Seed scripts refuse to run when NODE_ENV=production unless
 *   ALLOW_SEED_IN_PRODUCTION=true is set explicitly.
 *
 * CommonJS (.cjs) so both the ESM scripts (default import) and the CommonJS
 * ones (require) can load it, under Node and Bun alike.
 */

const crypto = require('crypto');

const PRODUCTION_OVERRIDE_ENV = 'ALLOW_SEED_IN_PRODUCTION';

/**
 * Throw when running against production without the explicit override.
 * @param {string} scriptName
 * @param {Record<string, string | undefined>} [env]
 */
function assertSeedAllowed(scriptName, env = process.env) {
  if (env.NODE_ENV === 'production' && env[PRODUCTION_OVERRIDE_ENV] !== 'true') {
    throw new Error(
      `${scriptName} creates accounts or keys and will not run with NODE_ENV=production. ` +
        `Set ${PRODUCTION_OVERRIDE_ENV}=true to run it anyway.`,
    );
  }
}

/** @returns {string} 24 URL-safe characters (144 bits). */
function generateSecret() {
  return crypto.randomBytes(18).toString('base64url');
}

/**
 * Take a credential from the environment, or generate a random one.
 * @param {string} envName
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ value: string, generated: boolean }}
 */
function resolveSecret(envName, env = process.env) {
  const provided = env[envName];
  if (typeof provided === 'string' && provided.length > 0) {
    return { value: provided, generated: false };
  }
  return { value: generateSecret(), generated: true };
}

/**
 * One-line description of where a credential came from, for the script's
 * final output. A generated value is shown (this is the only time it exists
 * in clear text); a value supplied by the caller is not echoed back.
 * @param {string} envName
 * @param {{ value: string, generated: boolean }} secret
 * @returns {string}
 */
function describeSecret(envName, secret) {
  return secret.generated
    ? `${secret.value}  (generated — shown once; set ${envName} to choose your own)`
    : `(the value of ${envName})`;
}

module.exports = {
  PRODUCTION_OVERRIDE_ENV,
  assertSeedAllowed,
  describeSecret,
  generateSecret,
  resolveSecret,
};
