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
import { installDefaultAxiosAbortTimeout } from '@/utils/axios-abort-timeout';
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
// The Next server bundle can load its own copy of modules; make sure the axios
// it uses has the abort deadline too (idempotent).
installDefaultAxiosAbortTimeout();

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
 *
 * The body is parsed BEFORE any procedure checks the session, so this is also
 * the most an anonymous caller can make the server buffer and parse. It is
 * sized for the largest legitimate JSON call — `annotation.createPage`, whose
 * `htmlSnapshot` is capped at 10M characters (up to ~30 MB as escaped UTF-8)
 * plus its token list — and no larger. File uploads (backup restore) do not
 * come through tRPC; they use the multipart route `/api/backup/upload`.
 *
 * Keep the value a string literal: Next reads this export statically.
 */
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '32mb',
        },
        responseLimit: false, // No response size limit
        externalResolver: true,
    },
};
