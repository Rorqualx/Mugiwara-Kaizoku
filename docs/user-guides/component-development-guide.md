# React Component Development Guide

> 📚 **Canonical Documentation**: This is the authoritative guide for React component development in Mugiwara-Kaizoku
>
> Last Updated: June 2025

## Overview

This guide provides comprehensive standards and best practices for developing React components in the Mugiwara-Kaizoku project. It covers component architecture, state management, error handling, and integration with the project's core patterns.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Component Architecture](#component-architecture)
3. [Type Safety](#type-safety)
4. [State Management](#state-management)
5. [AsyncResult Integration](#asyncresult-integration)
6. [Error Handling](#error-handling)
7. [Event Handling](#event-handling)
8. [Mantine UI Integration](#mantine-ui-integration)
9. [Testing Components](#testing-components)
10. [Performance Optimization](#performance-optimization)
11. [Best Practices](#best-practices)
12. [Example Implementations](#example-implementations)

---

## Core Principles

### 1. Separation of Concerns

- Keep business logic separate from UI rendering
- Use Container/Presenter pattern for complex components
- Data fetching belongs in hooks or container components

### 2. Type Safety First

- Always define explicit prop interfaces with JSDoc comments
- Use discriminated unions for conditional props
- Implement type guards for runtime validation

### 3. Consistent Error Handling

- Use the AsyncResult pattern for all async operations
- Handle all possible states (idle, loading, error, success)
- Provide meaningful error messages with context

### 4. Performance Awareness

- Memoize expensive operations with useMemo and useCallback
- Avoid unnecessary re-renders
- Optimize component rendering for large lists

---

## Component Architecture

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

The Container/Presenter pattern is the preferred approach for complex components that need data fetching or state management.

#### When to Use

- Components that require data fetching from APIs
- Components with complex state management
- Components that need to perform side effects
- Components that handle multiple async operations

#### Container Component

The Container component is responsible for:
- Data fetching and state management
- Side effects (useEffect, event listeners)
- Error handling
- Passing props to the Presenter component

```typescript
/**
 * Container component for UserProfile that handles data fetching and state
 */
export function UserProfileContainer({ userId }: { userId: string }): React.ReactElement {
  // State management with AsyncResult
  const [userState, setUserState] = useState<AsyncResult<User, Error>>(
    createIdleResult()
  );
  
  // Fetch data
  useEffect(() => {
    const fetchUser = async () => {
      setUserState(createLoadingResult());
      
      try {
        const response = await api.getUser(userId);
        setUserState(createSuccessResult(response));
      } catch (error) {
        setUserState(createErrorResult(
          error instanceof Error ? error : new Error(`Failed to fetch user: ${String(error)}`)
        ));
      }
    };
    
    fetchUser();
  }, [userId]);
  
  // Pass data to presenter
  return <UserProfilePresenter userState={userState} />;
}
```

#### Presenter Component

The Presenter component is responsible for:
- Pure UI rendering based on props
- No side effects or data fetching
- Handling different visual states

```typescript
/**
 * Props for the UserProfilePresenter
 */
interface UserProfilePresenterProps {
  /** User data AsyncResult */
  userState: AsyncResult<User, Error>;
}

/**
 * Presenter component for UserProfile that handles rendering
 */
export function UserProfilePresenter({ 
  userState 
}: UserProfilePresenterProps): React.ReactElement {
  // Handle all AsyncResult states
  return handleAsyncResult(userState, {
    idle: () => <div>Ready to load user</div>,
    loading: () => <LoadingSpinner />,
    error: (error) => <ErrorDisplay error={error} />,
    success: (user) => (
      <div>
        <h1>{user.name}</h1>
        <p>{user.email}</p>
        {/* Additional UI */}
      </div>
    )
  });
}
```

#### Export Pattern

Typically, you should export only the Container component, with the Presenter being a local implementation detail:

```typescript
// UserProfile.tsx
import * as React from 'react';

// Local Presenter component
function UserProfilePresenter(/* props */) {
  // Implementation
}

// Exported Container component
export function UserProfile(/* props */) {
  // Implementation
  return <UserProfilePresenter /* props */ />;
}
```

### Composable Components

For reusable components, follow a composable pattern that allows flexibility:

```typescript
/**
 * Props for the Card component
 */
interface CardProps {
  /** Card title */
  title: string;
  /** Card content */
  children: React.ReactNode;
  /** Additional actions */
  actions?: React.ReactNode;
  /** Card variant */
  variant?: 'default' | 'outlined' | 'elevated';
}

/**
 * Card component for displaying content in a card format
 */
export function Card({
  title,
  children,
  actions,
  variant = 'default'
}: CardProps): React.ReactElement {
  return (
    <div className={`card card--${variant}`}>
      <div className="card__header">
        <h2 className="card__title">{title}</h2>
      </div>
      <div className="card__content">
        {children}
      </div>
      {actions && (
        <div className="card__actions">
          {actions}
        </div>
      )}
    </div>
  );
}
```

---

## Type Safety

### Props Interface Pattern

Always define explicit prop interfaces with JSDoc comments:

```typescript
/**
 * Props for the SearchStep component
 * 
 * @interface SearchStepProps
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

### Discriminated Union Props

Use discriminated unions for components with different modes:

```typescript
/**
 * Props for the ContentView component with different modes
 */
type ContentViewProps = 
  | {
      mode: 'view';
      data: ReadonlyData;
      onEdit?: () => void;
    }
  | {
      mode: 'edit';
      data: MutableData;
      onSave: (data: MutableData) => void;
      onCancel: () => void;
    };

/**
 * ContentView component that supports view and edit modes
 */
export function ContentView(props: ContentViewProps): React.ReactElement {
  if (props.mode === 'view') {
    return (
      <div>
        <h2>{props.data.title}</h2>
        <p>{props.data.description}</p>
        {props.onEdit && <button onClick={props.onEdit}>Edit</button>}
      </div>
    );
  }
  
  // Edit mode
  return (
    <form onSubmit={() => props.onSave(props.data)}>
      {/* Form fields */}
      <div>
        <button type="submit">Save</button>
        <button type="button" onClick={props.onCancel}>Cancel</button>
      </div>
    </form>
  );
}
```

### Type Guards for Runtime Validation

Create type guards to validate data at runtime:

```typescript
/**
 * Type guard for validating manga search results
 */
function isValidMangaResult(data: unknown): data is MangaSearchResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'title' in data &&
    'source' in data &&
    typeof (data as MangaSearchResult).id === 'string' &&
    typeof (data as MangaSearchResult).title === 'string' &&
    typeof (data as MangaSearchResult).source === 'string'
  );
}

// Usage in component
function processMangaResults(results: unknown[]): MangaSearchResult[] {
  return results.filter(isValidMangaResult);
}
```

### Default Values for Optional Props

Always provide default values for optional props to avoid null/undefined errors:

```typescript
export function ConfirmationStep({
  formValues,
  onConfirm,
  isSubmitting = false,  // Default value for optional prop
  showDetails = true     // Default value for optional prop
}: ConfirmationStepProps): React.ReactElement {
  // Implementation
}
```

---

## State Management

### Local State

For simple components with local state:

```typescript
function Counter(): React.ReactElement {
  const [count, setCount] = useState<number>(0);
  
  const increment = useCallback(() => {
    setCount(prevCount => prevCount + 1);
  }, []);
  
  const decrement = useCallback(() => {
    setCount(prevCount => Math.max(0, prevCount - 1));
  }, []);
  
  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  );
}
```

### Form State Management

Use Mantine's useForm hook for form state management:

```typescript
import { useForm } from '@mantine/form';

// Define form data type
interface FormData {
  title: string;
  description?: string;
  status: 'active' | 'inactive';
}

function MangaForm({ initialData, onSubmit }: {
  initialData?: Partial<FormData>;
  onSubmit: (data: FormData) => void;
}): React.ReactElement {
  // Initialize form with validation
  const form = useForm<FormData>({
    initialValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      status: initialData?.status || 'active'
    },
    validate: {
      title: (value) => (value.length < 3 ? 'Title must be at least 3 characters' : null)
    }
  });
  
  // Handle form submission
  const handleSubmit = form.onSubmit((values) => {
    onSubmit(values);
  });
  
  return (
    <form onSubmit={handleSubmit}>
      <TextInput
        label="Title"
        placeholder="Enter title"
        required
        {...form.getInputProps('title')}
      />
      <Textarea
        label="Description"
        placeholder="Enter description"
        {...form.getInputProps('description')}
      />
      <Select
        label="Status"
        data={[
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' }
        ]}
        {...form.getInputProps('status')}
      />
      <Button type="submit">Submit</Button>
    </form>
  );
}
```

### Complex State with useReducer

For complex component state, use useReducer:

```typescript
// Define state and actions
interface State {
  items: Item[];
  selectedItemId: string | null;
  isLoading: boolean;
  error: Error | null;
}

type Action =
  | { type: 'FETCH_ITEMS_START' }
  | { type: 'FETCH_ITEMS_SUCCESS'; payload: Item[] }
  | { type: 'FETCH_ITEMS_ERROR'; payload: Error }
  | { type: 'SELECT_ITEM'; payload: string }
  | { type: 'DESELECT_ITEM' };

// Reducer function
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_ITEMS_START':
      return {
        ...state,
        isLoading: true,
        error: null
      };
    case 'FETCH_ITEMS_SUCCESS':
      return {
        ...state,
        items: action.payload,
        isLoading: false
      };
    case 'FETCH_ITEMS_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload
      };
    case 'SELECT_ITEM':
      return {
        ...state,
        selectedItemId: action.payload
      };
    case 'DESELECT_ITEM':
      return {
        ...state,
        selectedItemId: null
      };
    default:
      return state;
  }
}

// Component using reducer
function ItemList(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    selectedItemId: null,
    isLoading: false,
    error: null
  });
  
  // Fetch items
  useEffect(() => {
    dispatch({ type: 'FETCH_ITEMS_START' });
    
    fetchItems()
      .then(items => dispatch({ type: 'FETCH_ITEMS_SUCCESS', payload: items }))
      .catch(error => dispatch({ 
        type: 'FETCH_ITEMS_ERROR', 
        payload: error instanceof Error ? error : new Error(String(error))
      }));
  }, []);
  
  // Render based on state
  if (state.isLoading) {
    return <LoadingSpinner />;
  }
  
  if (state.error) {
    return <ErrorDisplay error={state.error} />;
  }
  
  return (
    <div>
      {state.items.map(item => (
        <ItemCard
          key={item.id}
          item={item}
          isSelected={item.id === state.selectedItemId}
          onSelect={() => dispatch({ type: 'SELECT_ITEM', payload: item.id })}
        />
      ))}
    </div>
  );
}
```

---

## AsyncResult Integration

### Creating AsyncResult States

```typescript
import { 
  AsyncResult,
  createIdleResult,
  createLoadingResult,
  createSuccessResult,
  createErrorResult,
  isLoading,
  isSuccess,
  isError,
  isIdle
} from '../utils/async-result';

// Define state with AsyncResult
const [searchState, setSearchState] = useState<AsyncResult<MangaSearchResult[], Error>>(
  createIdleResult()
);

// Update state for different async stages
setSearchState(createLoadingResult());
setSearchState(createSuccessResult(results));
setSearchState(createErrorResult(new Error('Search failed')));
```

### Using AsyncResult in Components

The recommended pattern for handling AsyncResult in components is the `handleAsyncResult` utility:

```typescript
function SearchResults({ 
  searchState 
}: { 
  searchState: AsyncResult<MangaSearchResult[], Error>
}): React.ReactElement {
  return handleAsyncResult(searchState, {
    idle: () => <EmptyState message="Enter a search query to begin" />,
    loading: () => <LoadingSpinner />,
    error: (error) => (
      <ErrorState 
        message={`Search failed: ${error.message}`} 
        retry={onRetry} 
      />
    ),
    success: (results) => (
      results.length > 0 
        ? <ResultsList results={results} onSelect={onSelect} />
        : <EmptyState message="No results found" />
    )
  });
}
```

### Manual AsyncResult Handling

For more control over rendering, you can handle states manually:

```typescript
function MangaDetails({ mangaId }: { mangaId: string }): React.ReactElement {
  const { mangaState, fetchManga } = useManga(mangaId);
  
  // Handle each state separately
  if (isIdle(mangaState)) {
    return (
      <div>
        <p>Ready to load manga details</p>
        <Button onClick={() => fetchManga(mangaId)}>Load</Button>
      </div>
    );
  }
  
  if (isLoading(mangaState)) {
    return <LoadingSpinner size="lg" />;
  }
  
  if (isError(mangaState)) {
    return (
      <ErrorDisplay 
        error={mangaState.error} 
        retry={() => fetchManga(mangaId)}
      />
    );
  }
  
  // Success state
  const manga = mangaState.data;
  
  return (
    <div>
      <h1>{manga.title}</h1>
      <p>{manga.description}</p>
      {/* Additional details */}
    </div>
  );
}
```

### Processing AsyncResult Data

Use helper functions to safely process AsyncResult data:

```typescript
// Get a safe value with fallback
const title = getDataOr(mangaState, 'Unknown Title');

// Get a property with fallback
const author = getProperty(mangaState, 'author', 'Unknown Author');

// Map AsyncResult data (if successful)
const titleResult = mapResult(mangaState, manga => manga.title);

// Filter array items in AsyncResult data
const activeChaptersResult = filterAsyncResult(
  chaptersResult, 
  chapter => chapter.status === 'active'
);
```

---

## Error Handling

### Try-Catch Pattern

Use try-catch with proper error typing for event handlers:

```typescript
const handleSubmit = async (formData: FormData) => {
  try {
    await saveManga(formData);
    notifications.show({
      title: 'Success',
      message: 'Manga saved successfully',
      color: 'green'
    });
  } catch (error) {
    // Properly type and format the error
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unknown error occurred';
    
    console.error('Failed to save manga:', error);
    
    notifications.show({
      title: 'Error',
      message: `Failed to save manga: ${errorMessage}`,
      color: 'red'
    });
  }
};
```

### Error Boundaries

Use error boundaries to catch and handle errors in the component tree:

```typescript
class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error
    console.error('Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <MyComponent />
    </ErrorBoundary>
  );
}
```

### Contextual Errors

Create contextual errors with enhanced information:

```typescript
import { createContextualErrorCreator } from '../utils/error-handling';

