import type { Prisma } from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient;

export type PrismaTransactionClient = TransactionClient;

// Job-related transaction types
export interface JobTransaction {
  jobs: TransactionClient['jobs'];
}

export type JobWithRelations = Awaited<
  ReturnType<TransactionClient['jobs']['findUnique']>
>;

// JSON types
export type JsonObject = Record<string, unknown>;
export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

// Task/Job payload types
export interface TaskPayload {
  type: string;
  data: JsonObject;
}

