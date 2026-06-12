# Agent Orchestration Directive - Parallel Task Execution

*Status: Active*  
*Author: Development Team*  
*Created: 2025-10-26*  
*Based on: CLAUDE.md v2025-10-14 + Multi-Agent Best Practices*

## Executive Summary

This directive establishes **mandatory guidelines** for using AI agent orchestration to parallelize development work in Mugiwara Kaizoku. By coordinating multiple specialized agents through task dependency graphs and sequential wave execution, we can dramatically reduce completion time for complex, multi-faceted tasks.

**Core Principle**: Focus on the task's underlying structure and dependency graph, not agent count. Decompose work into independent units, execute in parallel waves, and coordinate through a central orchestrator.

---

## 📊 Understanding Agent Orchestration

### What is Agent Orchestration?

Agent orchestration is the practice of coordinating multiple specialized AI agents—each with a clear role—working in sync through a central controller. Unlike single-agent approaches that try to handle everything, orchestration divides responsibilities among purpose-built agents optimized for specific tasks.

### Core Components

```
┌─────────────────────────────────────────────────┐
│         COORDINATOR AGENT (Orchestrator)        │
│  - Task decomposition                           │
│  - Dependency graph construction                │
│  - Wave planning and execution                  │
│  - Result aggregation                           │
│  - Error handling and recovery                  │
└─────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  WORKER     │ │  WORKER     │ │  WORKER     │
│  AGENT 1    │ │  AGENT 2    │ │  AGENT 3    │
│             │ │             │ │             │
│ Specialized │ │ Specialized │ │ Specialized │
│ Task A      │ │ Task B      │ │ Task C      │
└─────────────┘ └─────────────┘ └─────────────┘
```

**Key Elements:**
- **Coordinator Agent**: Central orchestrator managing task flow
- **Worker Agents**: Specialized agents for specific tasks
- **Dependency Graph**: DAG (Directed Acyclic Graph) defining task relationships
- **Execution Waves**: Sequential phases of parallel execution
- **Shared Context**: Information passed between agents
- **Result Aggregation**: Combining outputs from parallel workers

---

## 🎯 When to Use Agent Orchestration

### ALWAYS Use for Complex Multi-Part Tasks

**Criteria:**
- Task has 3+ independent subtasks
- Expected completion time >30 minutes with single agent
- Clear domain boundaries between subtasks
- Parallelization would save >40% time

**Examples:**
```
✅ Feature Implementation:
   - Frontend component (React)
   - Backend API endpoint (tRPC)
   - Database migration (Prisma)
   - Documentation update
   - Test coverage
   └─> 5 independent tasks, 2+ hours → PARALLELIZE

✅ Code Refactoring:
   - Type system updates
   - Component refactoring
   - API endpoint updates
   - Documentation sync
   └─> 4 independent tasks, 90 min → PARALLELIZE

✅ External API Integration:
   - Adapter implementation
   - Type definitions
   - Error handling
   - Testing suite
   - Documentation
   └─> 5 independent tasks, 2+ hours → PARALLELIZE
```

### CONSIDER for Medium Complexity Tasks

**Criteria:**
- Task has 2-3 subtasks with minimal dependencies
- Expected completion time 15-30 minutes
- Some shared context between subtasks
- Moderate parallelization benefit

**Examples:**
```
🤔 Bug Fix with Testing:
   - Fix implementation
   - Test updates
   └─> 2 tasks, moderate dependency → EVALUATE

🤔 Documentation Updates:
   - Multiple doc files
   - Cross-references
   └─> Can parallelize but benefits marginal → EVALUATE
```

### NEVER Use for Simple/Linear Tasks

**Criteria:**
- Single-step tasks
- Strong sequential dependencies
- Expected completion time <15 minutes
- No clear parallelization opportunity

**Examples:**
```
❌ Simple Type Update:
   - Single file change
   └─> Too simple for orchestration overhead

❌ Sequential Migration:
   - Database schema change
   - Code updates depend on schema
   └─> Must be sequential by nature

❌ Quick Documentation Fix:
   - Typo correction
   - Single file
   └─> Coordination overhead exceeds benefit
```

---

## 🏗️ Orchestration Patterns for Mugiwara Kaizoku

### Pattern 1: Sequential Waves (Most Common)

Tasks are organized in waves where each wave can execute in parallel, but waves must complete sequentially.

