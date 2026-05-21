/**
 * Log Sanitization Utility
 *
 * Provides utilities to sanitize sensitive data from objects before logging.
 * This prevents accidental exposure of credentials, tokens, and other sensitive
 * information in application logs.
 *
 * @module server/utils/log-sanitizer
 */

/**
 * List of field names that should be redacted from logs
 */
const SENSITIVE_FIELD_NAMES = [
  'password',
  'hashedpassword',
  'hashed_password',
  'pwd',
  'passwd',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'apikey',
  'api_key',
  'secret',
  'secretkey',
  'secret_key',
  'credentials',
  'authorization',
  'auth',
  'cookie',
  'session',
  'sessionid',
  'session_id',
  'privatekey',
  'private_key',
  'publickey',
  'public_key',
  'apitoken',
  'api_token',
  'bearer',
  'jwt',
  'resettoken',
  'reset_token',
  'verificationtoken',
  'verification_token',
];

/**
 * List of header names that should be redacted from logs
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
];

/**
 * Check if a field name suggests sensitive data
 *
 * @param fieldName - The field name to check
 * @returns True if the field name suggests sensitive data
 */
function isSensitiveFieldName(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase().replace(/[-_\s]/g, '');
  return SENSITIVE_FIELD_NAMES.some((pattern) =>
    lowerFieldName.includes(pattern)
  );
}

/**
 * Sanitize sensitive data from an object before logging
 *
 * This function recursively traverses an object and replaces sensitive
 * field values with '[REDACTED]'. It handles nested objects and arrays.
 *
 * @param data - The data to sanitize
 * @param maxDepth - Maximum recursion depth (default: 10)
 * @param currentDepth - Current recursion depth (internal use)
 * @returns Sanitized copy of the data
 */
export function sanitizeForLogging(
  data: unknown,
  maxDepth: number = 10,
  currentDepth: number = 0
): unknown {
  // Prevent deep recursion
  if (currentDepth > maxDepth) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  // Handle null and undefined
  if (data === null) {
    return data;
  }

  // Handle primitive types
  if (typeof data !== 'object') {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) =>
      sanitizeForLogging(item, maxDepth, currentDepth + 1)
    );
  }

  // Handle Error objects specially
  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      code: (data as Error & { code?: string | number }).code,
      // Never include stack traces with sensitive data
      stack: '[REDACTED_FOR_SECURITY]',
    };
  }

  // Handle Date objects
  if (data instanceof Date) {
    return data;
  }

  // Handle regular objects
  const sanitized: Record<string, unknown> = {};
  const dataRecord = data as Record<string, unknown>;

  for (const key of Object.keys(dataRecord)) {
    const lowerKey = key.toLowerCase();

    // Check if field name suggests sensitive data
    if (isSensitiveFieldName(key)) {
      sanitized[key] = '[REDACTED]';
    }
    // Check if it's a header object and sanitize headers
    else if (lowerKey === 'headers' && typeof dataRecord[key] === 'object') {
      sanitized[key] = sanitizeHeaders(dataRecord[key] as Record<string, unknown> | undefined);
    }
    // Recursively sanitize nested objects
    else if (typeof dataRecord[key] === 'object' && dataRecord[key] !== null) {
      sanitized[key] = sanitizeForLogging(
        dataRecord[key],
        maxDepth,
        currentDepth + 1
      );
    }
    // Keep other values as-is
    else {
      sanitized[key] = dataRecord[key];
    }
  }

  return sanitized;
}

/**
 * Sanitize HTTP headers for logging
 *
 * @param headers - Headers object to sanitize
 * @returns Sanitized headers object
 */
export function sanitizeHeaders(
  headers: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    // Check if it's a sensitive header
    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    }
    // Partially redact bearer tokens in Authorization header
    else if (lowerKey === 'authorization' && typeof value === 'string') {
      if (value.startsWith('Bearer ')) {
        sanitized[key] = 'Bearer [REDACTED]';
      } else if (value.startsWith('Basic ')) {
        sanitized[key] = 'Basic [REDACTED]';
      } else {
        sanitized[key] = '[REDACTED]';
      }
    }
    // Keep other headers
    else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize user credentials for logging
 *
 * This is a specialized function for sanitizing login/authentication data.
 * It preserves identifiers (username, email) but redacts passwords and tokens.
 *
 * @param credentials - Credentials object to sanitize
 * @returns Sanitized credentials object safe for logging
 */
export function sanitizeCredentials(credentials: {
  identifier?: string;
  username?: string;
  email?: string;
  password?: string;
  token?: string;
  [key: string]: unknown;
}): Record<string, unknown> {
  const otherFields = Object.fromEntries(
    Object.entries(credentials).filter(
      ([key]) =>
        !['identifier', 'username', 'email', 'password', 'token'].includes(
          key
        )
    )
  );

  const sanitizedOtherFields = sanitizeForLogging(otherFields);

  return {
    ...(credentials.identifier !== undefined ? { identifier: credentials.identifier } : {}),
    ...(credentials.username !== undefined ? { username: credentials.username } : {}),
    ...(credentials.email !== undefined ? { email: credentials.email } : {}),
    ...(credentials.password !== undefined ? { password: '[REDACTED]' } : {}),
    ...(credentials.token !== undefined ? { token: '[REDACTED]' } : {}),
    // Sanitize any other fields
    ...(typeof sanitizedOtherFields === 'object' && sanitizedOtherFields !== null ? sanitizedOtherFields : {}),
  };
}

/**
 * Sanitize an error object for logging
 *
 * Removes stack traces and sensitive data from error objects
 *
 * @param error - Error to sanitize
 * @returns Sanitized error object
 */
export function sanitizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: (error as Error & { code?: string | number }).code,
      // Optionally include a truncated stack in development
      stack:
        process.env.NODE_ENV === 'development'
          ? error.stack?.split('\n').slice(0, 3).join('\n')
          : '[REDACTED_FOR_SECURITY]',
    };
  }

  return {
    message: String(error),
  };
}
