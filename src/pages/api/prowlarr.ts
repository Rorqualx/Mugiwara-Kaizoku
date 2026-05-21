/**
 * API route for proxying requests to Prowlarr
 *
 * This route handles all Prowlarr communication, ensuring proper authentication
 * and error handling. It provides a standardized interface for the client-side
 * code to interact with Prowlarr.
 *
 * Security:
 * - Requires authentication (OWASP A01:2021)
 * - Rate limiting (60 requests/minute)
 * - JSON validation (Agent 4's work)
 *
 * @module pages/api/prowlarr
 */
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '@/pages/api/auth/[...nextauth]';
import type { ApiRequest } from '@/server/api/middleware/apiMiddleware';
import { safeJsonParse } from '@/server/utils/json-utils';
import { createApiRoute } from '@/utils/api-route-factory';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';


// In-memory rate limiting - in production, use Redis or similar
const rateLimits: Record<string, {
    count: number;
    resetTime: number;
}> = {};
/**
 * Rate limit check based on IP address
 */
function checkRateLimit(ip: string): boolean {
    // Use nullish coalescing assignment operator to initialize
    const limit = (rateLimits[ip] ??= {
        count: 0,
        resetTime: Date.now() + 60000, // Reset after 1 minute
    });

    // Now limit is guaranteed to be defined (the result of ??=)
    if (Date.now() > limit.resetTime) {
        limit.count = 0;
        limit.resetTime = Date.now() + 60000;
    }

    limit.count++;
    return limit.count > 60; // 60 requests per minute
}
// Validation schemas
const _prowlarrRequestSchema = z.object({
    endpoint: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
    params: z.record(z.unknown()).optional(),
    body: z.unknown().optional(),
});

// Schema for wrapped requests (from middleware)
const wrappedProwlarrRequestSchema = z.object({
    data: z.string(), // JSON stringified request data
    prowlarrUrl: z.string().optional(),
    prowlarrApiKey: z.string().optional(),
    prowlarrUsername: z.string().optional(),
    prowlarrPassword: z.string().optional(),
});

/**
 * Parse and unwrap request data
 */
interface ParsedRequest {
    requestData: Record<string, unknown>;
    parsedData: Record<string, unknown>;
}

function parseRequestData(body: Record<string, unknown>): ParsedRequest {
    const requestData: Record<string, unknown> = body;
    let parsedData: Record<string, unknown> = {};

    // Define schema for Prowlarr data
    const prowlarrDataSchema = z.object({
        prowlarrUrl: z.string().url().optional(),
        prowlarrApiKey: z.string().optional(),
        query: z.string().optional(),
        categories: z.array(z.number()).optional(),
        indexers: z.array(z.number()).optional(),
    }).passthrough(); // Allow additional fields

    // Check if body has a 'data' field that's a string (wrapped by middleware)
    if ('data' in body && body['data']) {
        if (typeof body['data'] === 'string') {
            // Use safe JSON parsing with validation
            const parseResult = safeJsonParse(
                body['data'] as string,
                prowlarrDataSchema,
                { source: 'prowlarr-api' }
            );

            // Check result status before accessing properties
            if (parseResult.status === 'error') {
                logger.error('Failed to parse wrapped Prowlarr data', {
                    error: parseResult.error,
                });
                throw new ValidationError(parseResult.error.message);
            }

            if (parseResult.status === 'success') {
                parsedData = parseResult.data as Record<string, unknown>;
            }
            logger.info('Parsed data from wrapper:', JSON.stringify(parsedData));
        } else {
            // data field exists but is not a string
            parsedData = body['data'] as Record<string, unknown>;
        }
    }

    return { requestData, parsedData };
}

/**
 * Extract request properties with type checking
 */
interface RequestProperties {
    endpoint: string | undefined;
    method: string;
    params: Record<string, unknown> | undefined;
    requestBody: unknown;
    clientProwlarrUrl: string | undefined;
    clientProwlarrApiKey: string | undefined;
    clientProwlarrUsername: string | undefined;
    clientProwlarrPassword: string | undefined;
}