**Structure:**
```
Wave 1 (Parallel):    [Task A] [Task B] [Task C]
         ↓                ↓        ↓        ↓
Wave 2 (Parallel):    [Task D] ───┴────────┘
         ↓                ↓
Wave 3 (Sequential):  [Task E]
```

**Use When:**
- Tasks have clear phase dependencies
- Each phase has multiple independent subtasks
- Results from one wave inform the next

**Example - Feature Implementation:**
```typescript
// Wave 1: Preparation (Parallel)
const wave1 = [
  { id: 'schema', task: 'Update Prisma schema', deps: [] },
  { id: 'types', task: 'Create TypeScript types', deps: [] },
  { id: 'docs_review', task: 'Review existing docs', deps: [] }
];

// Wave 2: Implementation (Parallel, depends on Wave 1)
const wave2 = [
  { id: 'backend', task: 'Implement tRPC endpoint', deps: ['schema', 'types'] },
  { id: 'frontend', task: 'Create React component', deps: ['types'] },
  { id: 'tests', task: 'Write test suite', deps: ['types'] }
];

// Wave 3: Integration (Sequential, depends on Wave 2)
const wave3 = [
  { id: 'integration', task: 'Integration testing', deps: ['backend', 'frontend', 'tests'] },
  { id: 'docs', task: 'Update documentation', deps: ['integration'] }
];
```

### Pattern 2: Pure Parallel (Rare, High Value)

All tasks execute simultaneously with no dependencies.

**Structure:**
```
[Task A] [Task B] [Task C] [Task D]
   ↓        ↓        ↓        ↓
        [Aggregation]
```

**Use When:**
- Tasks are completely independent
- Read-only operations (no shared state)
- Maximum speed is critical

**Example - Multi-Adapter Testing:**
```typescript
const parallelTasks = [
  { id: 'mangadex', task: 'Test MangaDex adapter', deps: [] },
  { id: 'fandom', task: 'Test Fandom adapter', deps: [] },
  { id: 'comicvine', task: 'Test ComicVine adapter', deps: [] },
  { id: 'anilist', task: 'Test AniList adapter', deps: [] }
];
// All execute simultaneously, results aggregated at end
```

### Pattern 3: Hierarchical Decomposition

Coordinator breaks down complex tasks into smaller, manageable subtasks and assigns them to specialized agents.

**Structure:**
```
         [Coordinator]
              │
     ┌────────┼────────┐
     ▼        ▼        ▼
 [Manager 1] [Manager 2] [Manager 3]
     │        │        │
  ┌──┼──┐  ┌─┼─┐   ┌──┼──┐
  ▼  ▼  ▼  ▼ ▼ ▼   ▼  ▼  ▼
 [Workers]  [Workers] [Workers]
```

**Use When:**
- Very large tasks (>10 subtasks)
- Natural hierarchical structure
- Sub-coordinators can manage groups

**Example - Complete Feature Rollout:**
```typescript
// Top Coordinator
const topLevel = {
  id: 'feature_rollout',
  subCoordinators: [
    { id: 'backend_coord', manages: ['api', 'database', 'services'] },
    { id: 'frontend_coord', manages: ['components', 'pages', 'state'] },
    { id: 'testing_coord', manages: ['unit', 'integration', 'e2e'] }
  ]
};
```

### Pattern 4: Dynamic Adaptation

Execution graph reshapes based on runtime discoveries.

**Structure:**
```
Initial Plan:  [A] → [B] → [C]
                    ↓
Runtime Discovery: [B] reveals parallel opportunities
                    ↓
Adapted Plan:  [A] → [B1] [B2] [B3] → [C]
```

**Use When:**
- Task complexity unknown upfront
- Discoveries during execution enable more parallelism
- Flexibility more important than predictability

**Example - Refactoring Discovery:**
```typescript
// Initial: Refactor component A
// Discovery: Component A used in 5 places
// Adaptation: Parallelize updates to all 5 locations
```

---

## 🔧 Task Dependency Graph Construction

### Building the DAG

A task dependency graph is a directed acyclic graph (DAG) that illustrates the order in which tasks must be executed, taking into account their interdependencies.

**Key Concepts:**
- **Nodes**: Individual tasks or work units
- **Edges**: Dependencies showing which tasks must complete before others
- **Critical Path**: Longest sequence determining minimum completion time
- **Parallelism**: Tasks with no path between them can run concurrently

### Step-by-Step Process

