# Use Background Task Implementation

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Use Background Task Implementation

---
# useBackgroundTask Implementation with AsyncResult Pattern

This document describes the implementation of the enhanced `useBackgroundTask` hook using the AsyncResult pattern for better type safety and error handling.

## Overview

The `useBackgroundTask` hook has been improved to use the AsyncResult pattern, which provides a type-safe way to handle different states of asynchronous operations (idle, loading, success, error). This makes the hook more robust and easier to use, especially when dealing with different task states.

## Key Improvements

1. **AsyncResult Pattern Integration**
   - Added proper AsyncResult typing for task state management
   - Replaced boolean loading state with discriminated union types
   - Added type-safe handling of success, error, loading, and idle states
   - Added proper error propagation and handling

2. **Type Safety Enhancements**
   - Added proper typing for task query results using RouterOutput type
   - Used TaskUnion and TaskWithProgress for better type safety
   - Added type guards for task status and type checks
   - Improved task conversion with error handling

3. **Error Handling**
   - Added comprehensive error handling in task processing
   - Added error state propagation via AsyncResult pattern
   - Made error messages more descriptive and type-safe
   - Added fallback for task conversion failures

4. **API Integration**
   - Enhanced tRPC query with proper callbacks
   - Added proper typing for query parameters and results
   - Improved state management with tRPC hooks
   - Added onError, onSuccess, and onSettled handlers

5. **Functionality Improvements**
   - Made `clearCompletedTasks` return an AsyncResult for better error handling
   - Enhanced task filtering with proper type guards
   - Added null safety throughout the implementation
   - Improved data processing with try/catch blocks

## Implementation Details

### Task State Management

```typescript
// State for tasks with AsyncResult pattern to handle different states
const [tasksResult, setTasksResult] = useState<AsyncResult<TaskWithProgress[], Error>>(createIdleResult());
```

The hook now uses the AsyncResult pattern to manage the state of tasks, which allows for a more type-safe and predictable way of handling different states.

### Type-Safe Task Processing

```typescript
const processTaskData = useCallback((apiTasks: TaskQueryResult) => {
  try {
    // Convert API response tasks to TaskWithProgress type
    const tasksWithProgress: TaskWithProgress[] = apiTasks.map(apiTask => {
      try {
        // First, try to convert to the type-safe TaskUnion
        const taskUnion = toTaskUnion(apiTask);
        
        // Then, add progress tracking
        const taskWithProgress: TaskWithProgress = {
          ...taskUnion,
          // Default progress to 0
          progress: 0
        };
        
        return taskWithProgress;
      } catch (error) {
        // If conversion fails, create a basic TaskWithProgress
        console.warn('Failed to convert task', error);
        return {
          ...apiTask,
          progress: 0
        } as TaskWithProgress;
      }
    });
    
    // Update state with success result
    setTasksResult(createSuccessResult(tasksWithProgress));
  } catch (error) {
    // Handle any errors during processing
    setTasksResult(createErrorResult(error instanceof Error 
      ? error 
      : new Error('Failed to process task data')
    ));
  }
}, []);
```

The `processTaskData` function now handles task conversion in a type-safe manner, with proper error handling for both individual task conversion failures and overall processing errors.

### Enhanced API Integration

```typescript
const taskQuery = trpc.tasks.getByStatus.useQuery(
  { status: TaskStatus.IN_PROGRESS as any }, 
  { 
    refetchInterval: 5000,
    onError: (error) => {
      setTasksResult(createErrorResult(error instanceof Error 
        ? error 
        : new Error('Failed to fetch tasks')
      ));
    },
    onSuccess: (data) => {
      // Process tasks when data is received
      processTaskData(data);
    },
    onSettled: () => {
      // If we're in idle state, move to loading until we get data
      if (isIdle(tasksResult)) {
        setTasksResult(createLoadingResult());
      }
    }
  }
);
```

The tRPC query now has proper error handling, success handling, and state management through the use of callbacks.

### Type-Safe Utility Functions

```typescript
const getTaskProgress = useCallback((taskId: number): number => {
  if (isSuccess(tasksResult)) {
    const task = tasksResult.data.find(t => t.id === taskId);
    return task?.progress ?? 0;
  }
  return 0;
}, [tasksResult]);
```

Utility functions now check the state of the AsyncResult using type guards before accessing data, which makes them more robust and type-safe.

### Improved Task Filtering

```typescript
const activeTasks = isSuccess(tasksResult)
  ? tasksResult.data.filter(task => 
      task.status === TaskStatus.PENDING || 
      task.status === TaskStatus.IN_PROGRESS
    )
  : [];
```

Task filtering now takes into account the state of the AsyncResult, ensuring that we only filter tasks when we have successfully loaded them.

## Usage Example

Here's an example of how to use the enhanced hook:

```tsx
const { 
  activeTasks, 
  getTaskProgress,
  isTaskActive,
  tasksResult 
} = useBackgroundTask();

// Handle different states using the AsyncResult pattern
if (isLoading(tasksResult)) {
  return <div>Loading tasks...</div>;
}

if (isError(tasksResult)) {
  return <div>Error: {tasksResult.error.message}</div>;
}

return (
  <div>
    {activeTasks.map(task => (
      <div key={task.id}>
        {task.type}: {getTaskProgress(task.id)}%
      </div>
    ))}
  </div>
);
```

## Benefits

1. **Better Error Handling**: Errors are properly propagated and handled in a type-safe way.
2. **Improved Type Safety**: The use of discriminated unions and type guards makes the code more robust.
3. **More Predictable State Management**: The AsyncResult pattern makes state transitions more predictable and easier to handle.
4. **Enhanced Debugging**: Error messages are more descriptive and type-safe, making debugging easier.
5. **Better Null Safety**: Null checks and default values are used throughout the implementation, reducing the risk of runtime errors.

## Next Steps

1. **Component Integration**: Update components that use this hook to handle the new AsyncResult pattern.
2. **Task Progress Updates**: Implement real-time task progress updates.
3. **Task Management API**: Add more task management functionality, such as cancelling tasks.
4. **Testing**: Add unit tests for the hook to ensure it behaves as expected in different scenarios.