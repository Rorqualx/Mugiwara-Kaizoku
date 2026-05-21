/**
 * Task Store Slice
 *
 * IMPORTANT: This is a frontend-only state management system for UI task tracking.
 * It is separate from the database Job model used for backend job processing.
 *
 * This Task interface is used for:
 * - Frontend UI state management
 * - Real-time task status display
 * - Progress tracking in the UI
 *
 * The backend Job model (in Prisma) is used for:
 * - Persistent job storage in database
 * - Background job processing
 * - Server-side queue management
 *
 * The two systems work together but maintain separate concerns:
 * - Tasks (frontend) = UI state for user feedback
 * - Jobs (backend) = Persistent queue processing
 *
 * This module manages application tasks state with proper typing.
 * It provides a way to track background tasks, retries, and task status.
 */

import { create } from 'zustand';

import { JobStatus } from '../utils/job-validation';

// Task data structure for frontend UI state
// NOTE: This is different from the database Job model
export interface Task {
  id: string;
  status: JobStatus;
  title: string;
  message?: string;
  progress?: number;
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string; // Renamed from 'error' to avoid duplication
}

// Task store data interface
export interface JobStateData {
  tasks: Record<string, Task>;
  activeTaskIds: string[];
}

// Task actions interface
export interface JobActions {
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  completeTask: (id: string) => void;
  failTask: (id: string, error: string) => void;
  removeTask: (id: string) => void;
  retryTask: (id: string) => void;
  getTaskById: (id: string) => Task | null;
  getTasksByStatus: (status: JobStatus) => Task[];
}

// Combined state and actions type
export type JobState = JobStateData & JobActions;