**1. Task Decomposition**
```typescript
interface Task {
  id: string;
  description: string;
  estimatedDuration: number; // minutes
  agent: AgentType;
  dependencies: string[];
  outputs: string[];
}

// Example: Feature Implementation
const tasks: Task[] = [
  {
    id: 'T1',
    description: 'Update Prisma schema',
    estimatedDuration: 15,
    agent: 'database-specialist',
    dependencies: [],
    outputs: ['schema.prisma']
  },
  {
    id: 'T2',
    description: 'Generate TypeScript types',
    estimatedDuration: 10,
    agent: 'type-specialist',
    dependencies: ['T1'],
    outputs: ['manga-types.ts']
  },
  {
    id: 'T3',
    description: 'Implement tRPC endpoint',
    estimatedDuration: 30,
    agent: 'backend-specialist',
    dependencies: ['T2'],
    outputs: ['manga.router.ts']
  },
  {
    id: 'T4',
    description: 'Create React component',
    estimatedDuration: 25,
    agent: 'frontend-specialist',
    dependencies: ['T2'],
    outputs: ['MangaList.tsx']
  },
  {
    id: 'T5',
    description: 'Write tests',
    estimatedDuration: 20,
    agent: 'testing-specialist',
    dependencies: ['T3', 'T4'],
    outputs: ['manga.test.ts']
  }
];
```

**2. Dependency Analysis**
```typescript
function analyzeDependencies(tasks: Task[]): {
  waves: Task[][];
  criticalPath: Task[];
  maxParallelism: number;
} {
  // Build adjacency list
  const graph = new Map<string, string[]>();
  tasks.forEach(task => {
    graph.set(task.id, task.dependencies);
  });
  
  // Topological sort to identify waves
  const waves = computeWaves(graph);
  
  // Find critical path (longest dependency chain)
  const criticalPath = findLongestPath(graph, tasks);
  
  // Calculate max parallelism per wave
  const maxParallelism = Math.max(...waves.map(w => w.length));
  
  return { waves, criticalPath, maxParallelism };
}

// Example output:
// Wave 1: [T1]
// Wave 2: [T2]
// Wave 3: [T3, T4]  ← Parallel execution
// Wave 4: [T5]
// Critical Path: T1 → T2 → T3 → T5 (75 min)
// Max Parallelism: 2 (Wave 3)
```

**3. Wave Assignment**
```typescript
interface Wave {
  number: number;
  tasks: Task[];
  parallelExecutions: number;
  estimatedDuration: number; // max of all task durations
}

function assignWaves(tasks: Task[]): Wave[] {
  const waves: Wave[] = [];
  const completed = new Set<string>();
  
  while (completed.size < tasks.length) {
    // Find tasks whose dependencies are all completed
    const readyTasks = tasks.filter(task => 
      !completed.has(task.id) &&
      task.dependencies.every(dep => completed.has(dep))
    );
    
    if (readyTasks.length === 0) {
      throw new Error('Circular dependency detected!');
    }
    
    waves.push({
      number: waves.length + 1,
      tasks: readyTasks,
      parallelExecutions: readyTasks.length,
      estimatedDuration: Math.max(...readyTasks.map(t => t.estimatedDuration))
    });
    
    readyTasks.forEach(task => completed.add(task.id));
  }
  
  return waves;
}
```

**4. Cycle Detection**
```typescript
function detectCycles(graph: Map<string, string[]>): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycle(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);
    
    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true; // Back edge found - cycle!
      }
    }
    
    recursionStack.delete(node);
    return false;
  }
  
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      if (hasCycle(node)) return true;
    }
  }
  
  return false;
}
```

---

## 🎭 Agent Specialization Strategy

### Coordinator Agent Responsibilities

The coordinator is the **only** agent that:
- Analyzes the user's request
- Decomposes into subtasks
- Builds dependency graph
- Detects cycles and validates DAG
- Assigns tasks to workers
- Monitors progress
- Aggregates results
- Handles failures and retries

**Coordinator Prompt Template:**
```
You are the Coordinator Agent for Mugiwara Kaizoku project.

Your responsibilities:
1. Analyze the user's request
2. Decompose into atomic tasks
3. Identify dependencies between tasks
4. Create a task dependency graph (DAG)
5. Organize tasks into parallel execution waves
6. Delegate tasks to specialized worker agents
7. Aggregate results when all tasks complete
8. Handle errors and coordinate retries

CRITICAL RULES:
- Always validate the DAG has no cycles
- Default to sequential unless parallelism is obvious and safe
- Preserve all context needed by workers
- Never let workers modify shared state concurrently
- Aggregate results only after entire wave completes

Current task: {user_request}

Step 1: Decompose into subtasks...
```

