/**
 * Wanted-list CRUD procedures: list, add, update, remove.
 */

import { WantedPriority, WantedStatus, type Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { EventType, EventSource } from '@/server/services/events/eventTypes';
import { protectedProcedure } from '@/server/trpc/procedures';
import { type WantedItem, type WantedItemsResponse } from '@/types/search.types';
import { toNumberId, toStringId } from '@/utils/id-converters';
import { logInfo, logError } from '@/utils/system-event-logger';

import {
  wantedSearchSchema,
  createWantedItemSchema,
  updateWantedItemSchema,
  type PrismaWhereClause
} from './schemas';

function buildWantedWhere(input: z.infer<typeof wantedSearchSchema>): PrismaWhereClause {
  const where: PrismaWhereClause = {};
  if (input.status?.length) where.status = { in: input.status };
  if (input.priority?.length) where.priority = { in: input.priority };
  if (input.dateRange) {
    where.dateAdded = { gte: input.dateRange.start, lte: input.dateRange.end };
  }
  if (input.searchTerm) {
    where.OR = [
      { metadata: { path: ['title'], string_contains: input.searchTerm } },
      { metadata: { path: ['chapterNumber'], string_contains: input.searchTerm } }
    ];
  }
  return where;
}

export const getWanted = protectedProcedure.input(wantedSearchSchema).query(async ({ input }) => {
  try {
    const where = buildWantedWhere(input);
    const [total, items] = await Promise.all([
      prisma.wantedItem.count({ where: where as Prisma.WantedItemWhereInput }),
      prisma.wantedItem.findMany({
        where: where as Prisma.WantedItemWhereInput,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: [{ priority: 'desc' }, { dateAdded: 'desc' }],
        include: {
          Manga: { include: { Metadata: true } },
          Chapter: true
        }
      })
    ]);

    const response: WantedItemsResponse = {
      items: items.map(item => item as unknown as WantedItem),
      total,
      page: input.page,
      pageSize: input.pageSize
    };
    return response;
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    void logError('Failed to get wanted items', EventSource.SYSTEM, errorMessage, {
      details: { input }
    });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get wanted items'
    });
  }
});

export const addToWanted = protectedProcedure.input(createWantedItemSchema).mutation(async ({ input }) => {
  try {
    const whereCheck: { mangaId: number; chapterId?: number } = { mangaId: input.mangaId };
    if (input.chapterId !== undefined) whereCheck.chapterId = input.chapterId;

    const existing = await prisma.wantedItem.findFirst({ where: whereCheck });
    if (existing) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Item already in wanted list' });
    }

    const wantedItem = await prisma.wantedItem.create({
      data: {
        mangaId: input.mangaId,
        priority: input.priority,
        status: WantedStatus.PENDING,
        dateAdded: new Date(),
        dateModified: new Date(),
        retryCount: 0,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        ...(input.chapterId !== undefined ? { chapterId: input.chapterId } : {})
      }
    });

    void logInfo('Added item to wanted list', EventType.USER_ACTION, EventSource.SYSTEM, {
      relatedEntityId: toStringId(wantedItem.id),
      relatedEntityType: 'wanted_item',
      details: { mangaId: input.mangaId, chapterId: input.chapterId }
    });
    return wantedItem as unknown as WantedItem;
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    void logError('Failed to add to wanted list', EventSource.SYSTEM, errorMessage, {
      details: { input }
    });
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to add to wanted list'
    });
  }
});

export const updateWanted = protectedProcedure.input(updateWantedItemSchema).mutation(async ({ input }) => {
  try {
    const updateData: { dateModified: Date; priority?: WantedPriority; status?: WantedStatus } = {
      dateModified: new Date()
    };
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.status !== undefined) updateData.status = input.status;

    const wantedItem = await prisma.wantedItem.update({
      where: { id: input.id },
      data: updateData
    });

    void logInfo('Updated wanted item', EventType.USER_ACTION, EventSource.SYSTEM, {
      relatedEntityId: toStringId(input.id),
      relatedEntityType: 'wanted_item',
      details: { updates: { priority: input.priority, status: input.status } }
    });
    return wantedItem as unknown as WantedItem;
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    void logError('Failed to update wanted item', EventSource.SYSTEM, errorMessage, {
      details: { input }
    });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update wanted item'
    });
  }
});

export const removeFromWanted = protectedProcedure.input(z.object({
  id: z.union([z.string(), z.number()]).transform((val) => toNumberId(val))
})).mutation(async ({ input }) => {
  try {
    await prisma.wantedItem.delete({ where: { id: input.id } });
    void logInfo('Removed item from wanted list', EventType.USER_ACTION, EventSource.SYSTEM, {
      relatedEntityId: toStringId(input.id),
      relatedEntityType: 'wanted_item'
    });
    return { success: true };
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    void logError('Failed to remove from wanted list', EventSource.SYSTEM, errorMessage, {
      relatedEntityId: toStringId(input.id),
      relatedEntityType: 'wanted_item'
    });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to remove from wanted list'
    });
  }
});
