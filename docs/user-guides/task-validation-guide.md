# Task Validation Utilities Guide

This document describes the task validation utilities that help ensure type safety and consistency when working with `JobStatus` and `JobType` enums throughout the application.

## Background

As part of our migration to a domain-driven type system, we've introduced standardized `JobStatus` and `JobType` enums (from `@prisma/client`, re-exported via `src/types/tasks.ts`). However, task status and type values can come from various sources in different formats:

- From the database as strings
- From user input
- From legacy code using different conventions
- From external APIs

To ensure robustness and type safety, we've created utilities that validate, convert, and format these values consistently.

## Available Utilities

### Validation Functions

Located in `src/utils/job-validation.ts`:

```typescript
// Check if a value is a valid JobStatus
isValidJobStatus(value: unknown): value is JobStatus

// Check if a value is a valid JobType
isValidJobType(value: unknown): value is JobType
```

These functions serve as type guards, ensuring that values conform to our domain enums.

### Conversion Functions

```typescript
// Convert a string to JobStatus, with fallback to pending
toJobStatus(status: string | undefined | null): JobStatus

// Convert a string to JobType, with fallback to chapter_check
toJobType(type: string | undefined | null): JobType
```

These functions handle various string formats and provide a robust way to convert them to domain enum values.

### Formatting Functions

For UI display, use the helpers in `src/components/jobs/history/helpers.ts`:

```typescript
// Get status badge info (label + color) for a JobStatus string
getStatusBadge(status: string): StatusBadgeInfo

// Get background/text colors for a badge color string
getStatusBadgeBgColor(color: string): string
getStatusBadgeTextColor(color: string): string
```

And `getTaskTypeLabel` (exported from `src/utils/job-utils.ts` and `src/components/jobs/history/helpers.ts`):

```typescript
// Get a human-readable label for a JobType
getTaskTypeLabel(type: JobType): string
```

These functions provide consistent formatting for display purposes in the UI.

## Migration from Legacy Task Aliases

Previously, some code used `toTaskStatus`/`toTaskType` aliases (still exported from `src/utils/job-validation.ts` for backward compatibility). These are thin aliases for `toJobStatus`/`toJobType`. Prefer the canonical names going forward.

If you're currently using the legacy task-named functions, you should migrate to the canonical job-named functions in `src/utils/job-validation.ts`:

| Legacy alias | Canonical (job-validation.ts) |
|----------------------------|--------------------------|
| `toTaskStatus(status)` | `toJobStatus(status)` |
| `toTaskType(type)` | `toJobType(type)` |

## Usage Examples

### Validating Task Status

```typescript
import { isValidJobStatus } from '@/utils/job-validation';

// When receiving a value that should be a JobStatus
function processTaskStatus(status: unknown) {
  if (isValidJobStatus(status)) {
    // TypeScript now knows that status is a JobStatus
    // Safe to use status in JobStatus-specific operations
  } else {
    console.error(`Invalid task status: ${status}`);
  }
}
```

### Converting Strings to Task Types

```typescript
import { toJobType, JobType } from '@/utils/job-validation';

// When receiving a string that should be converted to a JobType
function handleTaskTypeFromForm(typeString: string) {
  // Convert to enum (falls back to JobType.chapter_check if invalid)
  const taskType = toJobType(typeString);
  
  // Now taskType is guaranteed to be a valid JobType
  return taskType;
}
```

### Formatting for Display

```typescript
import { getStatusBadge } from '@/components/jobs/history/helpers';

// In a React component
function TaskStatusBadge({ status }: { status: string }) {
  const badge = getStatusBadge(status);
  return (
    <Badge color={badge.color}>
      {badge.label}
    </Badge>
  );
}
```

## Best Practices

1. **Always validate external input**: Use `isValidJobStatus` and `isValidJobType` as type guards when receiving values from APIs, forms, or other external sources.

2. **Use conversion functions for consistency**: When you need to convert a string to a task enum value, always use the conversion functions rather than direct casting or equality checks.

3. **Use formatting functions in UI components**: For consistent display of task status and types throughout the application, use `getStatusBadge` from `src/components/jobs/history/helpers.ts` and `getTaskTypeLabel` from `src/utils/job-utils.ts`.

4. **Default values**: When converting strings, consider what the appropriate default value should be for your specific use case.

## Troubleshooting

If you encounter issues with task status or type validation:

1. Check that you're importing from `@/utils/job-validation` and using the canonical `JobStatus`/`JobType` names from `@prisma/client`.

2. Ensure that any custom string formats are properly handled. If you find a common format that isn't supported, consider adding it to the legacy mapping in the validation functions.

3. Refer to `src/utils/job-validation.ts` itself for the conversion logic as the authoritative reference.

---

By using these validation utilities consistently throughout the application, we ensure type safety and a consistent approach to handling task status and type values.