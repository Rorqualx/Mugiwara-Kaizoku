import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

const MAX_CONTEXT_BYTES = 2048;

export type ParseFailureSource = 'fandom' | 'wikipedia' | 'comicvine' | 'mangadex' | 'kitsu';

export interface ParseFailureArgs {
  source: ParseFailureSource;
  url: string;
  stage: string;
  mangaId?: number;
  reason: string;
  context?: Record<string, unknown>;
}

function truncateContext(context: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const json = JSON.stringify(context);
  if (json.length <= MAX_CONTEXT_BYTES) return context;
  return { _truncated: true, preview: json.slice(0, MAX_CONTEXT_BYTES) };
}

export async function logParseFailure(args: ParseFailureArgs): Promise<void> {
  try {
    const truncated = truncateContext(args.context);
    const data: Prisma.ParseFailureLogCreateInput = {
      source: args.source,
      url: args.url,
      stage: args.stage,
      reason: args.reason,
    };
    if (args.mangaId !== undefined) data.mangaId = args.mangaId;
    if (truncated !== undefined) data.contextJson = truncated as Prisma.InputJsonValue;
    await prisma.parseFailureLog.create({ data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('ParseFailureLog insert failed (swallowed)', {
      source: args.source,
      stage: args.stage,
      url: args.url,
      error: message,
    });
  }
}
