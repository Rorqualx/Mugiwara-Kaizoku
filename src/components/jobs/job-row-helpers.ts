/** Tiny shared helpers used by the Jobs page extractors and renderers. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