// Create a component-specific error creator
const createError = createContextualErrorCreator({
  service: 'MangaForm',
  resourceType: 'manga'
});

// Use in component methods
const validateForm = (data: FormData) => {
  if (!data.title) {
    throw createError(
      'Title is required',
      'validateForm',
      { formData: data }
    );
  }
  
  if (data.title.length < 3) {
    throw createError(
      'Title must be at least 3 characters',
      'validateForm',
      { title: data.title, titleLength: data.title.length }
    );
  }
};
```

### Enhanced Async Error Handling

Use the `withEnhancedErrorHandling` utility for async operations:

```typescript
const fetchManga = async (id: string): Promise<AsyncResult<MangaEntity, Error>> => {
  return withEnhancedErrorHandling(async () => {
    // Validate input
    if (!id) {
      throw new Error('Manga ID is required');
    }
    
    // Fetch data
    const response = await api.getManga(id);
    
    // Process response
    return {
      id: response.id,
      title: response.title,
      // Map other properties
    };
  }, {
    operation: 'fetchManga',
    service: 'MangaComponent',
    resourceType: 'manga',
    resourceId: id
  });
};
```

---

## Event Handling

### Typed Event Handlers

Use properly typed event handlers:

```typescript
// Input change handler
const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
  const value = event.currentTarget.value;
  setQuery(value);
};