function extractRequestProperties(requestData: Record<string, unknown>): RequestProperties {
    const endpoint = typeof requestData['endpoint'] === 'string' ? requestData['endpoint'] : undefined;
    const method = (typeof requestData['method'] === 'string' && ['GET', 'POST', 'PUT', 'DELETE'].includes(requestData['method'])) ? requestData['method'] : 'POST';
    const params = typeof requestData['params'] === 'object' && requestData['params'] !== null ? requestData['params'] as Record<string, unknown> : undefined;
    const requestBody = requestData['body'];
    const clientProwlarrUrl = typeof requestData['prowlarrUrl'] === 'string' ? requestData['prowlarrUrl'] : undefined;
    const clientProwlarrApiKey = typeof requestData['prowlarrApiKey'] === 'string' ? requestData['prowlarrApiKey'] : undefined;
    const clientProwlarrUsername = typeof requestData['prowlarrUsername'] === 'string' ? requestData['prowlarrUsername'] : undefined;
    const clientProwlarrPassword = typeof requestData['prowlarrPassword'] === 'string' ? requestData['prowlarrPassword'] : undefined;

    // DEBUG: Log extracted values
    logger.info('[DEBUG] Extracted from requestData:', {
        hasEndpoint: !!endpoint,
        endpoint,
        hasClientProwlarrUrl: !!clientProwlarrUrl,
        clientProwlarrUrl,
        hasClientProwlarrApiKey: !!clientProwlarrApiKey,
        clientProwlarrApiKeyLength: clientProwlarrApiKey?.length ?? 0,
        clientProwlarrApiKey: clientProwlarrApiKey ? `${clientProwlarrApiKey.substring(0, 4)}...` : '(empty)'
    });

    return {
        endpoint,
        method,
        params,
        requestBody,
        clientProwlarrUrl,
        clientProwlarrApiKey,
        clientProwlarrUsername,
        clientProwlarrPassword
    };
}

/**
 * Build final Prowlarr configuration with fallbacks
 */
interface ProwlarrConfig {
    finalProwlarrUrl: string | undefined;
    finalProwlarrApiKey: string | undefined;
    finalProwlarrUsername: string | undefined;
    finalProwlarrPassword: string | undefined;
}

/**
 * Validated Prowlarr configuration (guaranteed non-null after validation)
 */
interface ValidatedProwlarrConfig {
    finalProwlarrUrl: string;
    finalProwlarrApiKey: string;
    finalProwlarrUsername: string | undefined;
    finalProwlarrPassword: string | undefined;
}

async function buildProwlarrConfig(props: RequestProperties): Promise<ProwlarrConfig> {
    // Load server-side Prowlarr config from DB (single source of truth)
    const { prowlarrConfigService } = await import('@/server/services/prowlarr/configService');
    const serverConfig = await prowlarrConfigService.loadConfig();

    const finalProwlarrUrl = props.clientProwlarrUrl ?? serverConfig.baseUrl;
    const finalProwlarrApiKey = props.clientProwlarrApiKey ?? serverConfig.apiKey;
    const finalProwlarrUsername = props.clientProwlarrUsername ?? serverConfig.username;
    const finalProwlarrPassword = props.clientProwlarrPassword ?? serverConfig.password;

    logger.info('[DEBUG] Final config after fallback:', {
        hasProwlarrUrl: !!finalProwlarrUrl,
        prowlarrUrl: finalProwlarrUrl,
        hasProwlarrApiKey: !!finalProwlarrApiKey,
        prowlarrApiKeyLength: finalProwlarrApiKey.length,
        prowlarrApiKey: finalProwlarrApiKey ? `${finalProwlarrApiKey.substring(0, 4)}...` : '(empty)'
    });

    logger.info(`Prowlarr config - URL: ${finalProwlarrUrl ? 'set' : 'missing'}, Key: ${finalProwlarrApiKey ? 'set' : 'missing'}, Auth: ${finalProwlarrUsername ? 'set' : 'not set'}`);

    return {
        finalProwlarrUrl,
        finalProwlarrApiKey,
        finalProwlarrUsername,
        finalProwlarrPassword
    };
}

/**
 * Build Prowlarr URL with parameters
 */
