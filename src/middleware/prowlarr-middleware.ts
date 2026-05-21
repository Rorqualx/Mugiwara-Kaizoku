/**
 * @deprecated Use the src/pages/api/prowlarr.ts endpoint instead
 *
 * This middleware has been deprecated in favor of a standardized API endpoint approach.
 * Please use the /api/prowlarr endpoint with our standardized client utilities from
 * src/utils/prowlarrApi.ts instead.
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';


interface DeprecatedResponseData {
  readonly error: string;
  readonly message: string;
}

/**
 * @deprecated Use the API endpoint approach instead
 */
export function prowlarrMiddleware(_request: NextRequest): NextResponse {
  const responseData: DeprecatedResponseData = {
    error: 'Deprecated middleware',
    message: 'This middleware has been deprecated. Please use the /api/prowlarr endpoint instead.'
  };

  return NextResponse.json(responseData, { status: 410 }); // Gone status code
}