// Button click handler
const handleSearchClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
  event.preventDefault();
  if (query.length >= 3) {
    performSearch(query);
  }
};

// Form submit handler
const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
  event.preventDefault();
  // Form submission logic
};
```

### Memoized Handlers with useCallback

Use `useCallback` for event handlers that are passed to child components:

```typescript
const handleMangaSelect = useCallback((manga: MangaSearchResult): void => {
  setSelectedManga(manga);
  if (onSelect) {
    onSelect(manga);
  }
}, [onSelect]); // Depends on onSelect prop
```

### Generic Type Parameters in Handlers

Use generic type parameters for handlers that work with different item types:

```typescript
const handleItemAction = useCallback(<T extends { id: string }>(
  item: T,
  action: 'edit' | 'delete' | 'view'
): void => {
  switch (action) {
    case 'edit':
      navigate(`/edit/${item.id}`);
      break;
    case 'delete':
      confirmDelete(item.id);
      break;
    case 'view':
      navigate(`/view/${item.id}`);
      break;
  }
}, [navigate, confirmDelete]);
```

---

## Mantine UI Integration

### Properly Typed Style Props

Use properly typed style objects for Mantine components:

```typescript
import { MantineTheme } from '@mantine/core';

<TextInput
  value={query}
  onChange={handleQueryChange}
  styles={(theme: MantineTheme) => ({
    input: {
      fontSize: theme.fontSizes.md,
      backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.white,
      borderColor: theme.colors.gray[5],
      '&:focus': {
        borderColor: theme.colors.blue[5]
      }
    },
    label: {
      fontWeight: 500,
      marginBottom: theme.spacing.xs
    }
  })}
