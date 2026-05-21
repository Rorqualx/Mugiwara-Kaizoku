# Prisma Types vs Canonical Types Comparison

## Key Differences

### 1. Library Type

**Prisma Library Model:**
```typescript
model Library {
  id        Int      @id @default(autoincrement())
  name      String
  path      String
  createdAt DateTime @default(now())
  mangas    Manga[]  // Note: "mangas" not "manga"
}
```

**Canonical LibraryEntity (entity.types.ts):**
```typescript
interface LibraryEntity extends BaseEntity {
  name: string;
  path: string;
  isDefault?: boolean;
  settings?: Record<string, any>;
  scanInterval?: number;
  lastScanAt?: Date | string;
  mangaCount?: number;
  chapterCount?: number;
  totalSize?: number;
}
```

**Canonical LibraryEntity (library.types.ts):**
```typescript
const LibraryEntitySchema = z.object({
  id: z.string(),  // STRING not number!
  userId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  isPrivate: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  mangaIds: z.array(z.string()).default([]),
  settings: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Note: NO PATH field!
});
```

### 2. Enum Values

**Prisma MangaFileStatus:**
- `PENDING`, `DOWNLOADING`, `IMPORTING`, `PROCESSING`, `COMPLETED`, `FAILED`, `DELETED`, `MISSING`, `QUEUED`

**Components are using:**
- `DOWNLOADED` (doesn't exist in Prisma)
- `ERROR` (should be `FAILED`)
- `ACTIVE` (doesn't exist, should be from MangaLibraryStatus)

### 3. ID Types

**Prisma:**
- All IDs are `Int` (number)

**Canonical Types:**
- Some use `string` (library.types.ts)
- Some use `number` (entity.types.ts)
- Some use `ID` type which is `string | number`

### 4. Relationship Names

**Prisma:**
- Library has `mangas` (plural)
- Uses standard Prisma naming

**Canonical/Components:**
- Sometimes expect `manga` (singular)
- Sometimes expect `mangas` (plural)
- Inconsistent usage

### 5. Additional Fields

**Canonical types have many fields not in Prisma:**
- `isDefault`, `isPrivate`, `tags` (Library)
- `settings`, `scanInterval`, `lastScanAt` (Library)
- `mangaCount`, `chapterCount`, `totalSize` (Library)

**Prisma has minimal fields:**
- Only what's actually in the database

## Why This Happened

1. **Evolution Over Time**: The project started with custom types, then added Prisma, but never fully migrated
2. **Multiple Definitions**: Different developers created types in different places
3. **UI vs Domain**: Canonical types mix UI concerns (display fields) with domain model
4. **No Single Source of Truth**: Both Prisma and canonical types claim to be authoritative

## The Problem

Components are written expecting the canonical types but the API returns Prisma types:
- Components expect `library.path` but canonical library.types.ts doesn't have it
- Components use enum values that don't exist in Prisma
- Type checking passes with canonical types but runtime fails with Prisma data

## Solutions

### Option 1: Use Prisma as Single Source of Truth (Recommended)
```typescript
// Use Prisma types directly
import { Library, Manga, MangaFileStatus } from '@prisma/client';

// Extend for UI needs
interface LibraryWithUI extends Library {
  mangaCount?: number;
  isDefault?: boolean;
}
```

### Option 2: Fix Canonical to Match Prisma Exactly
- Update all canonical types to match Prisma schema exactly
- Remove extra fields or make them optional
- Fix all enum values to match Prisma
- This maintains unnecessary abstraction

### Option 3: Generate Canonical from Prisma
```typescript
// Generate canonical types from Prisma
type CanonicalLibrary = Prisma.Library & {
  // Add UI-only fields here
  mangaCount?: number;
}
```

## Impact Analysis

**1,827 current errors are mostly due to:**
- 90% enum value mismatches
- 5% property name differences (manga vs mangas)
- 3% ID type mismatches (string vs number)
- 2% missing/extra properties

## Recommendation

**Use Prisma types directly** because:
1. They're always in sync with the database
2. No duplicate maintenance
3. TypeScript gets accurate types
4. Prisma generates them automatically
5. Single source of truth

Create separate UI types only when needed:
```typescript
// domain types (from Prisma)
import { Library } from '@prisma/client';

// UI types (app-specific)
interface LibraryCardProps {
  library: Library;
  mangaCount: number;
  isSelected: boolean;
}
```