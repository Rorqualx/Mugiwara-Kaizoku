/**
 * HttpClient - Basic HTTP client wrapper
 * Re-exports functionality from httpClient utility
 */

export * from '../utils/httpClient';

// Export the HttpClient interface and createHttpClient function
import { createHttpClient } from '../utils/httpClient';

import type { HttpClient } from '../utils/httpClient';
export type { HttpClient };
export { createHttpClient };

// Default export for backward compatibility
export default createHttpClient;