/>
```

### Type-Safe Select Data

Use properly typed data for Select components:

```typescript
<Select
  label="Provider"
  value={selectedProvider}
  onChange={handleProviderChange}
  data={[
    { value: '', label: 'All providers' },
    ...enabledProviders.map((provider: MetadataProvider) => ({
      value: provider.id || '',
      label: provider.name || provider.id || 'Unknown',
      disabled: !provider.enabled
    }))
  ]}
/>
```

### Form Integration

Use Mantine's form hooks with proper typing:

```typescript
import { useForm } from '@mantine/form';

interface FormValues {
  title: string;
  author: string;
  genres: string[];
  isPublished: boolean;
}

const form = useForm<FormValues>({
  initialValues: {
    title: '',
    author: '',
    genres: [],
    isPublished: false
  },
  validate: {
    title: (value) => (value.length < 3 ? 'Title must be at least 3 characters' : null),
    author: (value) => (value.length === 0 ? 'Author is required' : null)
  }
});

// In JSX
<form onSubmit={form.onSubmit(handleSubmit)}>
  <TextInput
    label="Title"
    required
    {...form.getInputProps('title')}
  />
  <TextInput
    label="Author"
    required
    {...form.getInputProps('author')}
  />
  <MultiSelect
    label="Genres"
    data={genreOptions}
    {...form.getInputProps('genres')}
  />
  <Switch
    label="Published"
    {...form.getInputProps('isPublished', { type: 'checkbox' })}
  />
  <Button type="submit">Submit</Button>
</form>
```

---

## Testing Components

### Component Testing Structure

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  // Define default props and mocks
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
  
  it('calls onAction when button is clicked', async () => {
    render(<MyComponent {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /action/i }));
    expect(defaultProps.onAction).toHaveBeenCalledTimes(1);
  });
  
  it('shows details when showDetails is true', () => {
    render(<MyComponent {...defaultProps} showDetails={true} />);
    expect(screen.getByTestId('details')).toBeInTheDocument();
  });
  
  it('hides details when showDetails is false', () => {
    render(<MyComponent {...defaultProps} showDetails={false} />);
    expect(screen.queryByTestId('details')).not.toBeInTheDocument();
  });
});
```

### Testing AsyncResult States

