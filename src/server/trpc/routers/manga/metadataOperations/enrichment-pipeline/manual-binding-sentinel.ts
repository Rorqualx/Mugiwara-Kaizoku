/**
 * Manual binding sentinel — "user chose to leave this provider unbound."
 *
 * Schema: `Manga.providerMetadata.<provider> = { manual: true, providerId: null,
 * intent: 'unbound', boundAt: ISO }`. The `manual: true` flag preserves the
 * entry through `clearAutoBindingsForReidentify`; the null `providerId` plus
 * the `intent: 'unbound'` marker tells provider-discovery code paths to skip
 * auto-binding for this manga + provider.
 *
 * Without this, every reidentify that finds the same low-quality match (e.g.
 * "Asshou" → "Association football" Wikipedia page) re-binds the same wrong
 * URL because the matcher has no way to know the user already rejected it.
 *
 * Used by:
 *   - `wiki-discovery.ts:discoverFandomWikiUrl` (Fandom)
 *   - `wiki-discovery.ts:fetchWikipediaChapterData` (Wikipedia)
 *   - `phase-provider-fetch.ts:runLanguageAwareComicVineMatch` (ComicVine)
 *
 * Set via:
 *   - `bindProvider` mutation when called with `providerId: null` + the unbound
 *     intent (TODO when UI ships)
 *   - `scripts/surveys/mark-no-binding.ts <mangaId> <provider> --apply`
 */
import { prisma as defaultPrisma } from '@/server/db';

export type SentinelProvider = 'fandom' | 'wikipedia' | 'comicvine' | 'mangadex' | 'mangaupdates';

interface SentinelEntry {
  manual?: unknown;
  providerId?: unknown;
  intent?: unknown;
}

/**
 * Inspect a providerMetadata bag (already loaded) for an unbound sentinel on
 * the given provider. Synchronous — preferred when callers already have the
 * Manga row.
 */
export function isManuallyUnboundFromMetadata(
  providerMetadata: unknown,
  provider: SentinelProvider,
): boolean {
  if (!providerMetadata || typeof providerMetadata !== 'object' || Array.isArray(providerMetadata)) {
    return false;
  }
  const entry = (providerMetadata as Record<string, unknown>)[provider] as SentinelEntry | undefined;
  if (!entry || typeof entry !== 'object') return false;
  if (entry.manual !== true) return false;
  const pid = entry.providerId;
  const isNullish = pid === null || pid === undefined || pid === '' || pid === false;
  return isNullish || entry.intent === 'unbound';
}

/**
 * Async lookup variant — fetches `Manga.providerMetadata` then delegates to
 * the synchronous version. Use when the caller doesn't already have the row.
 */
export async function isManuallyUnbound(
  mangaId: number,
  provider: SentinelProvider,
  prisma: typeof defaultPrisma = defaultPrisma,
): Promise<boolean> {
  const m = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { providerMetadata: true },
  });
  return isManuallyUnboundFromMetadata(m?.providerMetadata, provider);
}