### Worker Agent Types

Based on Mugiwara Kaizoku's architecture, define specialized workers:

**1. Database Specialist**
```typescript
const databaseAgent = {
  name: 'database-specialist',
  expertise: [
    'Prisma schema updates',
    'Database migrations',
    'Query optimization',
    'Index design'
  ],
  tools: ['prisma', 'postgresql'],
  restrictions: [
    'Cannot run migrations in parallel',
    'Must use transactions for multi-table changes'
  ]
};
```

**2. Type System Specialist**
```typescript
const typeSystemAgent = {
  name: 'type-specialist',
  expertise: [
    'TypeScript type definitions',
    'Domain type creation',
    'Type system architecture',
    'Zod schema validation'
  ],
  tools: ['typescript', 'zod'],
  restrictions: [
    'Must follow type-system-architecture-standardization.md',
    'No any types allowed',
    'Must use domain types from @/types/domain/*'
  ]
};
```

**3. Backend API Specialist**
```typescript
const backendAgent = {
  name: 'backend-specialist',
  expertise: [
    'tRPC router implementation',
    'API endpoint design',
    'Service layer logic',
    'AsyncResult pattern'
  ],
  tools: ['trpc', 'prisma', 'pino'],
  restrictions: [
    'Must use tRPC v11 syntax (isPending for mutations)',
    'Must implement withEnhancedErrorHandling',
    'Must follow AsyncResult pattern'
  ]
};
```

**4. Frontend Component Specialist**
```typescript
const frontendAgent = {
  name: 'frontend-specialist',
  expertise: [
    'React component implementation',
    'Mantine UI v7 components',
    'State management (Zustand, Jotai)',
    'TanStack Query integration'
  ],
  tools: ['react', 'mantine', 'tanstack-query'],
  restrictions: [
    'Must use Mantine v7 props (fw, gap, justify)',
    'No prop spreading without type safety',
    'Must handle loading and error states'
  ]
};
```

**5. Testing Specialist**
```typescript
const testingAgent = {
  name: 'testing-specialist',
  expertise: [
    'Unit test implementation',
    'Integration testing',
    'Test coverage analysis',
    'Mock data generation'
  ],
  tools: ['jest', 'testing-library'],
  restrictions: [
    'Must achieve >80% coverage for new code',
    'Must test error cases',
    'Must use proper test isolation'
  ]
};
```

**6. Documentation Specialist**
```typescript
const docsAgent = {
  name: 'docs-specialist',
  expertise: [
    'Documentation updates',
    'API documentation',
    'Code examples',
    'Markdown formatting'
  ],
  tools: ['markdown', 'documentation-search-mcp'],
  restrictions: [
    'Must follow CLAUDE_DOCUMENTATION_RULES.md',
    'Update existing docs, never duplicate',
    'Check for canonical docs first'
  ]
};
```

---

## 📋 Coordination Protocols

### 1. Task Handoff Protocol

Treat every agent handoff as a versioned API with strict validation.

**Handoff Message Schema:**
```typescript
interface TaskHandoff {
  schemaVersion: '1.0.0';
  traceId: string; // For distributed tracing
  taskId: string;
  fromAgent: string;
  toAgent: string;
  context: {
    userRequest: string;
    dependenciesCompleted: string[];
    sharedState: Record<string, unknown>;
    filesModified: string[];
  };
  task: {
    description: string;
    acceptance Criteria: string[];
    estimatedDuration: number;
    priority: 'high' | 'medium' | 'low';
  };
  constraints: {
    projectRules: string[]; // e.g., ['DEVELOPMENT_RULES.md']
    mustNotModify: string[];
    mustUse: string[];
  };
}

// Example handoff
const handoff: TaskHandoff = {
  schemaVersion: '1.0.0',
  traceId: 'coord-1234-task-5678',
  taskId: 'T3',
  fromAgent: 'coordinator',
  toAgent: 'backend-specialist',
  context: {
    userRequest: 'Add manga search by title feature',
    dependenciesCompleted: ['T1:schema', 'T2:types'],
    sharedState: {
      newTypes: ['MangaSearchInput', 'MangaSearchResult'],
      schemaUpdates: ['Added fullTextSearch index on Manga.title']
    },
    filesModified: ['prisma/schema.prisma', 'src/types/manga/index.ts']
  },
  task: {
    description: 'Implement tRPC endpoint for manga title search',
    acceptanceCriteria: [
      'Endpoint accepts MangaSearchInput',
      'Returns MangaSearchResult[]',
      'Uses AsyncResult pattern',
      'Includes pagination',
      'Handles errors with withEnhancedErrorHandling'
    ],
    estimatedDuration: 30,
    priority: 'high'
  },
  constraints: {
    projectRules: ['DEVELOPMENT_RULES.md', 'api-documentation-standardized.md'],
    mustNotModify: ['prisma/schema.prisma'], // Already updated in T1
    mustUse: ['@/types/manga', 'AsyncResult', 'withEnhancedErrorHandling']
  }
};
```