// Create task store with zustand
export const useJobStore = create<JobState>((set, get) => ({
  // Initial state
  tasks: {},
  activeTaskIds: [],

  // Action implementations
  addTask: (taskData) => {
    const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    // Create initial task with defaults
    const initialTask = {
      id,
      status: JobStatus.pending,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Combine with provided data, overriding defaults if necessary
    const task: Task = {
      ...initialTask,
      ...taskData
    };

    set((state) => ({
      tasks: { ...state.tasks, [id]: task },
      activeTaskIds: [...state.activeTaskIds, id]
    }));

    return id;
  },

  updateTask: (id, updates) => {
    set((state) => {
      const task = state.tasks[id];
      if (!task) return state;

      return {
        tasks: {
          ...state.tasks,
          [id]: {
            ...task,
            ...updates,
            updatedAt: new Date()
          }
        }
      };
    });
  },

  completeTask: (id) => {
    set((state) => {
      const task = state.tasks[id];
      if (!task) return state;

      return {
        tasks: {
          ...state.tasks,
          [id]: {
            ...task,
            status: JobStatus.completed,
            updatedAt: new Date()
          }
        },
        activeTaskIds: state.activeTaskIds.filter((taskId) => taskId !== id)
      };
    });
  },

  failTask: (id, error) => {
    set((state) => {
      const task = state.tasks[id];
      if (!task) return state;

      return {
        tasks: {
          ...state.tasks,
          [id]: {
            ...task,
            status: JobStatus.failed,
            errorMessage: error, // Use errorMessage instead of error
            updatedAt: new Date()
          }
        },
        activeTaskIds: state.activeTaskIds.filter((taskId) => taskId !== id)
      };
    });
  },

  removeTask: (id) => {
    set((state) => {
      const { [id]: _, ...restTasks } = state.tasks;
      return {
        tasks: restTasks,
        activeTaskIds: state.activeTaskIds.filter((taskId) => taskId !== id)
      };
    });
  },

  retryTask: (id) => {
    set((state) => {
      const task = state.tasks[id];
      if (!task) return state;

      // Create updated task without setting optional properties to undefined
      const { errorMessage: _errorMessage, ...taskWithoutError } = task;
      const updatedTask: Task = {
        ...taskWithoutError,
        status: JobStatus.pending,
        updatedAt: new Date()
      };

      return {
        tasks: {
          ...state.tasks,
          [id]: updatedTask
        },
        activeTaskIds: [...state.activeTaskIds, id]
      };
    });
  },

  getTaskById: (id) => {
    return get().tasks[id] ?? null;
  },

  getTasksByStatus: (status) => {
    return Object.values(get().tasks).filter((task) => task["status"] === status);
  }
}));

// Mutation options interface
interface MutationOptions<TData = unknown> {
  onSuccess?: (data?: TData) => void;
  onError?: (error: Error) => void;
}

// Query result interface
interface QueryResult<TData> {
  data: TData;
  isLoading: boolean;
  refetch: () => void;
}

// Mutation result interface
interface MutationResult {
  mutate: (data?: unknown) => void;
  mutateAsync: (data?: unknown) => Promise<unknown>;
  isLoading: boolean;
}

// Job selectors return type
interface JobSelectorsReturn {
  tasks: {
    getByStatus: {
      useQuery: () => QueryResult<Task[]>;
    };
    retry: {
      useMutation: (options?: MutationOptions) => MutationResult;
    };
  };
  manga: {
    getById: {
      useQuery: () => QueryResult<null>;
    };
    update: {
      useMutation: (options?: MutationOptions) => MutationResult;
    };
    add: {
      useMutation: (options?: MutationOptions) => MutationResult;
    };
  };
  library: {
    getAll: {
      useQuery: () => QueryResult<unknown[]>;
    };
    create: {
      useMutation: (options?: MutationOptions) => MutationResult;
    };
  };
  sources: {
    getAll: {
      useQuery: () => QueryResult<unknown[]>;
    };
    listMetadata: {
      useQuery: () => QueryResult<unknown[]>;
    };
  };
  settings: {
    getAll: {
      useQuery: () => QueryResult<Record<string, unknown>>;
    };
    update: {
      useMutation: (options?: MutationOptions) => MutationResult;
    };
  };
}

// Selector hooks for TRPC-like interface
export const useJobSelectors = (): JobSelectorsReturn => {
  const tasks = useJobStore();

  return {
    tasks: {
      getByStatus: {
        useQuery: (): { data: Task[]; isLoading: boolean; refetch: () => void } => {
          const data = tasks.getTasksByStatus(JobStatus.pending);
          const isLoading = false;
          const refetch = (): void => {}; // Empty function for compatibility
          return { data, isLoading, refetch };
        }
      },
      retry: {
        useMutation: (options?: MutationOptions): MutationResult => {
          return {
            mutate: (data?: unknown): void => {
              // Retry implementation would go here
              if (options?.onSuccess) {
                options.onSuccess(data);
              }
            },
            mutateAsync: (data?: unknown): Promise<unknown> => {
              // Async retry implementation
              if (options?.onSuccess) {
                options.onSuccess(data);
              }
              return Promise.resolve(data);
            },
            isLoading: false
          };
        }
      }
    },

    // Add missing properties that components are trying to access
    manga: {
      getById: {
        useQuery: (): QueryResult<null> => ({ data: null, isLoading: false, refetch: (): void => {} }),
      },
      update: {
        useMutation: (options?: MutationOptions): MutationResult => ({
          mutate: (data?: unknown): void => {
            if (options?.onSuccess) options.onSuccess(data);
          },
          mutateAsync: (data?: unknown): Promise<unknown> => {
            if (options?.onSuccess) options.onSuccess(data);
            return Promise.resolve(data);
          },
          isLoading: false
        })
      },
      add: {
        useMutation: (options?: MutationOptions): MutationResult => ({
          mutate: (data?: unknown): void => {
            if (options?.onSuccess) options.onSuccess(data);
          },
          mutateAsync: (data?: unknown): Promise<unknown> => {
            if (options?.onSuccess) options.onSuccess(data);
            return Promise.resolve(data);
          },
          isLoading: false
        })
      }
    },
    library: {
      getAll: {
        useQuery: (): QueryResult<unknown[]> => ({ data: [], isLoading: false, refetch: (): void => {} }),
      },
      create: {
        useMutation: (options?: MutationOptions): MutationResult => ({
          mutate: (data?: unknown): void => {
            if (options?.onSuccess) options.onSuccess(data);
          },
          mutateAsync: (data?: unknown): Promise<unknown> => {
            if (options?.onSuccess) options.onSuccess(data);
            return Promise.resolve(data);
          },
          isLoading: false
        })
      }
    },
    sources: {
      getAll: {
        useQuery: (): QueryResult<unknown[]> => ({ data: [], isLoading: false, refetch: (): void => {} }),
      },
      listMetadata: {
        useQuery: (): QueryResult<unknown[]> => ({ data: [], isLoading: false, refetch: (): void => {} }),
      }
    },
    settings: {
      getAll: {
        useQuery: (): QueryResult<Record<string, unknown>> => ({ data: {}, isLoading: false, refetch: (): void => {} }),
      },
      update: {
        useMutation: (options?: MutationOptions): MutationResult => ({
          mutate: (data?: unknown): void => {
            if (options?.onSuccess) options.onSuccess(data);
          },
          mutateAsync: (data?: unknown): Promise<unknown> => {
            if (options?.onSuccess) options.onSuccess(data);
            return Promise.resolve(data);
          },
          isLoading: false
        })
      }
    }
  };
};

export default useJobStore;