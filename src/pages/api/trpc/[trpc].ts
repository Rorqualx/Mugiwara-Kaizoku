/**
 * TRPC API Route Handler
 *
 * This module configures the Next.js API handler for TRPC endpoints.
 * It sets up request handling, context creation, and error logging
 * for all TRPC procedures.
 *
 * @module pages/api/trpc
 * @security Implements request context validation
 * @security Handles internal server errors
 */
import * as trpcNext from '@trpc/server/adapters/next';


import { createContext } from '@/server/trpc/context';
import { appRouter } from '@/server/trpc/root';
import { logger } from '@/utils/logger';

import type { NextApiRequest, NextApiResponse } from 'next';

/** No-cache headers for tRPC responses */
const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
};

/** Response metadata function that disables caching */
function getResponseMeta(): { headers: Record<string, string> } {
    return { headers: noCacheHeaders };
}

/** Error handler for tRPC procedures */
function handleTrpcError({ error }: { error: { code: string } }): void {
    if (error.code === 'INTERNAL_SERVER_ERROR') {
        logger.error('Something went wrong', error);
    }
}

/**
 * Create the tRPC handler with proper configuration
 */
const trpcHandler = trpcNext.createNextApiHandler({
    router: appRouter,
    createContext,
    onError: handleTrpcError,
    responseMeta: getResponseMeta,
});

/**
 * Handler that ensures no caching headers are set
 */
async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    // Force no caching headers before handling
    res.setHeader('Cache-Control', noCacheHeaders['Cache-Control']);
    res.setHeader('Pragma', noCacheHeaders['Pragma']);
    res.setHeader('Expires', noCacheHeaders['Expires']);
    res.setHeader('Surrogate-Control', 'no-store');

    return trpcHandler(req, res);
}

export default handler;

/**
 * Next.js API configuration (Pages Router)
 * Increases body size limit for large metadata responses
 *
 * Default limit is 1mb, but large manga imports (Tokyo Ghoul: 62 volumes, 143 chapters)
 * can exceed this with full Fandom volume/chapter data including cover URLs.
 */
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '100mb',
        },
        responseLimit: false, // No response size limit
        externalResolver: true,
    },
};