### 2. Context Management

**Shared Context (Global)**
```typescript
interface SharedContext {
  projectInfo: {
    name: 'mugiwara-kaizoku';
    techStack: string[];
    conventions: string[];
  };
  currentRequest: string;
  overallGoal: string;
  constraintsGlobal: string[];
}
```

**Local Context (Per Agent)**
```typescript
interface LocalContext {
  taskId: string;
  assignedAgent: string;
  inputs: unknown;
  outputs: unknown;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
}
```

### 3. Result Aggregation

**Aggregation Strategy:**
```typescript
interface TaskResult {
  taskId: string;
  agent: string;
  status: 'success' | 'failure';
  outputs: {
    filesCreated: string[];
    filesModified: string[];
    linesAdded: number;
    linesRemoved: number;
  };
  validationResults: {
    typeCheck: boolean;
    lintCheck: boolean;
    testsPassing: boolean;
  };
  duration: number; // milliseconds
  errors?: Error[];
}

function aggregateWaveResults(waveResults: TaskResult[]): WaveResult {
  const allSuccess = waveResults.every(r => r.status === 'success');
  const allValidated = waveResults.every(r => 
    r.validationResults.typeCheck &&
    r.validationResults.lintCheck &&
    r.validationResults.testsPassing
  );
  
  return {
    waveNumber: currentWave,
    tasksCompleted: waveResults.length,
    allSuccess,
    allValidated,
    totalDuration: Math.max(...waveResults.map(r => r.duration)),
    filesModified: [...new Set(waveResults.flatMap(r => r.outputs.filesModified))],
    nextWave: allSuccess && allValidated ? currentWave + 1 : null
  };
}
```

---

## ⚠️ Critical Rules & Constraints

### Rule 1: Default to Sequential

Default to sequential unless parallelism is obvious and safe.

**Why:** Prevents:
- Race conditions on shared state
- Conflicting file modifications
- Dependency violations
- Debugging nightmares

**When Parallelism is Safe:**
- ✅ Read-only operations
- ✅ Different files/modules
- ✅ No shared mutable state
- ✅ Explicitly independent tasks

### Rule 2: Validate ALL Results Before Next Wave

**Never proceed to next wave if:**
- ❌ Any task failed
- ❌ Type checking failed
- ❌ ESLint errors exist
- ❌ Tests not passing
- ❌ Files conflict

**Validation Checklist:**
```bash
# After each wave completes:
1. Run: bun run type-check
2. Run: bun run lint
3. Run: bun test
4. Check: No file conflicts
5. Verify: All acceptance criteria met
```

### Rule 3: Single Source of Truth for State

**Shared State Management:**
```typescript
// ❌ BAD: Multiple agents modifying same data
Agent1: Update User.name
Agent2: Update User.name  // CONFLICT!

// ✅ GOOD: One agent owns each entity
Agent1: Update User.name
Agent2: Update User.email  // Different field, OK

// ✅ BETTER: Sequential for same entity
Wave 1: Agent1 updates User
Wave 2: Agent2 reads updated User
```

### Rule 4: Explicit Dependency Declaration

**Always declare dependencies explicitly:**
```typescript
// ❌ BAD: Implicit dependency
{
  id: 'frontend',
  description: 'Build component',
  dependencies: [] // WRONG! Needs types
}

// ✅ GOOD: Explicit dependency
{
  id: 'frontend',
  description: 'Build component',
  dependencies: ['types'] // Clear!
}
```

### Rule 5: Error Handling & Recovery

