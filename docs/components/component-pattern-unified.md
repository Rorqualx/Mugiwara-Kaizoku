# Component Pattern Unified

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Component Pattern Unified

---
# Component Pattern Unified Guide

> 📚 **Canonical Documentation**: This is the authoritative guide for React component patterns in Mugiwara-Kaizoku
>
> Last Updated: January 2025

## Overview

This guide consolidates all component patterns and best practices from various documentation sources into a single, authoritative reference. It supersedes conflicting guidance from older documents.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Component Structure Patterns](#component-structure-patterns)
3. [Type Safety Patterns](#type-safety-patterns)
4. [State Management](#state-management)
5. [Event Handling](#event-handling)
6. [AsyncResult Pattern](#asyncresult-pattern)
7. [Error Handling](#error-handling)
8. [Mantine UI Integration](#mantine-ui-integration)
9. [Testing Patterns](#testing-patterns)
10. [Migration Guide](#migration-guide)

---

## Core Principles

### 1. Type Safety First
- Always define explicit props interfaces with JSDoc comments
- Use discriminated unions for conditional props
- Implement type guards for runtime validation

### 2. Separation of Concerns
- Use Container/Presenter pattern for complex components
- Keep business logic separate from UI rendering
- Data fetching belongs in containers, not presenters

### 3. Consistent Patterns
- Use AsyncResult for all async operations
- Follow standardized event handler patterns
- Apply consistent error handling

---

## Component Structure Patterns

### Basic Component Structure

```typescript
import * as React from 'react';
import { useCallback, useState } from 'react';

/**
 * Props for the MyComponent
 * 
 * @interface MyComponentProps
 */
interface MyComponentProps {
  /** Required string prop */
  title: string;
  /** Optional callback */
  onAction?: (id: string) => void;
  /** Optional with default */
  showDetails?: boolean;
}

/**
 * MyComponent displays...
 * 
 * @component
 */
export function MyComponent({
  title,
  onAction,
  showDetails = true
}: MyComponentProps): React.ReactElement {
  // Component implementation
  return <div>{title}</div>;
}
```

### Container/Presenter Pattern

**When to use**: For components that need data fetching or complex state management

**Container Component** (`MyComponent.container.tsx`):
```typescript
export function MyComponentContainer(): React.ReactElement {
  // Handle data fetching and state
  const [data, setData] = useState<AsyncResult<Data, Error>>(
    createIdleResult()
  );
  
  useEffect(() => {
    fetchData().then(result => setData(result));
  }, []);
  
  // Pass to presenter
  return <MyComponentPresenter data={data} />;
}
```

**Presenter Component** (`MyComponent.presenter.tsx`):
```typescript
interface MyComponentPresenterProps {
  data: AsyncResult<Data, Error>;
}

export function MyComponentPresenter({ 
  data 
}: MyComponentPresenterProps): React.ReactElement {
  // Pure UI rendering
  return handleAsyncResult(data, {
    success: (value) => <div>{value.content}</div>,
    error: (err) => <ErrorDisplay error={err} />,
    loading: () => <LoadingSpinner />,
    idle: () => null
  });
}
```

---

## Type Safety Patterns

### Props Interface Pattern

```typescript
/**
 * Props for complex component with multiple states
 */
type ComponentProps = 
  | {
      mode: 'view';
      data: ReadonlyData;
    }
  | {
      mode: 'edit';
      data: MutableData;
      onChange: (data: MutableData) => void;
    };
```

### Type Guards

```typescript
/**
 * Type guard for ChapterEntity
 */
function isValidChapter(value: unknown): value is ChapterEntity {
  return (
    value != null &&
    typeof value === 'object' &&
    'id' in value &&
    'title' in value &&
    'mangaId' in value &&
    typeof value.id === 'number'
  );
}

// Usage
if (isValidChapter(data)) {
  // TypeScript knows data is ChapterEntity here
}
```

### Callback Types

```typescript
// Define specific callback types
export type ItemActionCallback = (id: number) => void;
export type ItemToggleCallback = (id: number, enabled: boolean) => void;
export type ItemSelectCallback = <T extends BaseItem>(item: T) => void;

// Use in props
interface ComponentProps {
  onDelete?: ItemActionCallback;
  onToggle?: ItemToggleCallback;
  onSelect?: ItemSelectCallback;
}
```

---

## State Management

### Local State with AsyncResult

```typescript
function MyComponent(): React.ReactElement {
  // Use AsyncResult for async state
  const [searchState, setSearchState] = useState<AsyncResult<SearchResults[], Error>>(
    createIdleResult()
  );
  
  const performSearch = useCallback(async (query: string) => {
    setSearchState(createLoadingResult());
    
    try {
      const results = await searchAPI(query);
      setSearchState(createSuccessResult(results));
    } catch (error) {
      setSearchState(createErrorResult(
        error instanceof Error ? error : new Error('Search failed')
      ));
    }
  }, []);
  
  // Render based on state
  return handleAsyncResult(searchState, {
    idle: () => <SearchPrompt />,
    loading: () => <LoadingIndicator />,
    error: (err) => <ErrorMessage error={err} />,
    success: (results) => <ResultsList results={results} />
  });
}
```

### Form State Management

```typescript
import { UseFormReturnType } from '@mantine/form';

interface FormData {
  title: string;
  description?: string;
  tags: string[];
}

interface ComponentProps {
  form: UseFormReturnType<FormData>;
}

function FormComponent({ form }: ComponentProps): React.ReactElement {
  // Safe form value access
  const { title = '', description, tags = [] } = form.values;
  
  // Type-safe updates
  const updateTitle = useCallback((value: string) => {
    form.setFieldValue('title', value);
  }, [form]);
  
  return (
    <TextInput
      value={title}
      onChange={(e) => updateTitle(e.currentTarget.value)}
    />
  );
}
```

---

## Event Handling

### Standard Event Handler Pattern

```typescript
// Input change handler
const handleInputChange = useCallback(
  (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.currentTarget.value;
    // Handle value
  },
  [/* dependencies */]
);

// Click handler with event
const handleClick = useCallback(
  (event: React.MouseEvent<HTMLElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    // Handle click
  },
  []
);

// Generic item handler
const handleItemAction = useCallback(
  <T extends { id: string }>(item: T): void => {
    // Handle item action
  },
  []
);
```

### Mantine-Specific Handlers

```typescript
// Select component handler
const handleSelectChange = useCallback(
  (value: string | null): void => {
    if (value) {
      // Handle selection
    }
  },
  []
);

// Tabs change handler
const handleTabChange = useCallback(
  (value: string | null): void => {
    if (value && isValidTab(value)) {
      // Handle tab change
    }
  },
  []
);
```

---

## AsyncResult Pattern

### Creating AsyncResult States

```typescript
import { 
  AsyncResult,
  createIdleResult,
  createLoadingResult,
  createSuccessResult,
  createErrorResult
} from '@/types/shared/async-result';

// Initial state
const idle = createIdleResult<Data, Error>();

// Loading state
const loading = createLoadingResult<Data, Error>();

// Success state
const success = createSuccessResult<Data, Error>(data);

// Error state
const error = createErrorResult<Data, Error>(new Error('Failed'));
```

### Handling AsyncResult in Components

```typescript
function DataDisplay({ 
  dataResult 
}: { 
  dataResult: AsyncResult<Data, Error> 
}): React.ReactElement {
  return handleAsyncResult(dataResult, {
    idle: () => <EmptyState />,
    loading: () => <Skeleton height={200} />,
    error: (error) => (
      <Alert color="red" title="Error">
        {error.message}
      </Alert>
    ),
    success: (data) => (
      <DataTable data={data} />
    )
  });
}
```

### Advanced AsyncResult Usage

```typescript
// Processing data with AsyncResult
const processedData = useMemo((): AsyncResult<ProcessedData, Error> => {
  try {
    if (!rawData) {
      return createIdleResult();
    }
    
    const processed = processRawData(rawData);
    return createSuccessResult({
      items: processed,
      stats: calculateStats(processed)
    });
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error('Processing failed')
    );
  }
}, [rawData]);
```

---

## Error Handling

### Try-Catch Pattern

```typescript
const handleAction = useCallback(async () => {
  try {
    await performAction();
  } catch (error) {
    // Type-safe error handling
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unknown error occurred';
    
    console.error('Action failed:', errorMessage);
    
    // Update UI state
    setError(errorMessage);
    
    // Show notification
    notifications.show({
      title: 'Error',
      message: errorMessage,
      color: 'red'
    });
  }
}, []);
```

### Error Boundaries

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ComponentErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Component error:', error, errorInfo);
  }
  
  render(): React.ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    
    return this.props.children;
  }
}
```

---

## Mantine UI Integration

### Typed Mantine Components

```typescript
import { MantineTheme } from '@mantine/core';

// Properly typed styles
<TextInput
  styles={(theme: MantineTheme) => ({
    input: {
      fontSize: theme.fontSizes.md,
      '&:focus': {
        borderColor: theme.colors.blue[5]
      }
    },
    label: {
      fontWeight: 500
    }
  })}
/>

// Dynamic select data
<Select
  data={providers.map(p => ({
    value: p.id || '',
    label: p.name || 'Unknown',
    disabled: !p.enabled
  }))}
  value={selectedProvider}
  onChange={handleProviderChange}
/>
```

### Mantine Form Integration

```typescript
import { useForm } from '@mantine/form';

const form = useForm<FormData>({
  initialValues: {
    title: '',
    tags: []
  },
  validate: {
    title: (value) => 
      value.length < 3 ? 'Title must be at least 3 characters' : null
  }
});

// Type-safe form usage
<form onSubmit={form.onSubmit(handleSubmit)}>
  <TextInput
    {...form.getInputProps('title')}
    label="Title"
    required
  />
</form>
```

---

## Testing Patterns

### Component Testing Structure

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  const defaultProps = {
    title: 'Test Title',
    onAction: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders with required props', () => {
    render(<MyComponent {...defaultProps} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });
  
  it('calls onAction when clicked', () => {
    render(<MyComponent {...defaultProps} />);
    fireEvent.click(screen.getByRole('button'));
    expect(defaultProps.onAction).toHaveBeenCalledWith(expect.any(String));
  });
});
```

### Testing AsyncResult States

```typescript
it('handles all AsyncResult states', async () => {
  const { rerender } = render(
    <DataDisplay dataResult={createIdleResult()} />
  );
  expect(screen.getByText('No data')).toBeInTheDocument();
  
  rerender(<DataDisplay dataResult={createLoadingResult()} />);
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  
  rerender(<DataDisplay dataResult={createErrorResult(new Error('Failed'))} />);
  expect(screen.getByText('Failed')).toBeInTheDocument();
  
  rerender(<DataDisplay dataResult={createSuccessResult(mockData)} />);
  expect(screen.getByText(mockData.title)).toBeInTheDocument();
});
```

---

## Migration Guide

### From Old Patterns to Unified Patterns

#### 1. React Imports
```typescript
// Old
import React from 'react';

// New
import * as React from 'react';
```

#### 2. Component Return Types
```typescript
// Old
function Component(): JSX.Element { }

// New
function Component(): React.ReactElement { }
```

#### 3. Event Handlers
```typescript
// Old
onChange={(e) => setValue(e.target.value)}

// New
onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
  setValue(e.currentTarget.value)
}
```

#### 4. AsyncResult Usage
```typescript
// Old - Various result types
type Result<T> = { data?: T; error?: string; }

// New - Standardized AsyncResult
type AsyncResult<T> = /* 4-state pattern */
```

### Gradual Migration Strategy

1. **Start with new components** - Apply patterns to new code first
2. **Update during maintenance** - Migrate when touching existing code
3. **Focus on high-traffic components** - Prioritize frequently used components
4. **Test thoroughly** - Ensure behavior remains unchanged

---

## Best Practices Summary

1. **Always use TypeScript** - No `any` types, explicit interfaces
2. **Document with JSDoc** - Especially for public APIs
3. **Use AsyncResult consistently** - For all async operations
4. **Implement proper error handling** - User-friendly error messages
5. **Follow Container/Presenter** - For complex components
6. **Write tests** - Cover all AsyncResult states
7. **Use type guards** - For runtime validation
8. **Memoize callbacks** - With proper dependencies

---

## References

- [Type System Architecture](../typescript/type-system-architecture-standardization.md)
- AsyncResult Pattern
- Testing Guide
- Error Handling

This guide represents the consolidated best practices for React components in the Mugiwara-Kaizoku project. When in doubt, follow these patterns for consistency across the codebase.