function buildProwlarrUrl(
    config: ValidatedProwlarrConfig,
    endpoint: string,
    params: Record<string, unknown> | undefined
): URL {
    const baseUrl = config.finalProwlarrUrl.endsWith('/')
        ? config.finalProwlarrUrl.slice(0, -1)
        : config.finalProwlarrUrl;
    const fullUrl = `${baseUrl}${endpoint}`;
    const url = new URL(fullUrl);

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                url.searchParams.append(key, String(value));
            }
        });
    }

    return url;
}

/**
 * Build request headers with authentication
 */
function buildProwlarrHeaders(config: ValidatedProwlarrConfig): HeadersInit {
    const headers: HeadersInit = {
        'X-Api-Key': config.finalProwlarrApiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    // DEBUG: Log headers being sent
    logger.info('[DEBUG] Headers being sent to Prowlarr:', {
        hasXApiKey: !!headers['X-Api-Key'],
        xApiKeyLength: headers['X-Api-Key']?.toString().length ?? 0,
        xApiKey: headers['X-Api-Key'] ? `${headers['X-Api-Key'].toString().substring(0, 4)}...` : '(empty)'
    });

    // Add Basic Authentication if username and password are provided
    if (config.finalProwlarrUsername && config.finalProwlarrPassword) {
        const auth = Buffer.from(`${config.finalProwlarrUsername}:${config.finalProwlarrPassword}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
        logger.info('Adding Basic Authentication to request');
    }

    return headers;
}

/**
 * Execute request to Prowlarr and handle response
 */
async function executeProwlarrRequest(
    url: URL,
    method: string,
    headers: HeadersInit,
    requestBody: unknown
): Promise<unknown> {
    const fetchOptions: RequestInit = {
        method,
        headers
    };
    if (requestBody) {
        fetchOptions.body = JSON.stringify(requestBody);
    }

    // DEBUG: Log full request before sending
    logger.info('[DEBUG] About to fetch Prowlarr:', {
        url: url.toString(),
        method,
        hasBody: !!requestBody
    });

    const response = await fetch(url.toString(), fetchOptions);

    // DEBUG: Log response status
    logger.info('[DEBUG] Prowlarr response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Prowlarr error response: ${errorText}`);
        throw new ValidationError(`Prowlarr returned ${response["status"]}: ${response.statusText}`);
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
        const text = await response.text();
        if (!text) {
            return {};
        }
        return { result: text };
    }

    const data = await response.json() as unknown;
    return data as Record<string, unknown>;
}

/**
 * Extract user information from request
 */
interface UserInfo {
    userId: string;
    clientIp: string;
}

function extractUserInfo(session: { user: unknown }, req: ApiRequest): UserInfo {
    const user = session.user as Record<string, unknown>;
    const userId = 'id' in user && typeof user['id'] === 'string' ? user['id'] : 'unknown';
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = (typeof forwardedFor === 'string' ? forwardedFor : (Array.isArray(forwardedFor) ? forwardedFor[0] : undefined)) ?? req.socket.remoteAddress ?? 'unknown';

    return { userId, clientIp };
}

/**
 * Merge request data from body and parsed data
 */
function mergeRequestData(
    body: Record<string, unknown>,
    parsedData: Record<string, unknown>
): Record<string, unknown> {
    return {
        ...parsedData,
        prowlarrUrl: (typeof body['prowlarrUrl'] === 'string' ? body['prowlarrUrl'] : undefined) ?? (typeof parsedData['prowlarrUrl'] === 'string' ? parsedData['prowlarrUrl'] : undefined),
        prowlarrApiKey: (typeof body['prowlarrApiKey'] === 'string' ? body['prowlarrApiKey'] : undefined) ?? (typeof parsedData['prowlarrApiKey'] === 'string' ? parsedData['prowlarrApiKey'] : undefined),
        prowlarrUsername: (typeof body['prowlarrUsername'] === 'string' ? body['prowlarrUsername'] : undefined) ?? (typeof parsedData['prowlarrUsername'] === 'string' ? parsedData['prowlarrUsername'] : undefined),
        prowlarrPassword: (typeof body['prowlarrPassword'] === 'string' ? body['prowlarrPassword'] : undefined) ?? (typeof parsedData['prowlarrPassword'] === 'string' ? parsedData['prowlarrPassword'] : undefined)
    };
}

/**
 * Validate config and create validated config object
 */
interface ValidationResult {
    isValid: boolean;
    validatedConfig?: ValidatedProwlarrConfig;
}

function validateAndCreateConfig(
    config: ProwlarrConfig,
    endpoint: string | undefined
): ValidationResult {
    if (!config.finalProwlarrUrl || !config.finalProwlarrApiKey || !endpoint) {
        return { isValid: false };
    }

    return {
        isValid: true,
        validatedConfig: {
            finalProwlarrUrl: config.finalProwlarrUrl,
            finalProwlarrApiKey: config.finalProwlarrApiKey,
            finalProwlarrUsername: config.finalProwlarrUsername,
            finalProwlarrPassword: config.finalProwlarrPassword
        }
    };
}

export default createApiRoute({
    requireAuth: false, // Auth handled inside POST handler via getServerSession (route is in PUBLIC_ENDPOINTS)
    validation: {
        GET: z.object({
            endpoint: z.string(),
            params: z.record(z.unknown()).optional(),
        }),
        POST: wrappedProwlarrRequestSchema,
    },
    handlers: {
        GET: (req, res): void => {
            // GET requests are not used anymore since we pass config in the body
            // Redirect to POST handler behavior
            res["status"](405).json({
                error: 'Method not allowed',
                message: 'Please use POST method with configuration in the body',
            });
        },
        POST: async (req, res): Promise<void> => {
            // SECURITY: Verify authentication (OWASP A01:2021)
            const session = await getServerSession(req, res, authOptions);
            if (!session?.user) {
                logger.warn('Unauthorized prowlarr access attempt', {
                    ip: req.headers['x-forwarded-for'] ?? req.socket.remoteAddress
                });
                return res["status"](401).json({
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
            }

            logger.debug('[PROWLARR ROUTE] ===== POST HANDLER EXECUTING =====');
            const { userId, clientIp } = extractUserInfo(session, req);
            logger.info('[PROWLARR ROUTE] POST handler started', { userId });

            // Check rate limiting
            if (checkRateLimit(clientIp)) {
                return res["status"](429).json({
                    error: 'Too many requests',
                    message: 'Rate limit exceeded. Please try again later.',
                });
            }

            try {
                logger.info('Prowlarr API request received:', JSON.stringify(req.body));
                const body = req.body as Record<string, unknown>;

                // Parse and unwrap request data
                const { parsedData } = parseRequestData(body);

                // Merge parsed data with additional fields from body
                const mergedData = mergeRequestData(body, parsedData);

                logger.info('Final requestData after unwrapping:', JSON.stringify(mergedData));

                // Extract request properties
                const props = extractRequestProperties(mergedData);

                // Build Prowlarr configuration (async — reads from DB)
                const config = await buildProwlarrConfig(props);

                // Validate required configuration and create validated config
                const validationResult = validateAndCreateConfig(config, props.endpoint);
                if (!validationResult.isValid || !validationResult.validatedConfig) {
                    return res["status"](503).json({
                        error: 'Prowlarr not configured',
                        message: 'Prowlarr connection settings or endpoint are missing.',
                    });
                }

                const validatedConfig = validationResult.validatedConfig;

                // Build URL and headers
                // At this point, endpoint is guaranteed to be defined by validation
                if (!props.endpoint) {
                    throw new Error('Endpoint is required but was not provided');
                }
                const url = buildProwlarrUrl(validatedConfig, props.endpoint, props.params);
                logger.info(`Proxying request to Prowlarr: ${props.method} ${url.toString()}`);

                const headers = buildProwlarrHeaders(validatedConfig);

                // Execute request to Prowlarr
                const data = await executeProwlarrRequest(url, props.method, headers, props.requestBody);
                return res["status"](200).json(data as Record<string, unknown>);
            }
            catch (error: unknown) {
                logger.error('Prowlarr API error:', error);
                if (error instanceof z.ZodError) {
                    return res["status"](400).json({
                        error: 'Invalid request',
                        details: error.errors,
                    });
                }
                if (error instanceof ValidationError) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid request data',
                        message: error instanceof Error ? error.message : 'Validation error',
                    });
                }
                return res["status"](500).json({
                    error: 'Prowlarr request failed',
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        },
    },
});
