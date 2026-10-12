/**
 * In-memory stand-in for the `metadataProviderClaim` model, supporting the
 * filters, orderings and aggregates `claim-queries.ts` uses. The real SQL is
 * exercised separately against a scratch database.
 */

import type { ClaimDb } from '@/server/services/metadata/provider-claims/claim-queries';

export interface FakeRow {
  id: bigint;
  mangaId: number;
  runId: string;
  provider: string;
  kind: string;
  field: string;
  providerRecordId: string | null;
  value: unknown;
  fetchOutcome: string;
  selectorOutcome: string | null;
  inWinningGroup: boolean | null;
  matchConfidence: number | null;
  fieldConfidence: number | null;
  detail: unknown;
  createdAt: Date;
}

type Where = Record<string, unknown>;
type OrderBy = Array<Record<string, 'asc' | 'desc'>>;

function matchesCondition(actual: unknown, condition: unknown): boolean {
  if (condition !== null && typeof condition === 'object' && !(condition instanceof Date)) {
    const rule = condition as { not?: unknown; in?: unknown[] };
    if ('not' in rule) return actual !== rule.not;
    if (Array.isArray(rule.in)) return rule.in.includes(actual);
  }
  return actual === condition;
}

function matches(row: FakeRow, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => matchesCondition(row[key as keyof FakeRow], condition));
}

function compareValues(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'bigint' && typeof b === 'bigint') return a < b ? -1 : a > b ? 1 : 0;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function sortRows(rows: FakeRow[], orderBy: OrderBy | undefined): FakeRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const clause of orderBy ?? []) {
      for (const [key, direction] of Object.entries(clause)) {
        const diff = compareValues(a[key as keyof FakeRow], b[key as keyof FakeRow]);
        if (diff !== 0) return direction === 'desc' ? -diff : diff;
      }
    }
    return 0;
  });
  return sorted;
}

export interface FakeClaimDb {
  db: ClaimDb;
  rows: FakeRow[];
  calls: { createMany: number; deleteMany: number };
  /** Make the named operation reject from now on. */
  failOn(operation: 'createMany' | 'groupBy' | 'findFirst'): void;
}

export function createFakeClaimDb(): FakeClaimDb {
  const state = { rows: [] as FakeRow[], nextId: 1n, failing: new Set<string>() };
  const calls = { createMany: 0, deleteMany: 0 };
  const guard = (operation: string): void => {
    if (state.failing.has(operation)) throw new Error(`fake ${operation} failure`);
  };

  const model = {
    async createMany(args: { data: Array<Omit<FakeRow, 'id'>> }): Promise<{ count: number }> {
      calls.createMany += 1;
      guard('createMany');
      for (const data of args.data) state.rows.push({ ...data, id: state.nextId++ });
      return { count: args.data.length };
    },
    async findFirst(args: { where?: Where; orderBy?: OrderBy }): Promise<FakeRow | null> {
      guard('findFirst');
      return sortRows(state.rows.filter(r => matches(r, args.where)), args.orderBy)[0] ?? null;
    },
    async findMany(args: { where?: Where; orderBy?: OrderBy }): Promise<FakeRow[]> {
      return sortRows(state.rows.filter(r => matches(r, args.where)), args.orderBy);
    },
    async groupBy(args: { where?: Where; skip?: number }): Promise<Array<{ runId: string }>> {
      guard('groupBy');
      const newest = new Map<string, FakeRow>();
      for (const row of state.rows.filter(r => matches(r, args.where))) {
        const seen = newest.get(row.runId);
        if (!seen || compareValues(row.createdAt, seen.createdAt) > 0 || row.id > seen.id) newest.set(row.runId, row);
      }
      const runs = [...newest.values()].sort((a, b) => compareValues(b.createdAt, a.createdAt) || compareValues(b.id, a.id));
      return runs.slice(args.skip ?? 0).map(row => ({ runId: row.runId }));
    },
    async deleteMany(args: { where?: Where }): Promise<{ count: number }> {
      calls.deleteMany += 1;
      const before = state.rows.length;
      const kept = state.rows.filter(r => !matches(r, args.where));
      state.rows.splice(0, state.rows.length, ...kept);
      return { count: before - kept.length };
    },
  };

  return {
    db: { metadataProviderClaim: model } as unknown as ClaimDb,
    rows: state.rows,
    calls,
    failOn: (operation): void => { state.failing.add(operation); },
  };
}
