# Task Validation Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Task Validation Guide

---
# Task Validation Utilities Guide

This document describes the task validation utilities that help ensure type safety and consistency when working with `TaskStatus` and `TaskType` enums throughout the application.

## Background

As part of our migration to a domain-driven type system, we've introduced standardized `TaskStatus` and `TaskType` enums in `src/types/domain/task-types.ts`. However, task status and type values can come from various sources in different formats:

- From the database as strings
- From user input
- From legacy code using different conventions
- From external APIs

To ensure robustness and type safety, we've created utilities that validate, convert, and format these values consistently.

## Available Utilities

### Validation Functions

Located in `src/utils/task-validation.ts`:

```typescript
// Check if a value is a valid TaskStatus
isValidTaskStatus(value: unknown): value is TaskStatus

// Check if a value is a valid TaskType
isValidTaskType(value: unknown): value is TaskType
```

These functions serve as type guards, ensuring that values conform to our domain enums.

### Conversion Functions

```typescript
// Convert a string to TaskStatus, with fallback
toTaskStatus(value: string, defaultValue = TaskStatus.PENDING): TaskStatus

// Convert a string to TaskType, with fallback
toTaskType(value: string, defaultValue = TaskType.CUSTOM): TaskType
```

These functions handle various string formats and provide a robust way to convert them to domain enum values.

### Formatting Functions

```typescript
// Get a human-readable label for a TaskStatus
getTaskStatusLabel(status: TaskStatus): string

// Get a human-readable label for a TaskType
getTaskTypeLabel(type: TaskType): string

// Get an appropriate CSS color for a TaskStatus
getTaskStatusColor(status: TaskStatus): string
```

These functions provide consistent formatting for display purposes in the UI.

## Migration from Legacy Compatibility Layer

Previously, we used a simpler compatibility layer in `src/utils/task-compatibility.ts`. That module has been deprecated in favor of the more robust validation utilities described here.

If you're currently using functions from `task-compatibility.ts`, you should migrate to the equivalent functions in `task-validation.ts`:

| Old (task-compatibility.ts) | New (task-validation.ts) |
|----------------------------|--------------------------|
| `toTaskStatus(status)` | `toTaskStatus(status, defaultValue)` |
| `toTaskType(type)` | `toTaskType(type, defaultValue)` |
| `isValidTaskStatus(status)` | `isValidTaskStatus(value)` |
| `isValidTaskType(type)` | `isValidTaskType(value)` |

## Usage Examples

### Validating Task Status

```typescript
import { isValidTaskStatus } from '@/utils/task-validation';

// When receiving a value that should be a TaskStatus
function processTaskStatus(status: unknown) {
  if (isValidTaskStatus(status)) {
    // TypeScript now knows that status is a TaskStatus
    // Safe to use status in TaskStatus-specific operations
  } else {
    console.error(`Invalid task status: ${status}`);
  }
}
```

### Converting Strings to Task Types

```typescript
import { toTaskType, TaskType } from '@/utils/task-validation';

// When receiving a string that should be converted to a TaskType
function handleTaskTypeFromForm(typeString: string) {
  // Convert to domain enum with custom default
  const taskType = toTaskType(typeString, TaskType.CUSTOM);
  
  // Now taskType is guaranteed to be a valid TaskType
  return taskType;
}
```

### Formatting for Display

```typescript
import { getTaskStatusLabel, getTaskStatusColor } from '@/utils/task-validation';

// In a React component
function TaskStatusBadge({ status }) {
  return (
    <Badge 
      color={getTaskStatusColor(status)}
      label={getTaskStatusLabel(status)}
    />
  );
}
```

## Best Practices

1. **Always validate external input**: Use `isValidTaskStatus` and `isValidTaskType` as type guards when receiving values from APIs, forms, or other external sources.

2. **Use conversion functions for consistency**: When you need to convert a string to a task enum value, always use the conversion functions rather than direct casting or equality checks.

3. **Use formatting functions in UI components**: For consistent display of task status and types throughout the application, use the formatting functions.

4. **Default values**: When converting strings, consider what the appropriate default value should be for your specific use case.

## Troubleshooting

If you encounter issues with task status or type validation:

1. Check that you're importing from `@/utils/task-validation` rather than the deprecated `task-compatibility` module.

2. Ensure that any custom string formats are properly handled. If you find a common format that isn't supported, consider adding it to the legacy mapping in the validation functions.

3. Use the tests in `src/utils/__tests__/task-validation.test.ts` as examples of expected behavior.

---

By using these validation utilities consistently throughout the application, we ensure type safety and a consistent approach to handling task status and type values.