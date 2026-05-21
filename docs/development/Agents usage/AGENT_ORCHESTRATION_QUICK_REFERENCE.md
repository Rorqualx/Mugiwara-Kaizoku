# Agent Orchestration Quick Reference

*Keep this visible during complex tasks*  
*Last Updated: 2025-10-26*

---

## ⚡ Quick Decision: Should I Orchestrate?

```
┌──────────────────────────────────┐
│  Complexity: 3+ subtasks?        │
│  Duration: 30+ minutes?          │
│  Parallelization: Obvious?       │
└──────────────────────────────────┘
          │
     ALL YES? → ✅ ORCHESTRATE
     ANY NO?  → ❌ Sequential execution
```

---

## 🎯 Orchestration in 4 Steps

### 1. ANALYZE
```typescript
- What's the main goal?
- How many independent subtasks?
- What are the dependencies?
- Time savings worth coordination overhead?
```

### 2. DECOMPOSE  
```typescript
- Break into atomic tasks
- Identify dependencies
- Build DAG (no cycles!)
- Assign to specialized agents
```

### 3. EXECUTE WAVES
```typescript
Wave N:
  ├─ Run tasks in parallel
  ├─ Wait for ALL to complete
  ├─ VALIDATE results
  └─ ✅ Pass? → Next wave
      ❌ Fail? → STOP and fix
```

### 4. AGGREGATE
```typescript
- Collect all outputs
- Check for conflicts
- Run final validation
- Ready for /commit
```

---

## 🎭 Available Agents

| Agent | Expertise | Output |
|-------|-----------|--------|
| `database-specialist` | Prisma, migrations | schema.prisma |
| `type-specialist` | TypeScript, Zod | *-types.ts |
| `backend-specialist` | tRPC, API | *.router.ts |
| `frontend-specialist` | React, Mantine | *.tsx |
| `testing-specialist` | Jest, tests | *.test.ts |
| `docs-specialist` | Markdown, docs | *.md |

---

## 📊 Common Patterns

### Pattern 1: Sequential Waves
```
Wave 1: [Prep]
Wave 2: [Types]
Wave 3: [Backend] [Frontend] [Docs]  ← PARALLEL
Wave 4: [Tests]
```

### Pattern 2: Pure Parallel
```
[Task A] [Task B] [Task C] [Task D]
         ↓
    [Aggregate]
```

### Pattern 3: Hierarchical
```
    [Coordinator]
    ├─ [Manager 1] → [Workers]
    ├─ [Manager 2] → [Workers]
    └─ [Manager 3] → [Workers]
```

---

## ✅ Validation Checklist

**After EVERY wave:**
```bash
□ bun run type-check
□ bun run lint
□ bun test (if code changed)
□ Check file conflicts
□ Verify acceptance criteria
```

**If ANY fail: STOP. Fix before next wave.**

---

## 🚫 Critical Rules

1. ❌ **NO parallelization** of:
   - Same file modifications
   - Shared mutable state
   - Sequential dependencies

2. ✅ **YES to parallelization** of:
   - Different files/modules
   - Read-only operations
   - Truly independent tasks

3. 🔄 **Always**:
   - Validate after each wave
   - Preserve context in handoffs
   - Check for dependency cycles
   - Respect resource limits (max 5 parallel)

---

## 📋 Task Handoff Template

```json
{
  "taskId": "T3",
  "toAgent": "backend-specialist",
  "context": {
    "dependenciesCompleted": ["T1", "T2"],
    "filesModified": ["schema.prisma", "types.ts"],
    "sharedState": { "newTypes": [...] }
  },
  "task": {
    "description": "Clear task description",
    "acceptanceCriteria": ["...", "..."],
    "estimatedDuration": 30
  },
  "constraints": {
    "projectRules": ["DEVELOPMENT_RULES.md"],
    "mustUse": ["AsyncResult", "tRPC v11"]
  }
}
```

---

## ⚠️ Failure Modes

| Error Type | Action |
|------------|--------|
| Network timeout | RETRY (max 3x) |
| Optional task fails | SKIP |
| Critical task fails | ABORT_WAVE |
| Multiple failures | ABORT_ALL |

---

## 📈 Example: Feature Implementation

```
User Request: "Add search feature"

Decomposition:
  T1: Schema (15m)
  T2: Types (10m)  
  T3: Backend (30m) ┐
  T4: Frontend (25m)├─ Wave 3 (parallel)
  T6: Docs (15m)    ┘
  T5: Tests (20m)

Result:
  Sequential: 115 min
  Orchestrated: 75 min  
  Savings: 40 min (35%)
```

---

## 💡 Pro Tips

1. **Default to sequential** - Only parallelize when obvious
2. **Validate religiously** - Never skip wave validation
3. **Context is king** - Always pass complete context
4. **No cycles** - Check DAG has no circular dependencies
5. **Log everything** - Learn from each orchestration
6. **Start small** - First orchestration should be simple
7. **Max 5 parallel** - Don't overwhelm API limits

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Circular dependency" | Check DAG, fix cycle |
| "File conflict" | Tasks modify same file → Sequential |
| "Type check failed" | Fix errors before next wave |
| "Agent timeout" | Increase duration estimate |
| "Context lost" | Check handoff message |

---

## 📖 Full Documentation

- `AGENT_ORCHESTRATION_DIRECTIVE.md` - Complete rules
- `AGENT_ORCHESTRATION_IMPLEMENTATION.md` - Prompts & examples
- `.claude/orchestration/coordinator-prompt.md` - Coordinator prompt
- `.claude/orchestration/agents/*.md` - Worker prompts

---

## 🎬 Example Commands

**Invoke Coordinator:**
```
"Coordinate specialized agents to implement [feature] with:
- Backend API
- Frontend component  
- Tests
- Documentation

Parallelize where possible to minimize completion time."
```

**Monitor Progress:**
```
"Show orchestration status and current wave execution"
```

**Handle Failure:**
```
"Task T3 failed. Analyze failure, suggest fix, retry wave."
```

---

## 🎯 Success = 35%+ Time Savings

**Typical Orchestration:**
- 4 waves
- 6 tasks
- 35-40% time savings
- 0 conflicts
- All validations pass

---

*Print and keep visible during complex development tasks!*