**Failure Modes:**
```typescript
enum FailureMode {
  RETRY_TASK = 'retry',      // Retry same task (network error)
  SKIP_TASK = 'skip',         // Skip and continue (optional task)
  ABORT_WAVE = 'abort_wave',  // Stop wave, preserve completed
  ABORT_ALL = 'abort_all'     // Full rollback
}

function handleTaskFailure(
  task: Task,
  error: Error,
  attempt: number
): FailureMode {
  // Retryable errors (network, timeout)
  if (isRetryable(error) && attempt < 3) {
    return FailureMode.RETRY_TASK;
  }
  
  // Optional task (documentation)
  if (task.optional) {
    return FailureMode.SKIP_TASK;
  }
  
  // Critical task in wave
  if (task.critical) {
    return FailureMode.ABORT_WAVE;
  }
  
  // Default: abort wave, preserve completed tasks
  return FailureMode.ABORT_WAVE;
}
```

### Rule 6: Resource Constraints

**Agent Budget Management:**
```typescript
interface ResourceLimits {
  maxParallelAgents: 5; // Don't overwhelm API
  maxTaskDuration: 600; // 10 minutes per task
  maxWaves: 10; // Prevent infinite loops
  maxRetries: 3; // Per task
}

function respectResourceLimits(wave: Wave): boolean {
  if (wave.tasks.length > ResourceLimits.maxParallelAgents) {
    // Split wave into multiple sub-waves
    return splitWave(wave);
  }
  
  if (wave.estimatedDuration > ResourceLimits.maxTaskDuration) {
    // Task too large, needs decomposition
    return false;
  }
  
  return true;
}
```

---

## 🔄 Complete Orchestration Workflow

### End-to-End Example: Feature Implementation

**User Request:**
> "Add a new manga search feature with title filtering, pagination, and proper error handling. Include frontend component, backend API, tests, and documentation."

**Step 1: Coordinator Analysis**
```typescript
// Coordinator decomposes request
const analysis = {
  mainGoal: 'Add manga search feature with title filtering',
  subTasks: [
    'Update database schema for full-text search',
    'Create TypeScript types for search',
    'Implement tRPC search endpoint',
    'Create React search component',
    'Write test coverage',
    'Update API documentation'
  ],
  estimatedComplexity: 'HIGH',
  recommendOrchestration: true,
  reason: '6 subtasks, ~2 hours, clear parallelization opportunities'
};
```

**Step 2: Task Decomposition**
```typescript
const tasks: Task[] = [
  {
    id: 'T1',
    description: 'Add full-text search index to Manga.title in Prisma schema',
    agent: 'database-specialist',
    estimatedDuration: 15,
    dependencies: [],
    outputs: ['prisma/schema.prisma'],
    acceptanceCriteria: [
      'Index added to schema',
      'Migration generated',
      'Schema validates'
    ]
  },
  {
    id: 'T2',
    description: 'Create MangaSearchInput and MangaSearchResult types',
    agent: 'type-specialist',
    estimatedDuration: 10,
    dependencies: ['T1'],
    outputs: ['src/types/manga/index.ts'],
    acceptanceCriteria: [
      'Types follow domain conventions',
      'Zod schemas included',
      'Exported from types/manga barrel'
    ]
  },
  {
    id: 'T3',
    description: 'Implement tRPC searchMangaByTitle endpoint',
    agent: 'backend-specialist',
    estimatedDuration: 30,
    dependencies: ['T2'],
    outputs: ['src/server/routers/manga.router.ts'],
    acceptanceCriteria: [
      'Uses AsyncResult pattern',
      'Implements pagination',
      'Uses withEnhancedErrorHandling',
      'Validates input with Zod'
    ]
  },
  {
    id: 'T4',
    description: 'Create MangaSearchBar React component',
    agent: 'frontend-specialist',
    estimatedDuration: 25,
    dependencies: ['T2'],
    outputs: ['src/components/manga/MangaSearchBar.tsx'],
    acceptanceCriteria: [
      'Uses Mantine v7 components',
      'Debounces search input',
      'Handles loading and error states',
      'Uses TanStack Query'
    ]
  },
  {
    id: 'T5',
    description: 'Write comprehensive test suite',
    agent: 'testing-specialist',
    estimatedDuration: 20,
    dependencies: ['T3', 'T4'],
    outputs: ['src/server/routers/manga.test.ts', 'src/components/manga/MangaSearchBar.test.tsx'],
    acceptanceCriteria: [
      '>80% code coverage',
      'Tests both success and error cases',
      'Integration tests included'
    ]
  },
  {
    id: 'T6',
    description: 'Update API documentation',
    agent: 'docs-specialist',
    estimatedDuration: 15,
    dependencies: ['T3'],
    outputs: ['docs/api/manga-api.md'],
    acceptanceCriteria: [
      'Endpoint documented',
      'Request/response examples included',
      'Error codes documented'
    ]
  }
];
```

