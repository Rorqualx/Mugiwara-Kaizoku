# Console to Logger AST Migration Plan

## Executive Summary
This document outlines a comprehensive plan to migrate 1,405 console.* calls across 205 files to use the proper logger infrastructure using AST (Abstract Syntax Tree) transformations. The migration will be automated, type-safe, and completed with zero runtime errors.

## Migration Goals
1. **Zero console.* calls** in production code
2. **100% logger adoption** across the codebase
3. **Preserve all log semantics** and context
4. **Add proper error tracking** and structured logging
5. **Prevent future violations** with ESLint rules

## Phase 1: Analysis & Preparation (Day 1)

### 1.1 Logger System Audit
```typescript
// Current Logger Infrastructure
- Client Logger: src/utils/logger.ts (Pino-based)
- Server Logger: src/server/utils/logger.ts (Simple wrapper)
- Compatibility: src/utils/logging.ts (Shim layer)

// Available Methods
logger.debug(message, context?)
logger.info(message, context?)
logger.warn(message, context?)
logger.error(message, errorOrContext?)
```

### 1.2 Console Usage Patterns
```typescript
// Pattern 1: Simple logging
console.log('Message');
→ logger.info('Message');

// Pattern 2: Multiple arguments
console.log('User:', user, 'Action:', action);
→ logger.info('User action', { user, action });

// Pattern 3: Error with object
console.error('Error:', error);
→ logger.error('Error occurred', error);

// Pattern 4: Template literals
console.log(`Processing ${count} items`);
→ logger.info(`Processing ${count} items`);

// Pattern 5: Conditional logging
if (DEBUG) console.log(data);
→ if (DEBUG) logger.debug('Debug data', { data });

// Pattern 6: Object/Array logging
console.log({ user, settings });
→ logger.info('Data', { user, settings });

// Pattern 7: Console with emojis
console.log('✅ Success!');
→ logger.info('Success!');
```

## Phase 2: AST Transformation Rules (Day 2)

### 2.1 Core Transformation Rules
```typescript
interface TransformationRule {
  from: 'console.log' | 'console.error' | 'console.warn' | 'console.debug' | 'console.info';
  to: 'logger.info' | 'logger.error' | 'logger.warn' | 'logger.debug';
  contextStrategy: 'preserve' | 'structured' | 'flatten';
}

const transformationMap: TransformationRule[] = [
  { from: 'console.log', to: 'logger.info', contextStrategy: 'structured' },
  { from: 'console.error', to: 'logger.error', contextStrategy: 'preserve' },
  { from: 'console.warn', to: 'logger.warn', contextStrategy: 'structured' },
  { from: 'console.debug', to: 'logger.debug', contextStrategy: 'structured' },
  { from: 'console.info', to: 'logger.info', contextStrategy: 'structured' },
];
```

### 2.2 Context Transformation Strategies
```typescript
// Strategy 1: Preserve - Keep error objects as-is
console.error('Failed', error) → logger.error('Failed', error)

// Strategy 2: Structured - Convert to context object
console.log('User:', id, 'Name:', name) → logger.info('User details', { id, name })

// Strategy 3: Flatten - Combine into message
console.log('Count:', n) → logger.info(`Count: ${n}`)
```

### 2.3 Import Management Rules
```typescript
// Rule 1: Add logger import if not present
import { logger } from '../utils/logger';

// Rule 2: Calculate correct relative path
const importPath = calculateRelativePath(filePath, 'src/utils/logger');

// Rule 3: Use server logger for server files
if (filePath.includes('/server/')) {
  importPath = '../server/utils/logger';
}

// Rule 4: Preserve existing logger imports
if (hasLoggerImport(ast)) {
  // Use existing import
}
```

## Phase 3: AST Migration Script (Day 3-4)

### 3.1 Script Architecture
```typescript
// migrate-console-to-logger.ts
interface MigrationOptions {
  dryRun: boolean;
  verbose: boolean;
  include: string[];
  exclude: string[];
  backup: boolean;
  validateTypes: boolean;
}

class ConsoleToLoggerMigration {
  private stats = {
    filesProcessed: 0,
    consolesReplaced: 0,
    importsAdded: 0,
    errors: []
  };

  async migrate(options: MigrationOptions): Promise<MigrationResult> {
    // 1. Discover files
    const files = await this.discoverFiles(options);
    
    // 2. Process each file
    for (const file of files) {
      await this.processFile(file, options);
    }
    
    // 3. Validate results
    if (options.validateTypes) {
      await this.validateTypeScript();
    }
    
    return this.stats;
  }
}
```

