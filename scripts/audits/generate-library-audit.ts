/**
 * @quality-check-skip
 *
 * Regenerate library-metadata-audit.tsv from current DB state.
 *
 * Classifies each library manga into one of:
 *   A_CORRECT           - has source+sourceId + meaningful summary + cover + chapters/volumes present
 *   A_MATCHED_SPARSE    - matched + summary but 0 chapters or 0 volumes populated
 *   C_GENERIC           - matched but summary is short/filler (<80 chars) or cover is placeholder
 *   C_NO_SUMMARY        - matched but summary is empty/null
 *   D_NO_METADATA       - no source or no sourceId
 *   D_STUB              - has Metadata row but nothing populated (placeholder cover, no summary, no source)
 */
import { prisma } from '@/server/db';

interface Row {
  id: number;
  title: string;
  mdSource: string | null;
  mdSourceId: string | null;
  summaryLen: number;
  coverReal: boolean;
  nAuthors: number;
  nGenres: number;
  nSynonyms: number;
  nGallery: number;
  nVolumes: number;
  nChapters: number;
  nReadable: number;
  averageScore: number | null;
  titleInSynonyms: boolean;
}

function classify(r: Row): string {
  // Pure metadata-based classification — does not consider whether chapter/volume
  // files were imported. A well-enriched manga with no files on disk is still A.
  const hasSource = !!r.mdSource && !!r.mdSourceId;
  if (!hasSource) {
    if (r.summaryLen === 0 && !r.coverReal) return 'D_NO_METADATA';
    return 'D_STUB';
  }
  if (r.summaryLen === 0 && !r.coverReal) return 'D_STUB';
  if (r.summaryLen === 0) return 'C_NO_SUMMARY';
  if (r.summaryLen < 80 || !r.coverReal) return 'C_GENERIC';
  return 'A_CORRECT';
}

async function main(): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{
    id: number;
    title: string;
    md_source: string | null;
    md_source_id: string | null;
    summary_len: number;
    cover: string | null;
    n_authors: number;
    n_genres: number;
    n_synonyms: number;
    n_gallery: number;
    n_volumes: number;
    n_chapters: number;
    n_readable: number;
    average_score: number | null;
    title_in_synonyms: boolean;
  }>>`
    SELECT
      m.id,
      m.title,
      md.source as md_source,
      md."sourceId" as md_source_id,
      COALESCE(LENGTH(md.summary), 0)::int as summary_len,
      md.cover,
      COALESCE(ARRAY_LENGTH(md.authors, 1), 0)::int as n_authors,
      COALESCE(ARRAY_LENGTH(md.genres, 1), 0)::int as n_genres,
      COALESCE(ARRAY_LENGTH(md.synonyms, 1), 0)::int as n_synonyms,
      COALESCE(ARRAY_LENGTH(md."galleryImages", 1), 0)::int as n_gallery,
      COALESCE((SELECT COUNT(*)::int FROM "Volume" v WHERE v."mangaId" = m.id), 0) as n_volumes,
      COALESCE((SELECT COUNT(*)::int FROM "Chapter" c WHERE c."mangaId" = m.id), 0) as n_chapters,
      COALESCE((SELECT COUNT(*)::int FROM "Chapter" c WHERE c."mangaId" = m.id AND c."downloadStatus" = 'COMPLETED' AND COALESCE(c."pageCount", 0) > 0), 0) as n_readable,
      md."averageScore" as average_score,
      CASE WHEN md.synonyms IS NOT NULL AND LOWER(m.title) = ANY(SELECT LOWER(UNNEST(md.synonyms))) THEN true ELSE false END as title_in_synonyms
    FROM "Manga" m
    LEFT JOIN "Metadata" md ON md.id = m."metadataId"
    ORDER BY m.title
  `;

  const classified: Array<Row & { tier: string }> = rows.map((r) => {
    const row: Row = {
      id: r.id,
      title: r.title,
      mdSource: r.md_source,
      mdSourceId: r.md_source_id,
      summaryLen: r.summary_len,
      coverReal: r.cover !== null && r.cover !== '/cover-not-found.jpg',
      nAuthors: r.n_authors,
      nGenres: r.n_genres,
      nSynonyms: r.n_synonyms,
      nGallery: r.n_gallery,
      nVolumes: r.n_volumes,
      nChapters: r.n_chapters,
      nReadable: r.n_readable,
      averageScore: r.average_score,
      titleInSynonyms: r.title_in_synonyms,
    };
    return { ...row, tier: classify(row) };
  });

  const header = [
    'tier', 'id', 'title', 'md_source', 'md_source_id',
    'summary_len', 'cover_real', 'n_authors', 'n_genres', 'n_synonyms',
    'n_gallery', 'n_volumes', 'n_chapters', 'n_readable', 'average_score',
    'title_in_synonyms',
  ].join('\t');
  const lines = [header];
  for (const c of classified) {
    lines.push([
      c.tier, c.id, c.title.replace(/\t/g, ' '), c.mdSource ?? '', c.mdSourceId ?? '',
      c.summaryLen, c.coverReal ? 't' : 'f', c.nAuthors, c.nGenres, c.nSynonyms,
      c.nGallery, c.nVolumes, c.nChapters, c.nReadable, c.averageScore ?? '',
      c.titleInSynonyms ? 't' : 'f',
    ].join('\t'));
  }
  const fs = await import('fs');
  fs.writeFileSync('scripts/audits/library-metadata-audit.tsv', lines.join('\n') + '\n');

  const counts: Record<string, number> = {};
  for (const c of classified) counts[c.tier] = (counts[c.tier] ?? 0) + 1;
  process.stdout.write(`\nTotal: ${classified.length}\n`);
  for (const [tier, n] of Object.entries(counts).sort()) {
    process.stdout.write(`  ${tier.padEnd(20)} ${n}\n`);
  }
  await prisma.$disconnect();
}

await main();
