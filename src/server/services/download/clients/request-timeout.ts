/**
 * Time limit for one request to a download client.
 *
 * `fetch` has no default timeout: a client that accepts the connection and
 * then stops answering (hung daemon, dead NAS mount behind it) would hold the
 * caller — a queue worker slot, the download monitor's pass — indefinitely.
 */
export const DOWNLOAD_CLIENT_REQUEST_TIMEOUT_MS = 30_000;

/** A fresh abort signal that fires after the download-client time limit. */
export function downloadClientRequestSignal(): AbortSignal {
  return AbortSignal.timeout(DOWNLOAD_CLIENT_REQUEST_TIMEOUT_MS);
}