### 3.2 AST Transformation Logic
```typescript
function transformConsoleToLogger(
  node: CallExpression,
  context: TransformContext
): CallExpression {
  // 1. Identify console method
  const method = getConsoleMethod(node);
  
  // 2. Map to logger method
  const loggerMethod = mapToLoggerMethod(method);
  
  // 3. Transform arguments
  const args = transformArguments(node.arguments, method);
  
  // 4. Create new logger call
  return createLoggerCall(loggerMethod, args);
}

function transformArguments(
  args: Expression[],
  method: string
): Expression[] {
  if (method === 'error' && args.length === 2) {
    // Preserve error object structure
    return args;
  }
  
  if (args.length > 1) {
    // Convert to structured logging
    return [
      createStringLiteral(extractMessage(args[0])),
      createObjectExpression(args.slice(1))
    ];
  }
  
  return args;
}
```

### 3.3 Edge Case Handlers
```typescript
// Edge Case 1: Console in conditional expressions
condition ? console.log('yes') : console.log('no')
→ condition ? logger.info('yes') : logger.info('no')

// Edge Case 2: Console with spread operator
console.log(...args)
→ logger.info('Multiple values', { values: args })

// Edge Case 3: Console.table/group/time
console.table(data) → logger.info('Table data', { data })
console.group(label) → logger.info(`--- ${label} ---`)
console.time(label) → // Add performance monitoring

// Edge Case 4: Dynamic console methods
console[logLevel](message)
→ logger[mapLogLevel(logLevel)](message)

// Edge Case 5: Console in JSDoc (skip)
/**
 * @example
 * console.log(result); // Don't transform
 */
```

## Phase 4: Implementation Strategy (Day 5-7)

### 4.1 Execution Order
```yaml
Priority 1 - Critical Production (Day 5):
  - src/server/queue/*.ts (25 files)
  - src/server/services/*.ts (30 files)
  - src/pages/api/*.ts (15 files)
  
Priority 2 - Core Utilities (Day 6):
  - src/utils/*.ts (20 files)
  - src/hooks/*.ts (42 files)
  - src/lib/*.ts (15 files)
  
Priority 3 - Components & UI (Day 7):
  - src/components/**/*.tsx (35 files)
  - src/contexts/*.tsx (8 files)
  - src/pages/*.tsx (10 files)
```

### 4.2 Migration Commands
```bash
# Dry run to preview changes
npm run migrate:console -- --dry-run

# Run migration on specific directory
npm run migrate:console -- --include="src/server/**/*.ts"

# Run with backup
npm run migrate:console -- --backup

# Run with type validation
npm run migrate:console -- --validate

# Full migration
npm run migrate:console -- --all
```

### 4.3 Validation Steps
```typescript
// Step 1: TypeScript compilation
async function validateTypeScript(): Promise<boolean> {
  const result = await exec('npx tsc --noEmit');
  return result.exitCode === 0;
}

// Step 2: Test suite execution
async function runTests(): Promise<boolean> {
  const result = await exec('npm test');
  return result.exitCode === 0;
}

// Step 3: Runtime validation
async function validateRuntime(): Promise<boolean> {
  // Start dev server and check for errors
  const server = spawn('npm', ['run', 'dev']);
  // Monitor for console usage or errors
}

// Step 4: Logger output validation
async function validateLoggerOutput(): Promise<boolean> {
  // Ensure logs are properly formatted
  // Check log levels are appropriate
  // Verify structured data is preserved
}
```

## Phase 5: Quality Assurance (Day 8-9)

### 5.1 Testing Matrix
| Test Type | Coverage | Automated |
|-----------|----------|-----------|
| Unit Tests | Transform functions | ✅ |
| Integration Tests | File processing | ✅ |
| Type Safety | TypeScript compilation | ✅ |
| Runtime Tests | Dev server startup | ✅ |
| Manual Review | Critical paths | ❌ |
| Performance Tests | Log output overhead | ✅ |

### 5.2 Rollback Strategy
```bash
# Automatic backup before migration
git checkout -b console-migration-backup
git add .
git commit -m "Backup before console migration"

# If issues arise
git checkout main
git branch -D console-migration

# Selective rollback
git checkout HEAD -- src/specific/file.ts
```

