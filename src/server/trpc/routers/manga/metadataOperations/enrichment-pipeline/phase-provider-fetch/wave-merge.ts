/**
 * Second-wave result merging for the provider-fetch phase.
 *
 * A second-wave step either retries a provider that returned nothing or
 * re-verifies one that did. Neither may erase first-wave data: a rejected
 * step, or a `null` from a timed-out verify, falls back to the first-wave
 * value. (The verify steps never return null when given a non-null existing
 * result, so null there can only mean the step timed out.)
 */

export type WaveStepFailureHandler = (step: string, reason: unknown) => void;

export function settledValueOr<T>(
  settled: PromiseSettledResult<T | null>,
  fallback: T | null,
  step: string,
  onRejected?: WaveStepFailureHandler,
): T | null {
  if (settled.status === 'rejected') {
    onRejected?.(step, settled.reason);
    return fallback;
  }
  return settled.value ?? fallback;
}
