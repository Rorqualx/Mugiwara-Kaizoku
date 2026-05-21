/**
 * One-off: remove all KR/CN manga (Korean manhwa + Chinese manhua) from
 * library 1, plus their on-disk folders when present.
 *
 * Run: bun run scripts/removeNonJpManga.ts [--commit]
 * Without --commit, prints what would happen. --commit actually deletes.
 */
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

const LIBRARY_ID = 1;
const COUNTRIES = ['KR', 'CN'];
const CHUNK = 500;

interface TargetManga {
    id: number;
    title: string;
    libraryPath: string | null;
    metadataId: number | null;
}

interface FolderEntry { id: number; title: string; path: string }

async function collectTargets(): Promise<{ libPath: string; rows: TargetManga[] }> {
    const lib = await prisma.library.findUnique({ where: { id: LIBRARY_ID } });
    if (!lib) {
        logger.error('library missing', { id: LIBRARY_ID });
        process.exit(1);
    }
    const rows = await prisma.manga.findMany({
        where: {
            libraryId: LIBRARY_ID,
            Metadata: { countryOfOrigin: { in: COUNTRIES } },
        },
        select: { id: true, title: true, libraryPath: true, metadataId: true },
    });
    return { libPath: lib.path, rows };
}

function classifyFolders(rows: TargetManga[], libPath: string): { present: FolderEntry[]; missing: number[] } {
    const present: FolderEntry[] = [];
    const missing: number[] = [];
    for (const r of rows) {
        const p = r.libraryPath ?? join(libPath, r.title);
        if (existsSync(p)) present.push({ id: r.id, title: r.title, path: p });
        else missing.push(r.id);
    }
    return { present, missing };
}

async function rmFolders(present: FolderEntry[]): Promise<void> {
    for (const f of present) {
        try {
            await rm(f.path, { recursive: true, force: true });
            logger.info('removed folder', { path: f.path });
        } catch (err) {
            logger.warn('rm failed', { path: f.path, error: err instanceof Error ? err.message : String(err) });
        }
    }
}

async function deleteInChunks(ids: number[], kind: 'manga' | 'metadata'): Promise<number> {
    let total = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const res = kind === 'manga'
            ? await prisma.manga.deleteMany({ where: { id: { in: chunk } } })
            : await prisma.metadata.deleteMany({ where: { id: { in: chunk } } });
        total += res.count;
    }
    return total;
}

async function main(): Promise<void> {
    const commit = process.argv.includes('--commit');
    const { libPath, rows } = await collectTargets();
    const { present, missing } = classifyFolders(rows, libPath);
    const metadataIds = rows.map(r => r.metadataId).filter((x): x is number => x !== null);
    const ids = rows.map(r => r.id);

    logger.info('plan', {
        library: libPath,
        matched: rows.length,
        foldersPresent: present.length,
        foldersMissing: missing.length,
        metadataCascade: metadataIds.length,
    });

    if (!commit) {
        logger.info('[DRY RUN] pass --commit to actually delete');
        for (const f of present.slice(0, 10)) logger.info('would rm', { path: f.path });
        await prisma.$disconnect();
        return;
    }

    logger.info('COMMIT: deleting folders');
    await rmFolders(present);
    const deletedManga = await deleteInChunks(ids, 'manga');
    const deletedMeta = await deleteInChunks(metadataIds, 'metadata');
    logger.info('deletion complete', { deletedManga, deletedMeta });
    await prisma.$disconnect();
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        logger.error('script failed', { error: err instanceof Error ? err.message : String(err) });
        process.exit(1);
    });