```typescript
it('renders all AsyncResult states correctly', () => {
  // Test idle state
  const { rerender } = render(
    <DataDisplay dataState={createIdleResult()} />
  );
  expect(screen.getByText('No data loaded')).toBeInTheDocument();
  
  // Test loading state
  rerender(<DataDisplay dataState={createLoadingResult()} />);
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  
  // Test error state
  rerender(<DataDisplay dataState={createErrorResult(new Error('Test error'))} />);
  expect(screen.getByText('Test error')).toBeInTheDocument();
  
  // Test success state
  const testData = { id: '1', name: 'Test Item' };
  rerender(<DataDisplay dataState={createSuccessResult(testData)} />);
  expect(screen.getByText('Test Item')).toBeInTheDocument();
});
```

### Testing Async Components

```typescript
it('fetches data on mount and displays it', async () => {
  // Mock API response
  jest.spyOn(api, 'fetchData').mockResolvedValue({ id: '1', name: 'Test Item' });
  
  render(<DataContainer id="1" />);
  
  // Should show loading state initially
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  
  // Wait for data to load
  await waitFor(() => {
    expect(screen.getByText('Test Item')).toBeInTheDocument();
  });
  
  // Verify API was called
  expect(api.fetchData).toHaveBeenCalledWith('1');
});

it('handles API errors', async () => {
  // Mock API error
  jest.spyOn(api, 'fetchData').mockRejectedValue(new Error('API Error'));
  
  render(<DataContainer id="1" />);
  
  // Wait for error to display
  await waitFor(() => {
    expect(screen.getByText('API Error')).toBeInTheDocument();
  });
});
```

---

## Performance Optimization

### Memoization with useMemo

Use `useMemo` for expensive computations:

```typescript
function DataTable({ items }: { items: Item[] }): React.ReactElement {
  // Memoize sorted and filtered items
  const processedItems = useMemo(() => {
    return items
      .filter(item => item.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(item => ({
        ...item,
        formattedDate: formatDate(item.createdAt)
      }));
  }, [items]); // Only recalculate when items change
  
  return (
    <table>
      <thead>
        {/* Table headers */}
      </thead>
      <tbody>
        {processedItems.map(item => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td>{item.formattedDate}</td>
            {/* Other cells */}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Memoizing Components with React.memo

Use `React.memo` for pure components that receive the same props frequently:

```typescript
interface ItemCardProps {
  item: Item;
  onSelect: (id: string) => void;
}

const ItemCard = React.memo(function ItemCard({ 
  item, 
  onSelect 
}: ItemCardProps): React.ReactElement {
  return (
    <div onClick={() => onSelect(item.id)}>
      <h3>{item.name}</h3>
      <p>{item.description}</p>
    </div>
  );
});
```

### Optimizing Lists with Virtualization

Use virtualization for long lists:

```typescript
import { List } from 'react-virtualized';

function VirtualizedList({ items }: { items: Item[] }): React.ReactElement {
  const rowRenderer = ({ index, key, style }: {
    index: number;
    key: string;
    style: React.CSSProperties;
  }) => {
    const item = items[index];
    return (
      <div key={key} style={style}>
        <ItemCard item={item} />
      </div>
    );
  };
  
  return (
    <List
      width={800}
      height={600}
      rowCount={items.length}
      rowHeight={120}
      rowRenderer={rowRenderer}
    />
  );
}
```

### Preventing Unnecessary Re-renders

Carefully design component hierarchies to prevent unnecessary re-renders:

```typescript
function ParentComponent(): React.ReactElement {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  
  // This callback never changes (no dependencies)
  const handleItemSelect = useCallback((id: string) => {
    console.log('Item selected:', id);
  }, []);
  
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
      
      {/* ItemList won't re-render when count changes */}
      <ItemList 
        items={items} 
        onItemSelect={handleItemSelect}
      />
    </div>
  );
}

// Memoized child component
const ItemList = React.memo(function ItemList({ 
  items, 
  onItemSelect 
}: {
  items: Item[];
  onItemSelect: (id: string) => void;
}): React.ReactElement {
  console.log('ItemList rendering');
  
  return (
    <div>
      {items.map(item => (
        <ItemCard 
          key={item.id} 
          item={item} 
          onSelect={onItemSelect}
        />
      ))}
    </div>
  );
});
```

---

## Best Practices

### 1. Use Explicit Types

Always use explicit types rather than relying on inference:

```typescript
// Good
const [selected, setSelected] = useState<string | null>(null);

// Avoid
const [selected, setSelected] = useState(null);
```

### 2. Document Components with JSDoc

Add JSDoc comments to components and props:

```typescript
/**
 * Displays a paginated list of manga with search and filtering
 * 
 * @example
 * <MangaList 
 *   initialQuery="dragon"
 *   pageSize={20}
 *   onSelect={handleSelect}
 * />
 */