**Step 3: Dependency Graph Construction**
```
T1 (Schema)
 │
 └─→ T2 (Types)
      ├─→ T3 (Backend) ─→ T5 (Tests)
      │                   ↗
      ├─→ T4 (Frontend) ─┘
      │
      └─→ T6 (Docs)
```

**Step 4: Wave Assignment**
```typescript
const waves: Wave[] = [
  {
    number: 1,
    tasks: ['T1'],
    parallelExecutions: 1,
    estimatedDuration: 15
  },
  {
    number: 2,
    tasks: ['T2'],
    parallelExecutions: 1,
    estimatedDuration: 10
  },
  {
    number: 3,
    tasks: ['T3', 'T4', 'T6'], // PARALLEL!
    parallelExecutions: 3,
    estimatedDuration: 30 // max(30, 25, 15)
  },
  {
    number: 4,
    tasks: ['T5'],
    parallelExecutions: 1,
    estimatedDuration: 20
  }
];

// Total sequential time: 15 + 10 + 30 + 25 + 20 + 15 = 115 min
// With orchestration: 15 + 10 + 30 + 20 = 75 min
// Time saved: 40 minutes (35%)
```

**Step 5: Execution with Monitoring**
```typescript
async function executeOrchestration(waves: Wave[]): Promise<OrchestrationResult> {
  const results: TaskResult[] = [];
  
  for (const wave of waves) {
    console.log(`\n🌊 Starting Wave ${wave.number} (${wave.parallelExecutions} parallel tasks)`);
    
    // Execute all tasks in wave concurrently
    const wavePromises = wave.tasks.map(taskId => 
      executeTask(taskId, tasks.find(t => t.id === taskId)!)
    );
    
    const waveResults = await Promise.all(wavePromises);
    results.push(...waveResults);
    
    // Validate wave results
    const validation = validateWaveResults(waveResults);
    
    if (!validation.success) {
      console.error(`❌ Wave ${wave.number} failed validation`);
      return {
        status: 'FAILED',
        completedWaves: wave.number - 1,
        failedTasks: validation.failures,
        results
      };
    }
    
    console.log(`✅ Wave ${wave.number} completed successfully`);
  }
  
  // Final validation
  await runFinalValidation();
  
  return {
    status: 'SUCCESS',
    completedWaves: waves.length,
    totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
    results
  };
}
```

**Step 6: Result Aggregation**
```typescript
const finalResult = {
  status: 'SUCCESS',
  wavesCompleted: 4,
  tasksCompleted: 6,
  filesCreated: 3,
  filesModified: 4,
  totalLinesAdded: 487,
  duration: '75 minutes',
  timeSaved: '40 minutes (35%)',
  validation: {
    typeCheck: '✅ PASSED',
    lint: '✅ PASSED',
    tests: '✅ PASSED (92% coverage)',
    commits: '✅ Ready for /commit'
  }
};
```

---

## 📊 Monitoring & Observability

### Metrics to Track

**Per Task:**
- Execution time (actual vs estimated)
- Success rate
- Retry count
- Error types
- Resource usage

**Per Wave:**
- Parallelism achieved
- Wave duration
- Validation success rate
- Bottleneck identification

**Overall Orchestration:**
- Total duration
- Time saved vs sequential
- Critical path efficiency
- Agent utilization

### Logging Strategy

```typescript
// Structured logging with Pino
logger.info({
  orchestrationId: 'orch-123',
  waveNumber: 3,
  taskId: 'T3',
  agent: 'backend-specialist',
  status: 'started',
  dependencies: ['T2'],
  estimatedDuration: 30
}, 'Task started');

logger.info({
  orchestrationId: 'orch-123',
  waveNumber: 3,
  taskId: 'T3',
  agent: 'backend-specialist',
  status: 'completed',
  actualDuration: 28,
  filesModified: ['manga.router.ts'],
  linesAdded: 120
}, 'Task completed');
```

---

## 🎯 Success Criteria

### For Individual Tasks
- ✅ Acceptance criteria met
- ✅ Type checking passes
- ✅ ESLint passes
- ✅ Tests pass (if applicable)
- ✅ Follows project conventions
- ✅ No file conflicts