### 5.3 Success Criteria
```typescript
const successCriteria = {
  typeScriptErrors: 0,
  testFailures: 0,
  runtimeErrors: 0,
  consoleUsage: 0, // Except in logger implementation
  loggerAdoption: '100%',
  performanceImpact: '< 1%'
};
```

## Phase 6: Prevention & Enforcement (Day 10)

### 6.1 ESLint Configuration
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-console': ['error', {
      allow: [] // No exceptions
    }],
    'custom-rules/use-logger': 'error'
  },
  overrides: [
    {
      files: ['src/utils/logger.ts', 'src/server/utils/logger.ts'],
      rules: {
        'no-console': 'off' // Logger implementation can use console
      }
    },
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        'no-console': 'warn' // Warn in tests
      }
    }
  ]
};
```

### 6.2 Pre-commit Hooks
```json
// .husky/pre-commit
{
  "hooks": {
    "pre-commit": "npm run lint:console && npm run type-check"
  }
}
```

### 6.3 CI/CD Pipeline
```yaml
# .github/workflows/console-check.yml
name: Console Usage Check
on: [push, pull_request]

jobs:
  check-console:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run lint:console
      - run: npm run test:logger
```

## Phase 7: Documentation & Training (Day 11)

### 7.1 Logger Usage Guide
```markdown
# Logger Usage Guide

## Basic Usage
import { logger } from '@/utils/logger';

// Info level
logger.info('User logged in', { userId, timestamp });

// Error handling
try {
  await operation();
} catch (error) {
  logger.error('Operation failed', error);
}

// Debug with context
logger.debug('Processing data', { 
  count: items.length,
  processingTime: Date.now() - start 
});

## DO NOT USE
console.log() ❌
console.error() ❌
console.warn() ❌
console.debug() ❌
```

### 7.2 Migration Documentation
- Before/After examples
- Common patterns guide
- Troubleshooting section
- Performance considerations

## Timeline & Milestones

| Day | Phase | Deliverables | Success Metric |
|-----|-------|--------------|----------------|
| 1 | Analysis | Pattern documentation | 100% patterns identified |
| 2 | Design | Transformation rules | Rules cover 95% cases |
| 3-4 | Development | AST migration script | Script passes tests |
| 5-7 | Execution | Migrated codebase | 0 TypeScript errors |
| 8-9 | QA | Validated migration | All tests pass |
| 10 | Prevention | ESLint rules | 0 new violations |
| 11 | Documentation | Complete guide | Team trained |

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TypeScript errors | Medium | High | Run type check after each file |
| Runtime errors | Low | High | Comprehensive testing suite |
| Performance regression | Low | Medium | Benchmark before/after |
| Missed edge cases | Medium | Low | Manual review of complex files |
| Rollback needed | Low | High | Git branch strategy |

## Expected Outcomes

### Quantitative
- **1,405 console calls eliminated**
- **205 files updated**
- **100% logger adoption**
- **0 ESLint violations**
- **< 1% performance impact**

### Qualitative
- Improved production debugging
- Structured logging for analysis
- Consistent error handling
- Better observability
- Reduced technical debt

## Automation Script Preview

```typescript
// scripts/migrate-console-to-logger.ts
#!/usr/bin/env npx tsx

import { Project, CallExpression, Node } from 'ts-morph';
import { glob } from 'glob';
import * as path from 'path';

async function migrateConsoleToLogger() {
  const project = new Project({
    tsConfigFilePath: './tsconfig.json'
  });

  const sourceFiles = await glob('src/**/*.{ts,tsx}');
  
  for (const file of sourceFiles) {
    const sourceFile = project.addSourceFileAtPath(file);
    let modified = false;

    // Transform console calls
    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();
        if (Node.isPropertyAccessExpression(expression)) {
          const object = expression.getExpression();
          if (Node.isIdentifier(object) && object.getText() === 'console') {
            transformConsoleCall(node);
            modified = true;
          }
        }
      }
    });

    // Add logger import if needed
    if (modified) {
      ensureLoggerImport(sourceFile);
      await sourceFile.save();
    }
  }

  console.log('Migration complete!');
}

migrateConsoleToLogger().catch(console.error);
```

## Conclusion

This comprehensive AST-based migration plan will systematically eliminate all console usage violations while maintaining code functionality and improving observability. The automated approach reduces effort by 70% and ensures consistency across the codebase.

**Total Estimated Effort**: 11 days (88 hours)
**Automation Savings**: 70% (61 hours saved)
**Net Effort**: 27 hours across 11 days
**ROI**: Immediate improvement in production debugging and long-term maintainability