export function MangaList({ 
  initialQuery = '',
  pageSize = 10,
  onSelect
}: MangaListProps): React.ReactElement {
  // Implementation
}
```

### 3. Handle All Possible States

Always handle all possible states in your components:

```typescript
// Good: Handles all AsyncResult states
return handleAsyncResult(dataState, {
  idle: () => <IdleState />,
  loading: () => <LoadingState />,
  error: (error) => <ErrorState error={error} />,
  success: (data) => <SuccessState data={data} />
});

// Bad: Missing state handling
if (isLoading) {
  return <LoadingState />;
}
if (data) {
  return <SuccessState data={data} />;
}
// What about error state?
```

### 4. Use Dedicated Error Components

Create dedicated error components for consistent error display:

```typescript
interface ErrorDisplayProps {
  error: Error;
  title?: string;
  retry?: () => void;
}

function ErrorDisplay({ 
  error, 
  title = 'An error occurred', 
  retry 
}: ErrorDisplayProps): React.ReactElement {
  return (
    <div className="error-container">
      <h3>{title}</h3>
      <p>{error.message}</p>
      {retry && (
        <Button onClick={retry}>Retry</Button>
      )}
    </div>
  );
}
```

### 5. Keep Components Focused

Each component should have a single responsibility:

```typescript
// Good: Focused components
function UserProfile({ userId }: { userId: string }): React.ReactElement {
  const { user } = useUser(userId);
  return <UserProfileView user={user} />;
}

function UserProfileView({ user }: { user: User }): React.ReactElement {
  return (
    <div>
      <UserHeader user={user} />
      <UserDetails user={user} />
      <UserActivity user={user} />
    </div>
  );
}

// Bad: Monolithic component
function UserProfile({ userId }: { userId: string }): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Fetch user
  useEffect(() => {
    setLoading(true);
    fetchUser(userId)
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [userId]);
  
  // All rendering logic in one component
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>No user found</div>;
  
  return (
    <div>
      {/* User header */}
      <div className="user-header">
        <img src={user.avatar} alt={user.name} />
        <h2>{user.name}</h2>
        <p>{user.email}</p>
      </div>
      
      {/* User details */}
      <div className="user-details">
        {/* Many more details... */}
      </div>
      
      {/* User activity */}
      <div className="user-activity">
        {/* Activity data... */}
      </div>
    </div>
  );
}
```

### 6. Use Custom Hooks for Reusable Logic

Extract reusable logic into custom hooks:

```typescript
// Custom hook for fetching manga
function useMangaSearch(initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [searchState, setSearchState] = useState<AsyncResult<MangaSearchResult[], Error>>(
    createIdleResult()
  );
  
  const search = useCallback(async () => {
    if (query.length < 3) {
      return createErrorResult(new Error('Query must be at least 3 characters'));
    }
    
    setSearchState(createLoadingResult());
    
    try {
      const results = await api.searchManga(query);
      setSearchState(createSuccessResult(results));
      return createSuccessResult(results);
    } catch (error) {
      const typedError = error instanceof Error 
        ? error 
        : new Error(`Search failed: ${String(error)}`);
      
      setSearchState(createErrorResult(typedError));
      return createErrorResult(typedError);
    }
  }, [query]);
  
  return {
    query,
    setQuery,
    searchState,
    search,
    isSearching: isLoading(searchState),
    results: isSuccess(searchState) ? searchState.data : [],
    error: isError(searchState) ? searchState.error : null
  };
}

// Usage in component
function SearchComponent() {
  const { 
    query, 
    setQuery, 
    searchState, 
    search, 
    isSearching 
  } = useMangaSearch();
  
  return (
    <div>
      <input 
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search manga..."
      />
      <button onClick={search} disabled={isSearching}>
        Search
      </button>
      
      {handleAsyncResult(searchState, {
        idle: () => <p>Enter a search query</p>,
        loading: () => <LoadingSpinner />,
        error: (error) => <ErrorDisplay error={error} />,
        success: (results) => <ResultsList results={results} />
      })}
    </div>
  );
}
```

---

## Example Implementations

### Basic Component with Props

```typescript
/**
 * Props for the MangaCard component
 */
interface MangaCardProps {
  /** Manga data to display */
  manga: MangaEntity;
  /** Callback when manga is selected */
  onSelect?: (manga: MangaEntity) => void;
  /** Whether to show extended details */
  showDetails?: boolean;
}

/**
 * MangaCard displays a manga with its cover and basic information
 */
