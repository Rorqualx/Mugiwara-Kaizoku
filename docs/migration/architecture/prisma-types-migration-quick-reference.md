# PrismaTypes Migration Quick Reference

## 🚀 Quick Migration Guide

### Common Import Replacements

| Old Import | New Import |
|------------|------------|
| `from 'prismaTypes'` | See mappings below |
| `TaskStatus, TaskType` | `from './domain/task-types'` |
| `SyncStatus` | `from './domain/task-types'` |
| `ChapterStatus` | `from './domain/chapter-types'` |
| `MangaEntity, Manga` | `from './domain/manga-types'` |
| `ChapterEntity, Chapter` | `from './domain/chapter-types'` |
| `LibraryEntity, Library` | `from './domain/library-types'` |
| `BackupStatus, BackupType, BackupSchedule` | `from './domain/backup-types'` |
| `IntegrationSettings` | `from './domain/integration-settings-types'` |
| `DatabaseError, TaskError` | `from './domain/error-types'` |

### Function Migrations

| Old Import | New Import |
|------------|------------|
| `getBestAvailableCover()` | `from '../utils/manga-utils'` |
| `isPrismaError()` | `from '../utils/validation/type-guards'` |
| `isTaskType()` | `from '../utils/validation/task-validators'` |

### Path Corrections

Always check relative paths! Common patterns:

- From `src/server/services/*` → types: Use `../../../types/domain/`
- From `src/server/trpc/*` → types: Use `../../../types/domain/`
- From `src/server/queue/*` → types: Use `../../types/domain/`
- From `src/components/*` → types: Use `../../types/domain/`

### Complex Types (Need Special Handling)

These Prisma-specific types don't have direct domain equivalents:
- `Task` (Prisma model) → Consider using `TaskEntity` from domain
- `TaskCreateInput` → May need to remain as Prisma type
- `TransactionClient` → Create type alias or leave as Prisma type
- `InputJsonValue` → JSON type from Prisma
- `PrismaChapterStatus` → Use `ChapterStatus` from domain

### Migration Script

```bash
# For single file
./migrate-prisma-types.sh path/to/file.ts

# For multiple files
./migrate-prisma-types.sh src/server/queue/*.ts

# Check what still needs migration
grep -r "prismaTypes" src/ --include="*.ts" --include="*.tsx" | grep -v ".bak"
```

### Manual Migration Steps

1. **Check imports**: Look for `from '...prismaTypes'`
2. **Identify types**: Note which types are imported
3. **Find replacements**: Use the mapping table above
4. **Fix paths**: Ensure relative paths are correct
5. **Handle complex types**: Some may need special consideration
6. **Test**: Run `bun run type-check` after changes

### Common Issues

1. **Path errors**: `Cannot find module` → Fix relative path
2. **Missing exports**: `does not export` → Add export to domain file
3. **Type mismatch**: Different enum values → Check both enums match
4. **Prisma types**: No domain equivalent → Consider keeping as Prisma type

### Validation Commands

```bash
# Check types
bun run type-check

# Find remaining imports
grep -r "prismaTypes" src/ --include="*.ts" --include="*.tsx"

# Test build
bun run build:clean
```

## 🚨 Remember

- ESLint will flag new prismaTypes imports
- Always verify paths after migration
- Some Prisma types may not need migration
- Run type-check frequently
