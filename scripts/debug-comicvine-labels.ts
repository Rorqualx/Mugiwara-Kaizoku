/**
 * Debug script: re-run bootstrap labeler on a ComicVine volume page
 * and dump the token stream with labels for diagnosis.
 */
import { PrismaClient } from '@prisma/client';
import { bootstrapLabels } from '../src/server/ml/training/bootstrap-labeler/index.js';
import { extractMetadataValues } from '../src/server/ml/training/bootstrap-labeler/metadata-extraction.js';

const prisma = new PrismaClient();

function log(msg: string): void {
  process.stdout.write(msg + '\n');
}

async function main(): Promise<void> {
  // Find the Vinland Saga ComicVine issue page (Volume 1 / Issue #1)
  const pageId = process.argv[2] ?? 'cmlls3tks000rwc7wtginiv4f';
  const page = await prisma.annotatedPage.findFirst({
    where: { id: pageId },
    select: { id: true, url: true, htmlSnapshot: true },
  });

  if (!page) {
    log('Page not found. Trying other volume pages...');
    const pages = await prisma.annotatedPage.findMany({
      where: {
        url: { contains: 'comicvine' },
        sourceType: 'comicvine',
      },
      select: { id: true, url: true },
      take: 10,
    });
    log('Available ComicVine pages:');
    for (const p of pages) {
      log(`  ${p.url}`);
    }
    await prisma.$disconnect();
    return;
  }

  log(`\nRunning bootstrap labeler on: ${page.url}`);
  log(`HTML size: ${page.htmlSnapshot.length} chars`);

  // Check what metadata extraction finds
  const extracted = extractMetadataValues(page.htmlSnapshot, page.url);
  log(`\n=== EXTRACTED METADATA ===`);
  log(`  title: ${JSON.stringify(extracted.title)}`);
  log(`  format: ${JSON.stringify(extracted.format)}`);
  log(`  publisher: ${JSON.stringify(extracted.publisher)}`);
  log(`  releaseDate: ${JSON.stringify(extracted.releaseDate)}`);
  log(`  author: ${JSON.stringify(extracted.author)}`);
  log(`  artist: ${JSON.stringify(extracted.artist)}`);
  log(`  altTitles: ${JSON.stringify(extracted.altTitles)}`);
  log(`  summary: ${JSON.stringify(extracted.summary?.substring(0, 100))}`);
  log(`  volumeCount: ${JSON.stringify(extracted.volumeCount)}`);
  log(`  chapterCount: ${JSON.stringify(extracted.chapterCount)}`);
  log(`  genres: ${JSON.stringify(extracted.genres)}`);
  log(`  themes: ${JSON.stringify(extracted.themes)}`);

  const result = bootstrapLabels(page.htmlSnapshot, page.url);

  log(`\nTokens: ${result.tokens.length}, Labels: ${result.labels.length}`);
  log(`Spans: ${result.spans.length}`);

  // Show all spans (labeled entities)
  log('\n=== LABELED SPANS ===');
  for (const span of result.spans) {
    const spanTokens = result.tokens.slice(span.start, span.end + 1);
    const spanText = spanTokens.map(t => t.text).join(' ');
    log(`  ${span.entityType.padEnd(25)} [${span.start}-${span.end}] conf=${span.confidence.toFixed(2)} match=${span.matchType}`);
    log(`    Text: "${spanText}"`);
  }

  // Show ALL labeled tokens (not just first 50)
  log('\n=== ALL LABELED TOKENS ===');
  for (let i = 0; i < result.tokens.length; i++) {
    const l = result.labels[i];
    if (l === 'O') continue;
    const t = result.tokens[i];
    log(`  [${String(i).padStart(3)}] ${t.text.padEnd(25)} sec=${(t.sectionType ?? '').padEnd(15)} => ${l}`);
  }

  // Show first 50 tokens with full properties
  log('\n=== FIRST 50 TOKENS ===');
  for (let i = 0; i < Math.min(50, result.tokens.length); i++) {
    const t = result.tokens[i];
    const l = result.labels[i] ?? 'O';
    const marker = l !== 'O' ? ` <--- ${l}` : '';
    log(`[${String(i).padStart(3)}] ${t.text.padEnd(25)} sec=${(t.sectionType ?? '').padEnd(15)} hdr=${String(t.isHeader).padEnd(5)} hlvl=${t.headerLevel} tbl=${String(t.isInTable).padEnd(5)} nearLbl=${(t.nearestLabelText ?? '').padEnd(15)} dist=${String(t.distanceFromLabel).padStart(2)}${marker}`);
  }

  // Show tokens around issue details table area (280-330)
  log('\n=== TOKENS 280-330 (issue details area) ===');
  for (let i = 280; i < Math.min(330, result.tokens.length); i++) {
    const t = result.tokens[i];
    const l = result.labels[i] ?? 'O';
    const m = l !== 'O' ? ` <--- ${l}` : '';
    log(`  [${i}] "${t.text}" sec=${t.sectionType} hdr=${t.isHeader} tbl=${t.isInTable} nearLbl=${t.nearestLabelText ?? ''} dist=${t.distanceFromLabel} img=${t.isImage} imgSrc=${t.imageSrc?.substring(0, 60) ?? ''}${m}`);
  }

  // Show tokens around the large image
  log('\n=== IMAGE TOKENS ===');
  for (let i = 0; i < result.tokens.length; i++) {
    const t = result.tokens[i];
    if (t.isImage) {
      const l = result.labels[i] ?? 'O';
      const m = l !== 'O' ? ` <--- ${l}` : '';
      log(`  [${i}] sec=${t.sectionType} cls=[${t.classes.slice(0, 3).join(',')}] imgSrc=${t.imageSrc?.substring(0, 80) ?? ''}${m}`);
    }
  }

  // Show tokens 85-100 (around "Chapter Titles" header)
  log('\n=== TOKENS 85-135 (chapter area) ===');
  for (let i = 85; i < Math.min(135, result.tokens.length); i++) {
    const t = result.tokens[i];
    const l = result.labels[i] ?? 'O';
    const m = l !== 'O' ? ` <--- ${l}` : '';
    log(`  [${i}] "${t.text}" sec=${t.sectionType} hdr=${t.isHeader} inList=${t.isInList} nearLbl=${t.nearestLabelText ?? ''} dist=${t.distanceFromLabel}${m}`);
  }

  // Find and show tokens around "14 issues in this volume"
  log('\n=== TOKENS AROUND ISSUE GRID HEADER ===');
  for (let i = 0; i < result.tokens.length; i++) {
    const t = result.tokens[i];
    if (t.text === 'issues' || t.text === 'issue') {
      // Show context around this token
      const start = Math.max(0, i - 3);
      const end = Math.min(result.tokens.length, i + 10);
      log(`  Found "${t.text}" at index ${i}:`);
      for (let j = start; j < end; j++) {
        const ct = result.tokens[j];
        const cl = result.labels[j] ?? 'O';
        const m = cl !== 'O' ? ` <--- ${cl}` : '';
        log(`    [${j}] "${ct.text}" sec=${ct.sectionType} hdr=${ct.isHeader} hlvl=${ct.headerLevel}${m}`);
      }
      log('');
    }
  }

  // Find and show tokens around "Most issue credits"
  log('\n=== TOKENS AROUND "Most issue credits" ===');
  for (let i = 0; i < result.tokens.length; i++) {
    const t = result.tokens[i];
    if (t.text === 'Most') {
      const start = Math.max(0, i - 2);
      const end = Math.min(result.tokens.length, i + 15);
      log(`  Found "Most" at index ${i}:`);
      for (let j = start; j < end; j++) {
        const ct = result.tokens[j];
        const cl = result.labels[j] ?? 'O';
        const m = cl !== 'O' ? ` <--- ${cl}` : '';
        log(`    [${j}] "${ct.text}" sec=${ct.sectionType} hdr=${ct.isHeader} cls=[${ct.classes.slice(0, 3).join(',')}]${m}`);
      }
      log('');
    }
  }

  // Find Issue #14, #13 etc. tokens
  log('\n=== ISSUE GRID TOKENS ===');
  for (let i = 0; i < result.tokens.length; i++) {
    const t = result.tokens[i];
    if (t.text === 'Issue' || /^#\d+$/.test(t.text)) {
      const cl = result.labels[i] ?? 'O';
      const m = cl !== 'O' ? ` <--- ${cl}` : '';
      const next = result.tokens[i + 1];
      log(`  [${i}] "${t.text}" next="${next?.text ?? ''}" sec=${t.sectionType} hdr=${t.isHeader} img=${t.isImage}${m}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e: unknown) => {
  process.stderr.write(String(e) + '\n');
  process.exit(1);
});
