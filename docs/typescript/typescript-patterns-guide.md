# Typescript Patterns Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Typescript Patterns Guide

---
# TypeScript Patterns Guide

This document outlines the common TypeScript patterns that should be consistently applied across the Mugiwara-Kaizoku codebase to ensure type safety and maintainability.

## 1. AsyncResult Pattern

The AsyncResult pattern is the foundation for handling asynchronous operations with proper type safety:

```typescript
// Import the AsyncResult utilities
import { 
  AsyncResult, 
  createSuccessResult, 
  createErrorResult,
  createLoadingResult,
  createIdleResult,
  isSuccess,
  isError,
  isLoading,
  isIdle
} from '../utils/async-result';

// Function returning AsyncResult
async function fetchData(): Promise<AsyncResult<DataType, Error>> {
  try {
    const data = await api.get('/endpoint');
    return createSuccessResult<DataType, Error>(data);
  } catch (error) {
    return createErrorResult<DataType, Error>(
      error instanceof Error 
        ? error 
        : new Error(`Failed to fetch data: ${String(error)}`)
    );
  }
}

// Using AsyncResult with proper state checking
function Component() {
  const [state, setState] = useState<AsyncResult<DataType, Error>>(createIdleResult());
  
  // Always check all possible states
  if (isLoading(state)) {
    return <Loading />;
  }
  
  if (isError(state)) {
    return <ErrorMessage message={state.error.message} />;
  }
  
  if (isIdle(state)) {
    return <EmptyState />;
  }
  
  // isSuccess is guaranteed here
  return <DataDisplay data={state.data} />;
}
```

## 2. Array Validation Pattern

Always validate arrays before operations to prevent runtime errors:

```typescript
// Import type guards
import { isArray, isObject } from '../utils/validation/type-guards';

// Array validation before operations
function processItems(items: unknown): ProcessedItem[] {
  // Check if it's an array first
  if (!isArray(items)) {
    return [];
  }
  
  // Filter valid items using a type guard
  const validItems = items.filter((item): item is ValidItem => {
    return isObject(item) && 'id' in item && typeof item.id === 'string';
  });
  
  // Now safely map the valid items
  return validItems.map(item => ({
    id: item.id,
    name: typeof item.name === 'string' ? item.name : 'Unknown',
    count: typeof item.count === 'number' ? item.count : 0
  }));
}

// Safe array access with the getSafeArray utility
import { getSafeArray } from '../utils/converters/EntityConverter';

function getItems(data: unknown): Item[] {
  // Using the getSafeArray utility with proper typing
  return getSafeArray<Item>(
    data, 
    'items', 
    // Mapping function for type conversion
    (item) => convertToItem(item),
    // Or validator function for filtering
    (item): item is Item => isValidItem(item)
  );
}
```

## 3. Type Guard Pattern

Create comprehensive type guards for complex objects:

```typescript
// Type guard for checking if a value is a valid ID
export function isValidId(value: unknown): value is ID {
  return typeof value === 'string' || (typeof value === 'number' && !isNaN(value));
}

// Type guard for checking if an object has an ID property
export function hasId(obj: unknown): obj is { id: ID } {
  if (!isObject(obj)) {
    return false;
  }
  
  return isValidId((obj as Record<string, unknown>).id);
}

// Comprehensive type guard for a complex object
export function isValidMangaMetadata(value: unknown): value is MangaMetadata {
  if (!isObject(value)) {
    return false;
  }
  
  const obj = value as Record<string, unknown>;
  
  // Check required fields
  if (typeof obj.title !== 'string') {
    return false;
  }
  
  // Check optional fields with type validation
  if (obj.description !== undefined && typeof obj.description !== 'string') {
    return false;
  }
  
  if (obj.coverUrl !== undefined && typeof obj.coverUrl !== 'string') {
    return false;
  }
  
  if (obj.authors !== undefined && !isArrayOf(obj.authors, isString)) {
    return false;
  }
  
  return true;
}
```

## 4. Safe Property Access Pattern

Always use safe property access methods:

```typescript
// Import safe property access utilities
import { 
  safelyExtractProperty,
  safelyExtractStringArray
} from '../utils/validation/enhanced-type-guards';

// Safe property access with type validation
function getMetadata(obj: unknown): Metadata {
  if (!isObject(obj)) {
    return { title: 'Unknown' };
  }
  
  return {
    title: safelyExtractProperty(obj, 'title', 'Unknown', isString),
    description: safelyExtractProperty(obj, 'description', '', isString),
    authors: safelyExtractStringArray(obj, 'authors'),
    tags: safelyExtractStringArray(obj, 'tags'),
    rating: safelyExtractProperty(obj, 'rating', 0, isNumber)
  };
}

// Using the AsyncResult helper utilities for safe data access
import { 
  safeGetData, 
  safeGetError, 
  getDataOr 
} from '../utils/async-result-helpers';

function displayUserData(userResult: AsyncResult<User, Error>) {
  // Safe data access with explicit default value
  const username = getDataOr(userResult, { username: 'Guest' }).username;
  
  // Alternatively, use safeGetData with null check
  const user = safeGetData(userResult);
  if (!user) {
    return <GuestView />;
  }
  
  return <UserProfile username={user.username} />;
}
```

## 5. Error Handling Pattern

Implement consistent error handling across the codebase:

```typescript
// Enhanced error handler
import { createContextualError } from '../utils/async-result';

function processOperation() {
  try {
    // Operation that might fail
  } catch (error) {
    // Always check if error is an Error object
    const errorMessage = error instanceof Error 
      ? error.message 
      : String(error);
      
    // Create a contextual error with additional information
    const enhancedError = createContextualError(
      `Failed to process operation: ${errorMessage}`,
      'OPERATION_ERROR',
      { operationId: '123', timestamp: new Date().toISOString() },
      error instanceof Error ? error : undefined
    );
    
    // Log and return the enhanced error
    console.error(enhancedError);
    return createErrorResult(enhancedError);
  }
}

// With enhanced error handling wrapper
import { withEnhancedErrorHandling } from '../utils/async-result-helpers';

async function performOperation() {
  return withEnhancedErrorHandling(async () => {
    // Async operation with potential errors
    const response = await api.request();
    if (!response) {
      throw new Error('No response received');
    }
    return createSuccessResult(response);
  }, {
    operation: 'performOperation',
    resourceId: '123',
    context: 'API Request'
  });
}
```

## 6. React Component Props Pattern

Define explicit prop interfaces for React components:

```typescript
// Explicit prop interface with JSDoc comments
interface UserProfileProps {
  /** The user's unique identifier */
  userId: string;
  /** Display name for the user */
  displayName: string;
  /** URL to the user's avatar image */
  avatarUrl?: string;
  /** Whether the profile is in edit mode */
  isEditable?: boolean;
  /** Callback when profile is updated */
  onUpdate?: (userId: string, newData: UserData) => void;
}

// Component with typed props and defaults
function UserProfile({
  userId,
  displayName,
  avatarUrl = '/default-avatar.png',
  isEditable = false,
  onUpdate
}: UserProfileProps) {
  // Component implementation
}

// For generic components, use TypeScript generics
interface SelectProps<T> {
  /** Array of options */
  options: T[];
  /** Currently selected value */
  value?: T;
  /** Function to get the display text for an option */
  getOptionLabel: (option: T) => string;
  /** Function to get the unique identifier for an option */
  getOptionValue: (option: T) => string | number;
  /** Selection change handler */
  onChange: (newValue: T) => void;
}

function Select<T>({
  options,
  value,
  getOptionLabel,
  getOptionValue,
  onChange
}: SelectProps<T>) {
  // Component implementation
}
```

## 7. Hook Return Type Pattern

Define explicit return type interfaces for custom hooks:

```typescript
// Define return type interface for the hook
interface UseUserResult {
  /** Current user or undefined if not logged in */
  user: User | undefined;
  /** Whether user data is being loaded */
  isLoading: boolean;
  /** Error that occurred during loading, if any */
  error: Error | undefined;
  /** Function to refresh user data */
  refreshUser: () => Promise<void>;
  /** Function to update user profile */
  updateProfile: (data: Partial<UserProfile>) => Promise<AsyncResult<User, Error>>;
  /** Function to log out the current user */
  logout: () => Promise<void>;
}

// Implement the hook with the defined return type
function useUser(): UseUserResult {
  // Hook implementation
  
  return {
    user,
    isLoading,
    error,
    refreshUser,
    updateProfile,
    logout
  };
}

// With AsyncResult pattern
interface UseDataResult<T> {
  /** The data state with AsyncResult pattern */
  dataState: AsyncResult<T, Error>;
  /** Function to fetch data */
  fetchData: () => Promise<void>;
  /** Function to refresh data */
  refreshData: () => Promise<void>;
  /** Safely access data with a default value */
  getData: <D>(defaultValue: D) => T | D;
}

function useData<T>(url: string): UseDataResult<T> {
  // Hook implementation
  
  return {
    dataState,
    fetchData,
    refreshData,
    getData: <D>(defaultValue: D) => getDataOr(dataState, defaultValue)
  };
}
```

## 8. Nullish Coalescing Pattern

Use nullish coalescing (`??`) instead of logical OR (`||`) for defaults:

```typescript
// WRONG: Uses logical OR which replaces any falsy value (0, "", false, etc.)
const count = options.count || 10;
const title = data.title || "Default Title";

// RIGHT: Uses nullish coalescing which only replaces null/undefined
const count = options.count ?? 10;
const title = data.title ?? "Default Title";

// WRONG: Direct access without checking
const username = user.profile.username || "Guest";

// RIGHT: Optional chaining with nullish coalescing
const username = user?.profile?.username ?? "Guest";
```

## 9. Discriminated Union Pattern

Use discriminated unions for handling different object types:

```typescript
// Define a discriminated union type
type SearchResult = 
  | { type: 'manga'; id: string; title: string; chapters: number }
  | { type: 'comic'; id: string; title: string; issues: number }
  | { type: 'novel'; id: string; title: string; pages: number };

// Type guard to narrow the union type
function isMangaResult(result: SearchResult): result is { type: 'manga'; id: string; title: string; chapters: number } {
  return result.type === 'manga';
}

// Function that safely handles the union type
function getItemCount(result: SearchResult): number {
  switch (result.type) {
    case 'manga':
      return result.chapters;
    case 'comic':
      return result.issues;
    case 'novel':
      return result.pages;
    default:
      // Exhaustiveness check
      const _exhaustiveCheck: never = result;
      return 0;
  }
}
```

## 10. Type Assertion Pattern

Use type assertions carefully and with validation:

```typescript
// WRONG: Unsafe type assertion
const userData = apiResponse as UserData;

// RIGHT: Validate before assertion
if (isValidUserData(apiResponse)) {
  const userData = apiResponse as UserData;
  // Use userData safely
}

// BETTER: Use type guards to avoid assertions
if (isValidUserData(apiResponse)) {
  // TypeScript knows apiResponse is UserData
  const userData = apiResponse;
  // Use userData safely
}

// For necessary assertions, use the unknown intermediate step
const safeData = data as unknown as TargetType;
```

By consistently applying these patterns throughout the codebase, we can ensure type safety, reduce runtime errors, and improve the maintainability of the Mugiwara-Kaizoku project.