### For Waves
- ✅ All tasks completed successfully
- ✅ No validation errors
- ✅ Within resource limits
- ✅ No shared state conflicts
- ✅ Proper handoffs to next wave

### For Overall Orchestration
- ✅ All waves completed
- ✅ Final validation passes
- ✅ Time saved vs sequential ≥ 25%
- ✅ Ready for `/commit`
- ✅ No technical debt introduced
- ✅ Documentation updated

---

## 🚨 Anti-Patterns to Avoid

### 1. Over-Parallelization
```typescript
// ❌ BAD: Parallelizing tasks that share state
const badWave = [
  { task: 'Update User.name', agent: 'agent1' },
  { task: 'Update User.email', agent: 'agent2' },
  { task: 'Update User.role', agent: 'agent3' }
]; // RACE CONDITION!

// ✅ GOOD: Sequential for shared entity
const goodWave1 = [{ task: 'Update User fields', agent: 'agent1' }];
```

### 2. Hidden Dependencies
```typescript
// ❌ BAD: Task B actually depends on Task A, not declared
{
  id: 'B',
  dependencies: [], // WRONG!
  task: 'Use types from Task A'
}

// ✅ GOOD: Explicit dependencies
{
  id: 'B',
  dependencies: ['A'],
  task: 'Use types from Task A'
}
```

### 3. Ignoring Validation
```typescript
// ❌ BAD: Proceeding despite failures
if (waveResult.hasFailed) {
  console.log('Some tasks failed, continuing anyway...'); // NO!
}

// ✅ GOOD: Stop and fix
if (waveResult.hasFailed) {
  throw new Error('Wave failed validation. Fix errors before proceeding.');
}
```

### 4. Orchestration for Simple Tasks
```typescript
// ❌ BAD: Overhead exceeds benefit
const simpleTask = 'Fix typo in documentation';
// Don't orchestrate! Just do it.

// ✅ GOOD: Orchestrate complex tasks only
if (estimatedDuration < 15 || subtasks.length < 3) {
  return 'Do sequentially without orchestration';
}
```

### 5. Losing Context Between Waves
```typescript
// ❌ BAD: Agent doesn't know what previous wave did
handoff = {
  task: 'Build on previous work'
  // Missing: What was the previous work?
};

// ✅ GOOD: Full context preserved
handoff = {
  task: 'Build on previous work',
  context: {
    dependenciesCompleted: ['T1', 'T2'],
    filesModified: ['schema.prisma', 'types.ts'],
    outputs: { newTypes: ['SearchInput', 'SearchResult'] }
  }
};
```

---

## 📝 Documentation Requirements

### For Each Orchestration

Document in project logs:
- Initial request
- Task decomposition
- Dependency graph
- Wave execution plan
- Actual vs estimated durations
- Failures and recoveries
- Final results
- Lessons learned

### Example Log Entry
```markdown
# Orchestration Log: Manga Search Feature

**Date**: 2025-10-26
**Request**: Add manga search with title filtering
**Estimated Duration**: 115 min sequential
**Actual Duration**: 75 min (35% savings)

## Task Breakdown
- T1: Schema update (15 min)
- T2: Type definitions (10 min)
- T3: tRPC endpoint (30 min) }
- T4: React component (25 min) } Wave 3 (parallel)
- T6: Documentation (15 min)  }
- T5: Tests (20 min)

## Results
✅ All validations passed
✅ 92% test coverage
✅ No file conflicts
✅ Ready for commit

## Lessons Learned
- T3 took 28 min (vs 30 estimated) - good estimation
- T4 took 27 min (vs 25 estimated) - Mantine setup took extra time
- Wave 3 parallelization worked perfectly
```

---

## 🔄 Continuous Improvement

### Review After Each Orchestration

1. **What worked well?**
   - Which tasks parallelized effectively?
   - Were estimates accurate?
   - Did handoffs preserve context?

2. **What could improve?**
   - Hidden dependencies discovered?
   - Better task decomposition possible?
   - Agent specializations need refinement?

3. **Update Guidelines**
   - Add new patterns discovered
   - Document anti-patterns encountered
   - Refine estimation models

---

*This directive evolves with experience. Update it as orchestration patterns mature.*

**Next Steps:**
1. Review directive with team
2. Implement coordinator agent
3. Define worker agent prompts
4. Run pilot orchestration
5. Measure and iterate

---

*Last Updated: 2025-10-26*
*Version: 1.0*
