/**
 * useTRPCQuery Hook
 * 
 * Wrapper for TRPC queries to ensure consistent naming conventions.
 * Maps isPending to isLoading per our state management standard.
 * 
 * @see /docs/development/STATE_MANAGEMENT_STANDARD.md
 */

// Define the shape of a tRPC query result based on actual usage
interface TRPCQueryResult<TData, TError = unknown> {
  data: TData | undefined;
  isPending?: boolean;
  isLoading: boolean;
  error: TError | null;
  refetch: () => void;
  isRefetching: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export interface StandardQueryResult<TData, TError = unknown> {
  data: TData | undefined;
  isLoading: boolean;
  error: TError | null;
  refetch: () => void;
  isRefetching: boolean;
  isSuccess: boolean;
  isError: boolean;
}

/**
 * Standardize TRPC query results to match our naming conventions
 */
export function useTRPCQuery<TData, TError = unknown>(
query: TRPCQueryResult<TData, TError>)
: StandardQueryResult<TData, TError> {
  return {
    data: query.data,
    isLoading: Boolean(query.isPending ?? query.isLoading), // Map both to isLoading
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    isSuccess: query.isSuccess,
    isError: query.isError
  };
}

/**
 * Wrapper for TRPC mutations with standard naming
 */
export function useTRPCMutation<TData, TError = unknown, TVariables = unknown>(
mutation: {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isPending?: boolean;
  isLoading?: boolean;
  error: TError | null;
  data: TData | undefined;
  reset: () => void;
})
: {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isLoading: boolean;
  error: TError | null;
  data: TData | undefined;
  reset: () => void;
} {
  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isLoading: Boolean(mutation.isPending ?? mutation.isLoading), // Map both
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset
  };
}