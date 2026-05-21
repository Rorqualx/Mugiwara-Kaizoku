# Hooks

This directory contains React hooks used throughout the Mugiwara-Kaizoku manga management application. These hooks encapsulate reusable logic for state management, data fetching, and business operations.

## Purpose

Custom hooks provide:

1. Reusable stateful logic that can be shared across components
2. Abstraction over complex operations like API calls and state transitions
3. Consistent patterns for data fetching, error handling, and state updates
4. Decoupling of business logic from UI components

## Key Files

### Core Data Hooks
- `useManga.ts` - Manages manga data and operations (update, refresh, etc.)
- `useMetadata.ts` - Handles metadata operations and state
- `useMetadataProviders.ts` - Manages metadata provider configuration and operations
- `useLibrary.ts` - Provides library management functionality
- `useSearch.ts` - Handles search operations across providers

### Configuration Hooks
- `useConfig.ts` - General application configuration
- `useMangadexConfig.ts` - MangaDex-specific configuration
- `useAnilistConfig.ts` - AniList-specific configuration
- `useComicvineConfig.ts` - ComicVine-specific configuration
- `useFandomConfig.ts` - Fandom-specific configuration
- `useDownloadClientConfig.ts` - Download client configuration

### UI and State Management Hooks
- `useLoadingManager.ts` - Manages loading states with named operations
- `useLoadingState.ts` - Simpler loading state management
- `useNotification.ts` - Shows and manages notifications
- `useErrorBoundary.tsx` - Error boundary hook for component error handling
- `useTheme.ts` - Manages application theme

### Integration Hooks
- `useDownload.ts` - Manages download operations
- `useDownloadQueue.ts` - Manages the download queue
- `useSuwayomiConfig.ts` - Suwayomi integration configuration
- `useEvents.ts` - Event system integration

## Usage Pattern

Most hooks follow a consistent pattern:

1. Define a return interface for type safety
2. Use internal state with React's `useState` and `useEffect`
3. Implement methods that handle operations
4. Return a consistent interface with state and methods

Example usage:

```typescript
import { useManga } from '../hooks/useManga';

function MangaEditor({ mangaId }) {
  const { handleUpdateManga, updateState, isLoading } = useManga();
  
  const onSave = async (data) => {
    const result = await handleUpdateManga(mangaId, data);
    if (isSuccess(result)) {
      // Handle success
    }
  };
  
  return (
    <form onSubmit={onSave}>
      {/* Form content */}
      <button type="submit" disabled={isLoading}>Save</button>
    </form>
  );
}
```

## AsyncResult Pattern

Many hooks use the AsyncResult pattern for consistent error handling:

```typescript
// Hook implementation
const handleOperation = async (): Promise<AsyncResult<Data, Error>> => {
  try {
    // Operation logic
    return createSuccessResult(data);
  } catch (error) {
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
};

// Usage with AsyncResult
const result = await handleOperation();
if (isSuccess(result)) {
  // Handle success with result.data
} else if (isError(result)) {
  // Handle error with result.error
}
```

## Loading State Management

Hooks use consistent loading state management:

```typescript
// With useLoadingManager
const { startLoading, stopLoading, withLoading, isLoading } = useLoadingManager();

const handleOperation = async () => {
  startLoading('operation-key');
  try {
    // Operation logic
  } finally {
    stopLoading('operation-key');
  }
};

// Or with useLoadingState
const [isLoading, setLoading] = useLoadingState();

const handleOperation = async () => {
  setLoading(true);
  try {
    // Operation logic
  } finally {
    setLoading(false);
  }
};
```

## Error Handling

Hooks implement comprehensive error handling:

```typescript
try {
  // Operation logic
} catch (error) {
  showError({
    title: 'Operation Failed',
    message: error instanceof Error ? error.message : String(error)
  });
  return createErrorResult(error instanceof Error ? error : new Error(String(error)));
}
```

## Testing

Hooks can be tested using React Testing Library's `renderHook`:

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useManga } from '../useManga';

describe('useManga', () => {
  it('should update manga successfully', async () => {
    const { result } = renderHook(() => useManga());
    
    await act(async () => {
      await result.current.handleUpdateManga(1, { title: 'New Title' });
    });
    
    expect(result.current.updateState.status).toBe('success');
  });
});
```

Test hooks using:
```bash
npm run test -- --testPathPattern=hooks
```