export function MangaCard({
  manga,
  onSelect,
  showDetails = false
}: MangaCardProps): React.ReactElement {
  const handleClick = useCallback(() => {
    if (onSelect) {
      onSelect(manga);
    }
  }, [manga, onSelect]);
  
  return (
    <Card 
      onClick={handleClick}
      className="manga-card"
      data-testid="manga-card"
    >
      <div className="manga-card__cover">
        <img 
          src={manga.coverUrl || '/default-cover.jpg'} 
          alt={`${manga.title} cover`} 
        />
      </div>
      
      <div className="manga-card__content">
        <h3 className="manga-card__title">{manga.title}</h3>
        
        {showDetails && (
          <div className="manga-card__details">
            <p>{manga.description || 'No description available'}</p>
            
            {manga.genres && manga.genres.length > 0 && (
              <div className="manga-card__genres">
                {manga.genres.map(genre => (
                  <Badge key={genre}>{genre}</Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
```

### Container/Presenter Component

```typescript
/**
 * Container component for manga search functionality
 */
export function MangaSearch({
  onSelect,
  initialQuery = ''
}: {
  onSelect?: (manga: MangaSearchResult) => void;
  initialQuery?: string;
}): React.ReactElement {
  // State management with AsyncResult
  const [searchState, setSearchState] = useState<AsyncResult<MangaSearchResult[], Error>>(
    createIdleResult()
  );
  const [query, setQuery] = useState(initialQuery);
  
  // Get providers
  const { providers, activeProviderId, setActiveProviderId } = useMetadataProviders();
  
  // Search function
  const search = useCallback(async () => {
    if (query.length < 3) {
      setSearchState(createErrorResult(
        new Error('Search query must be at least 3 characters')
      ));
      return;
    }
    
    setSearchState(createLoadingResult());
    
    try {
      let results;
      
      if (activeProviderId) {
        // Search with specific provider
        const provider = providers.find(p => p.id === activeProviderId);
        if (!provider) {
          throw new Error(`Provider ${activeProviderId} not found`);
        }
        
        results = await provider.searchManga(query);
      } else {
        // Search across all providers
        results = await searchAllProviders(query, providers);
      }
      
      setSearchState(createSuccessResult(results));
    } catch (error) {
      setSearchState(createErrorResult(
        error instanceof Error ? error : new Error(`Search failed: ${String(error)}`)
      ));
    }
  }, [query, activeProviderId, providers]);
  
  // Handle query change
  const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.currentTarget.value);
  }, []);
  
  // Handle provider change
  const handleProviderChange = useCallback((value: string | null) => {
    setActiveProviderId(value || '');
  }, [setActiveProviderId]);
  
  // Handle search submit
  const handleSearchSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    search();
  }, [search]);
  
  // Pass state and handlers to presenter
  return (
    <MangaSearchPresenter
      query={query}
      onQueryChange={handleQueryChange}
      onSearchSubmit={handleSearchSubmit}
      searchState={searchState}
      providers={providers}
      activeProviderId={activeProviderId}
      onProviderChange={handleProviderChange}
      onSelect={onSelect}
    />
  );
}

/**
 * Props for the MangaSearchPresenter component
 */
interface MangaSearchPresenterProps {
  query: string;
  onQueryChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  searchState: AsyncResult<MangaSearchResult[], Error>;
  providers: MetadataProvider[];
  activeProviderId: string;
  onProviderChange: (value: string | null) => void;
  onSelect?: (manga: MangaSearchResult) => void;
}

/**
 * Presenter component for manga search UI
 */
function MangaSearchPresenter({
  query,
  onQueryChange,
  onSearchSubmit,
  searchState,
  providers,
  activeProviderId,
  onProviderChange,
  onSelect
}: MangaSearchPresenterProps): React.ReactElement {
  return (
    <div className="manga-search">
      <form onSubmit={onSearchSubmit} className="manga-search__form">
        <TextInput
          placeholder="Search manga..."
          value={query}
          onChange={onQueryChange}
          className="manga-search__input"
        />
        
        <Select
          placeholder="Select provider"
          value={activeProviderId}
          onChange={onProviderChange}
          data={[
            { value: '', label: 'All providers' },
            ...providers.map(provider => ({
              value: provider.id,
              label: provider.name
            }))
          ]}
          className="manga-search__provider-select"
        />
        
        <Button type="submit">Search</Button>
      </form>
      
      <div className="manga-search__results">
        {handleAsyncResult(searchState, {
          idle: () => (
            <Text color="dimmed">Enter a search query and click Search</Text>
          ),
          loading: () => (
            <LoadingSpinner />
          ),
          error: (error) => (
            <Alert color="red" title="Search Error">
              {error.message}
            </Alert>
          ),
          success: (results) => (
            results.length > 0 ? (
              <MangaSearchResults results={results} onSelect={onSelect} />
            ) : (
              <Text>No results found</Text>
            )
          )
        })}
      </div>
    </div>
  );
}
```

### Component with Advanced AsyncResult Handling

```typescript
/**
 * Manga detail view with full AsyncResult integration
 */
export function MangaDetailView({ mangaId }: { mangaId: string }): React.ReactElement {
  // Get manga data
  const { 
    mangaState, 
    fetchManga, 
    chaptersState, 
    fetchChapters 
  } = useManga(mangaId);
  
  // Combined state for rendering UI
  const combinedState = useMemo(() => {
    // If manga is loading or error, prioritize that state
    if (isLoading(mangaState) || isError(mangaState)) {
      return mangaState;
    }
    
    // If manga loaded successfully but chapters are loading or error, show chapters state
    if (isSuccess(mangaState)) {
      if (isIdle(chaptersState)) {
        // If chapters haven't started loading, return manga success
        return mangaState;
      }
      
      // Otherwise, return chapters state (loading, error, or success)
      return chaptersState;
    }
    
    // Default case: manga is idle
    return mangaState;
  }, [mangaState, chaptersState]);
  
  // Load data on mount
  useEffect(() => {
    if (mangaId) {
      fetchManga(mangaId);
      fetchChapters(mangaId);
    }
  }, [mangaId, fetchManga, fetchChapters]);
  
  // Render based on combined state
  return (
    <div className="manga-detail">
      {handleAsyncResult(combinedState, {
        idle: () => (
          <Button onClick={() => fetchManga(mangaId)}>
            Load Manga Details
          </Button>
        ),
        loading: () => (
          <Card className="manga-detail__loading">
            <Skeleton height={200} radius="md" mb="xl" />
            <Skeleton height={30} width="70%" mb="md" />
            <Skeleton height={15} mb="sm" />
            <Skeleton height={15} mb="sm" />
            <Skeleton height={15} width="90%" />
          </Card>
        ),
        error: (error) => (
          <Alert 
            color="red" 
            title="Failed to load manga"
            className="manga-detail__error"
          >
            <p>{error.message}</p>
            <Button onClick={() => fetchManga(mangaId)} mt="md">
              Retry
            </Button>
          </Alert>
        ),
        success: (data) => {
          // If we have manga data but chapters are still loading
          if (isSuccess(mangaState) && isLoading(chaptersState)) {
            return (
              <MangaDetailContent 
                manga={mangaState.data} 
                chaptersLoading={true}
              />
            );
          }
          
          // If we have manga data and chapters data
          if (isSuccess(mangaState) && isSuccess(chaptersState)) {
            return (
              <MangaDetailContent 
                manga={mangaState.data}
                chapters={chaptersState.data}
              />
            );
          }
          
          // If we have manga data but chapters failed to load
          if (isSuccess(mangaState) && isError(chaptersState)) {
            return (
              <MangaDetailContent 
                manga={mangaState.data}
                chaptersError={chaptersState.error}
                onRetryChapters={() => fetchChapters(mangaId)}
              />
            );
          }
          
          // Fallback case (should never happen due to combinedState logic)
          return <div>Something went wrong</div>;
        }
      })}
    </div>
  );
}

/**
 * Content component for manga details
 */
interface MangaDetailContentProps {
  manga: MangaEntity;
  chapters?: ChapterEntity[];
  chaptersLoading?: boolean;
  chaptersError?: Error;
  onRetryChapters?: () => void;
}

function MangaDetailContent({
  manga,
  chapters,
  chaptersLoading,
  chaptersError,
  onRetryChapters
}: MangaDetailContentProps): React.ReactElement {
  return (
    <div className="manga-detail__content">
      <div className="manga-detail__header">
        <img 
          src={manga.coverUrl || '/default-cover.jpg'} 
          alt={`${manga.title} cover`}
          className="manga-detail__cover"
        />
        
        <div className="manga-detail__info">
          <h1 className="manga-detail__title">{manga.title}</h1>
          
          {manga.author && (
            <p className="manga-detail__author">
              By {manga.author}
            </p>
          )}
          
          {manga.genres && manga.genres.length > 0 && (
            <div className="manga-detail__genres">
              {manga.genres.map(genre => (
                <Badge key={genre}>{genre}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="manga-detail__description">
        {manga.description || 'No description available.'}
      </div>
      
      <div className="manga-detail__chapters">
        <h2>Chapters</h2>
        
        {chaptersLoading && (
          <LoadingSpinner size="sm" />
        )}
        
        {chaptersError && (
          <Alert color="red" title="Failed to load chapters">
            <p>{chaptersError.message}</p>
            {onRetryChapters && (
              <Button onClick={onRetryChapters} size="sm" mt="xs">
                Retry
              </Button>
            )}
          </Alert>
        )}
        
        {chapters && chapters.length > 0 ? (
          <div className="manga-detail__chapter-list">
            {chapters.map(chapter => (
              <ChapterItem key={chapter.id} chapter={chapter} />
            ))}
          </div>
        ) : (
          !chaptersLoading && !chaptersError && (
            <Text color="dimmed">No chapters available.</Text>
          )
        )}
      </div>
    </div>
  );
}
```

## Conclusion

Following these guidelines will help create consistent, maintainable, and type-safe React components in the Mugiwara-Kaizoku project. Key takeaways:

1. **Use Container/Presenter Pattern** for complex components
2. **Apply AsyncResult Pattern** for all async operations
3. **Ensure Type Safety** with explicit interfaces and type guards
4. **Handle All States** consistently (idle, loading, error, success)
5. **Create Focused Components** with single responsibilities
6. **Extract Reusable Logic** into custom hooks
7. **Optimize Performance** with memoization and other techniques

When in doubt, refer to this guide and the existing component examples in the codebase.