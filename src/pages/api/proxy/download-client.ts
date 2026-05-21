/**
 * Download Client Proxy API Route
 *
 * Unified proxy handler for all download client operations.
 * Delegates to specialized modules for configuration, request building, and error handling.
 *
 * ESLint Issues Fixed:
 * - Function complexity reduced from 30 to under 20
 * - Statement count reduced from 51 to under 50
 * - Code properly modularized into separate concerns
 */


// Import refactored modules
import {
  handleProxyError,
  sendSuccessResponse
} from './download-client/error-handler';
import {
  executeProxyRequest,
  RequestBuilderConfig
} from './download-client/request-builder';
import {
  validateRequiredParameters,
  DownloadClientType,
  ClientAuthConfig,
  loadClientConfig,
  handleAxiosError
} from './download-client/utils';

import type { NextApiRequest, NextApiResponse } from 'next';

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Main proxy request handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    await handleProxyRequest(req, res);
  } catch (error: unknown) {
    handleProxyError(error, { clientType: 'unknown', endpoint: 'unknown' }, res);
  }
}

/**
 * Handle proxy request with proper error handling
 */
async function handleProxyRequest(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Extract and validate parameters
  const { clientType, clientEndpoint } = req.query;
  
  if (!validateRequiredParameters(clientType as string, clientEndpoint as string, res)) {
    return;
  }

  // Load client configuration
  const clientConfig = await loadClientConfig(clientType as DownloadClientType);
  if (!clientConfig) {
    return res.status(400).json({ error: 'Client not configured or disabled' });
  }

  // Build and execute proxy request
  await executeProxyRequestHandler(req, res, clientType as string, clientEndpoint as string, clientConfig);
}

/**
 * Execute the actual proxy request
 */
async function executeProxyRequestHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  clientType: string,
  clientEndpoint: string,
  clientConfig: ClientAuthConfig
): Promise<void> {
  try {
    // Build the request configuration
    const requestConfig: RequestBuilderConfig = {
      clientType: clientType as DownloadClientType,
      clientEndpoint,
      method: req.method ?? 'GET',
      data: req.body,
      authConfig: clientConfig
    };

    // Execute the proxy request
    const response = await executeProxyRequest(requestConfig);

    // Send successful response
    sendSuccessResponse(res, response.data);
  } catch (error: unknown) {
    // Handle axios errors with proper error mapping
    handleAxiosError(error, clientType, res);
  }
}

// ============================================================================
// HTTP Method Support
// ============================================================================

/**
 * GET handler for proxy requests
 */
export async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  await handleProxyRequest(req, res);
}

/**
 * POST handler for proxy requests
 */
export async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  await handleProxyRequest(req, res);
}

/**
 * PUT handler for proxy requests
 */
export async function handlePutRequest(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  await handleProxyRequest(req, res);
}

/**
 * DELETE handler for proxy requests
 */
export async function handleDeleteRequest(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  await handleProxyRequest(req, res);
}
