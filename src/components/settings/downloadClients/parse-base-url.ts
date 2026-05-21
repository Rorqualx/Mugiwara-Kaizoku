/**
 * Shared URL parser for download-client connection-test inputs.
 *
 * The four settings components (Transmission, Deluge, SABnzbd, NZBGet) all
 * derive `{ host, port, ssl }` from a user-typed `baseURL` before invoking
 * their `test*` mutation. This helper folds that identical four-line block
 * into one call — and throws the same way `new URL(...)` does, so callers
 * can keep their existing try/catch around it.
 */

export interface ParsedBaseURL {
  host: string;
  port: number;
  ssl: boolean;
}

export function parseBaseURL(baseURL: string): ParsedBaseURL {
  const url = new URL(baseURL);
  const ssl = url.protocol === 'https:';
  const port = parseInt(url.port, 10) || (ssl ? 443 : 80);
  return {
    host: url.hostname,
    port,
    ssl,
  };
}
