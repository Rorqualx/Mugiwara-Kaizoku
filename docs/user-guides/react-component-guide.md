# React Component Type Safety Patterns

This document outlines the patterns and best practices for type-safe React components in the Mugiwara-Kaizoku project.

## Table of Contents

1. [React Import Patterns](#react-import-patterns)
2. [Component Props Type Safety](#component-props-type-safety)
3. [Form State Type Safety](#form-state-type-safety)
4. [Event Handler Type Safety](#event-handler-type-safety)
5. [AsyncResult Pattern in Components](#asyncresult-pattern-in-components)
6. [Mantine UI Integration](#mantine-ui-integration)
7. [Type Guards and Runtime Validation](#type-guards-and-runtime-validation)

## React Import Patterns

### Import React Namespace

Use namespace import to avoid esModuleInterop issues:

```typescript
// Preferred: Namespace import
import * as React from 'react';

// Avoid direct default import (creates esModuleInterop issues)
// import React from 'react';
```

### Explicit React Types

Import React types explicitly when needed:

```typescript
import * as React from 'react';
import { ChangeEvent, MouseEvent, useCallback, useState } from 'react';

// For component return types
function MyComponent(): React.ReactNode {
  // Implementation
}
```

## Component Props Type Safety

### Explicit Props Interface

Always define an explicit props interface with JSDoc comments:

```typescript
/**
 * Props for the SearchStep component
 * 
 * @interface SearchStepProps
 * @property {UseFormReturnType<FormType>} form - Form state
 * @property {Function} onSelect - Callback when a manga is selected
 * @property {number} selectedLibraryId - ID of the library (optional)
 */
interface SearchStepProps {
  /** Form state from Mantine useForm hook */
  form: UseFormReturnType<FormType>;
  /** Callback when a manga is selected */
  onSelect?: (manga: SearchResult | ProviderSearchResult) => void;
  /** ID of the library to which the manga will be added (optional) */
  selectedLibraryId?: number;
}
```

### Union Types for Callbacks

Use union types for callbacks that may receive multiple types:

```typescript
// Before - Limited to single type
onSelect?: (manga: SearchResult) => void;

// After - Supports multiple result types
onSelect?: (manga: SearchResult | ProviderSearchResult | ComponentMangaSearchResult) => void;
```

### Default Values for Optional Props

Use function parameter defaults for optional props:

```typescript
export function ConfirmationStep({
  formValues,
  onConfirm,
  isSubmitting = false,  // Default value for optional prop
  showDetails = true     // Default value for optional prop
}: ConfirmationStepProps): React.ReactNode {
  // Implementation
}
```

## Form State Type Safety

### Typed Form Hooks

Use properly typed form hooks:

```typescript
import { UseFormReturnType } from '@mantine/form';

interface FormType {
  query?: string;
  mangaTitle: string;
  mangaId: string;
  source?: string;
  [key: string]: unknown;  // Allow for additional properties
}

// Component props
interface ComponentProps {
  form: UseFormReturnType<FormType>;
}
```

### Safe Form Value Access

Access form values safely with type checks:

```typescript
// Extract values with type safety
const { 
  mangaTitle = '',  // Provide defaults for optional fields
  mangaId = '',
  source
} = form.values;

// Type check before using values
if (typeof source === 'string' && source.length > 0) {
  // Use source safely
}
```

### Form Updates with Type Safety

Update form values with type safety:

```typescript
// Type-safe form updates
form.setValues({
  ...form.values,
  mangaTitle: title,
  mangaId: id,
  // Add type checks for optional values
  description: typeof description === 'string' ? description : undefined
});
```

## Event Handler Type Safety

### Typed Event Handlers

Use properly typed event handlers:

```typescript
// Input change handler
const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
  const value = event.currentTarget.value;
  setQuery(value);
  form.setFieldValue('query', value);
};

// Button click handler
const handleSearchClick = (): void => {
  if (query.length >= 3) {
    stableSearch();
  }
};

// Selection handler with type parameters
const handleSelect = <T extends SearchResult>(item: T): void => {
  // Implementation
};
```

### Memoized Handlers with useCallback

Use `useCallback` for event handlers that depend on props or state:

```typescript
const handleMangaSelect = useCallback((selected: SearchResult | ProviderSearchResult): void => {
  if (selected) {
    try {
      // Implementation
    } catch (error) {
      // Error handling
    }
  }
}, [form, onSelect, defaultSource]); // Dependencies
```

## AsyncResult Pattern in Components

### Custom AsyncResult State Functions

Create custom type-safe functions for checking AsyncResult states:

```typescript
/**
 * Type guard to check if AsyncResult is in loading state
 */
function isAsyncLoading<T, E = Error>(
  result: AsyncResult<T, E>
): boolean {
  return result.status === 'loading';
}
```

### State Management with AsyncResult

Use AsyncResult for state management:

```typescript
// Define state with AsyncResult type
const [searchState, setSearchState] = useState<AsyncResult<ComponentMangaSearchResult[], Error>>(
  createIdleResult<ComponentMangaSearchResult[], Error>()
);

// Update state with appropriate functions
setSearchState(createLoadingResult<ComponentMangaSearchResult[], Error>());
setSearchState(createSuccessResult<ComponentMangaSearchResult[], Error>(results));
setSearchState(createErrorResult(new Error('Search failed')));
```

### Handling AsyncResult in Render

Use the `handleAsyncResult` utility for rendering different states:

```typescript
const renderResults = () => {
  return handleAsyncResult(searchState, {
    idle: () => <IdleStateComponent />,
    loading: () => <LoadingComponent />,
    error: (error) => <ErrorComponent message={error.message} />,
    success: (results) => <ResultsComponent data={results} />
  });
};
```

## Mantine UI Integration

### Properly Typed Style Props

Use properly typed style objects for Mantine components:

```typescript
import { MantineTheme, CSSProperties } from '@mantine/core';

// Properly typed styles function
<TextInput
  value={query}
  onChange={handleQueryChange}
  styles={(theme: MantineTheme) => ({
    input: {
      fontSize: theme.fontSizes.md,
      backgroundColor: 'transparent',
      // Other styles
    } as CSSProperties,
    wrapper: {
      border: 'none'
    } as CSSProperties
  })}
/>
```

### Dynamic Data for Select Components

Ensure type safety for dynamic data in select components:

```typescript
<Select
  value={selectedProvider}
  onChange={handleProviderChange}
  data={[
    { value: '', label: 'All providers' },
    ...enabledSources.map((provider: MetadataProvider) => ({
      value: provider.id || '',  // Ensure non-null string
      label: provider.name || provider.id || 'Unknown'  // Provide fallbacks
    }))
  ]}
/>
```

### Conditional Rendering with Type Safety

Use type-safe conditional rendering:

```typescript
{isNsfw && (
  <Badge color="red">NSFW</Badge>
)}

{genres.length > 0 && (
  <Text size="sm" c="dimmed" mt="xs" lineClamp={1}>
    {genres.join(', ')}
  </Text>
)}
```

## Type Guards and Runtime Validation

### Custom Type Guards

Create custom type guards for complex objects:

```typescript
/**
 * Type guard to check if an object has metadata with specific properties
 */
function hasMetadataWithNsfw(obj: unknown): obj is { 
  metadata: { isNsfw: boolean }
} {
  return (
    obj !== null && 
    typeof obj === 'object' && 
    'metadata' in obj && 
    obj.metadata !== null &&
    typeof obj.metadata === 'object' &&
    'isNsfw' in obj.metadata &&
    typeof obj.metadata.isNsfw === 'boolean'
  );
}
```

### Safe Property Access

Use type guards for safe property access:

```typescript
// Safe property access with type guards
const title = 
  typeof result.title === 'string' ? result.title : 'Unknown Title';

// Safe array access
const genres = 
  Array.isArray(result.genres) ? 
  result.genres.filter(g => typeof g === 'string') : 
  [];
```

### Standardized Type Converters

Create standardized conversion functions:

```typescript
/**
 * Safely converts any search result to a standardized format
 */
function adaptToMangaSearchResult(result: unknown, source: string): ComponentMangaSearchResult {
  if (!result || typeof result !== 'object') {
    return {
      id: `unknown-${Date.now()}`,
      title: 'Unknown Title',
      source,
      sourceId: `${source}-${Date.now()}`
    };
  }
  
  // Implementation with type safety
}
```

### Error Handling with Type Guards

Use type guards for error handling:

```typescript
try {
  // Implementation
} catch (error) {
  // Type-safe error handling
  const errorMessage = error instanceof Error 
    ? error.message 
    : 'An unknown error occurred';
    
  setSearchState(createErrorResult(new Error(errorMessage)));
}
```

## Conclusion

By following these patterns consistently across all React components, we can ensure type safety throughout the application. This reduces runtime errors, improves developer experience, and makes the codebase more maintainable.

Remember that type safety is not just about satisfying the TypeScript compiler, but about creating robust, predictable, and self-documenting code. Always prioritize clarity and correctness over brevity when implementing type-safe components.