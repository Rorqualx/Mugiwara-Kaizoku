/**
 * Request redaction for logs and metrics.
 *
 * API keys are accepted in the query string (`?apiKey=`) because browser
 * `EventSource` and `WebSocket` cannot send custom headers. A key in the URL
 * must never be written to logs or the metrics table, so every place that
 * records a request URL or query goes through these helpers.
 */

const REDACTED = '[REDACTED]';

/** Query parameter names (lower-cased) whose values are credentials. */
const SENSITIVE_QUERY_PARAMS: ReadonlySet<string> = new Set([
  'apikey',
  'api_key',
  'api-key',
  'token',
  'access_token',
]);

function isSensitiveParam(name: string): boolean {
  return SENSITIVE_QUERY_PARAMS.has(name.toLowerCase());
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Replace credential values in a URL's query string; the rest is untouched. */
export function redactUrl(url: string | undefined): string {
  if (url === undefined || url.length === 0) {
    return '';
  }
  const queryStart = url.indexOf('?');
  if (queryStart === -1) {
    return url;
  }
  const hashStart = url.indexOf('#', queryStart);
  const queryEnd = hashStart === -1 ? url.length : hashStart;
  const redactedQuery = url
    .slice(queryStart + 1, queryEnd)
    .split('&')
    .map((pair) => {
      const separator = pair.indexOf('=');
      const name = separator === -1 ? pair : pair.slice(0, separator);
      return isSensitiveParam(safeDecode(name)) ? `${name}=${REDACTED}` : pair;
    })
    .join('&');
  return `${url.slice(0, queryStart)}?${redactedQuery}${url.slice(queryEnd)}`;
}

/** Copy of a parsed query object with credential values replaced. */
export function redactQuery(
  query: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(query ?? {})) {
    redacted[name] = isSensitiveParam(name) ? REDACTED : value;
  }
  return redacted;
}
