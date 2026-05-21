/**
 * Smoke test: fetchMangaDexChapters against a known manga.
 *
 * Verifies the fetcher returns deduplicated chapters with non-zero page
 * counts. Uses Monster (Naoki Urasawa) as default — long-running, widely
 * available on MangaDex.
 *
 * Usage:
 *   bun run scripts/tests/smoke-mangadex-chapter-pages.ts
 *   bun run scripts/tests/smoke-mangadex-chapter-pages.ts --title="Berserk"
 *
 * @quality-check-skip
 */

import { fetchMangaDexChapters } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/mangadex-chapter-list';
import { getTsMangadexClient } from '@/server/services/mangadex/ts-client-factory';

const print = (msg: string): void => { process.stdout.write(msg + '\n'); };

function getFlag(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : undefined;
}

async function main(): Promise<void> {
  const title = getFlag('title') ?? 'Monster';
  print(`MangaDex chapter-pages smoke test — title="${title}"`);

  const client = await getTsMangadexClient();
  const search = await client.searchManga({ title });
  const dataArr = Array.isArray(search.data) ? search.data : [search.data];
  if (dataArr.length === 0) {
    print(`✗ No MangaDex results for "${title}".`);
    process.exit(1);
  }
  const first = dataArr[0];
  if (!first) {
    print(`✗ Empty MangaDex result for "${title}".`);
    process.exit(1);
  }
  print(`Matched manga: ${first.id} — ${Object.values(first.attributes.title)[0] ?? '(untitled)'}`);

  const chapters = await fetchMangaDexChapters(client, first.id);
  print(`Fetched ${chapters.length} deduplicated chapters.`);

  if (chapters.length === 0) {
    print(`✗ Expected ≥1 chapter.`);
    process.exit(1);
  }

  const withPages = chapters.filter(c => (c.pages ?? 0) > 0).length;
  const withTitle = chapters.filter(c => c.title && c.title.length > 0).length;
  const withVolume = chapters.filter(c => c.volume !== undefined).length;

  print(`  ${withPages}/${chapters.length} with pages > 0`);
  print(`  ${withTitle}/${chapters.length} with title`);
  print(`  ${withVolume}/${chapters.length} with volume`);
  print(`\nFirst 5:`);
  for (const ch of chapters.slice(0, 5)) {
    print(`  #${ch.number} pages=${ch.pages} vol=${ch.volume ?? '-'} title="${ch.title ?? ''}"`);
  }

  if (withPages !== chapters.length) {
    print(`\n✗ Expected every chapter to have pages > 0 after dedup filter.`);
    process.exit(1);
  }
  print(`\n→ OK`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('Fatal:', e);
    process.exit(1);
  });
