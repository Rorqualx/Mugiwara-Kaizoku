/**
 * Tiny hook for client-side dismissible notices.
 *
 * Backed by `localStorage` under the `dismissed-notice:<key>` namespace so
 * different notices live in separate slots. SSR-safe: returns `dismissed
 * = false` during the first render on the server, then hydrates from
 * localStorage on the client.
 *
 * Versioned keys (`my-notice-v1`) let copy changes re-show the notice
 * without a manual `localStorage.removeItem`.
 *
 * @example
 * const { dismissed, dismiss } = useDismissibleNotice('getcomics-trust-v1');
 * if (!dismissed) return <Alert>...<button onClick={dismiss}>Hide</button></Alert>;
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'dismissed-notice:';

export interface UseDismissibleNoticeResult {
  dismissed: boolean;
  dismiss: () => void;
}

function readDismissed(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, '1');
  } catch {
    // localStorage can throw in private mode / quota-exceeded;
    // dismissal then degrades to per-render.
  }
}

export function useDismissibleNotice(key: string): UseDismissibleNoticeResult {
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    setDismissed(readDismissed(key));
  }, [key]);

  const dismiss = useCallback(() => {
    writeDismissed(key);
    setDismissed(true);
  }, [key]);

  return { dismissed, dismiss };
}
