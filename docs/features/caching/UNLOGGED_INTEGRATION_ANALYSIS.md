# UNLOGGED Tables Integration Analysis - Strategic Plan

*Date: 2025-10-19*
*Status: Implementation Plan*

---

## 🎯 Critical Priorities (Implement First)

### 1. **Reader Endpoints** - 15-30x Performance Gain 🚨
- **Impact**: Highest user-facing performance improvement
- **File**: `src/server/trpc/routers/reader.ts`
- **Current**: 30-50ms per page turn
- **Target**: 2-5ms (15-30x faster)
- **Volume**: 100-1000 requests per reading session

### 2. **Manga Detail Pages** - 27-75x Performance Gain
- **Impact**: Second highest user-facing improvement
- **File**: `src/server/trpc/routers/manga.ts`
- **Current**: 80-150ms per detail page load
- **Target**: 3-5ms (27-75x faster)
- **Volume**: 50-200 requests per session

### 3. **Search Enhancement** - 5-10x for Hot Queries
- **Impact**: Instant results for popular searches
- **File**: `src/server/trpc/routers/search.ts`
- **Current**: Already cached, needs hot promotion
- **Target**: Auto-promote at 10 accesses
- **Volume**: 20-100 searches per hour

---

## 📋 Implementation Strategy

### Phase 1: Reader Integration (Immediate)
**Goal**: Make page turns instant

**Implementation Points**:
1. `reader.ts:64-100` - `getChapterFile` endpoint
2. Add three-tier caching pattern
3. Cache chapter metadata with 1-hour TTL
4. Auto-promote chapters in active reading sessions

### Phase 2: Manga Detail Integration
**Goal**: Instant manga detail page loads

**Implementation Points**:
1. `manga.ts:getMangaById` endpoint
2. Cache full manga with relations
3. 10-minute TTL for manga data
4. Invalidate on manga updates

### Phase 3: Search Enhancement
**Goal**: Lightning-fast popular searches

**Implementation Points**:
1. `search.ts` - All search endpoints
2. Auto-promote searches with 10+ hits
3. Track search popularity
4. Smart invalidation on new releases

---

## 🔍 Type Safety Requirements

### No Implicit Any
```typescript
// ❌ BAD
async function getData(id) { ... }

// ✅ GOOD
async function getData(id: string): Promise<DataType> { ... }
```

### Explicit Return Types
```typescript
// ✅ Always specify return types
async function getHot<T = unknown>(
  entityType: EntityType,
  entityId: string
): Promise<T | null> { ... }
```

### Type Guards
```typescript
// ✅ Use type guards for runtime validation
if (isRecord(value) && 'id' in value) {
  // TypeScript knows value has 'id' property
}
```

---

## 📝 Project Standards (from CLAUDE.md)

1. **AST-Grep for code search** (not grep)
2. **Import from domain types** (`@/types/domain/manga-types`)
3. **Use AsyncResult pattern** for error handling
4. **No `any` types** - use `unknown` instead
5. **Mantine v7 props** (`fw`, `gap`, `justify`)
6. **tRPC v11 syntax** (`isPending` not `isLoading`)

---

## 🎯 Implementation Checklist

- [ ] Read project documentation
- [ ] Review existing cache implementations
- [ ] Implement Reader hot caching
- [ ] Implement Manga detail hot caching
- [ ] Enhance Search with auto-promotion
- [ ] Run type checks (zero errors)
- [ ] Test in dev environment
- [ ] Create integration documentation

---

*Starting implementation now...*
