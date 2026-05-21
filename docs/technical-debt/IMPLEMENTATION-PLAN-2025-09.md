# Aggressive Modernization Implementation Plan

*Status: Active*
*Date: September 20, 2025*
*Approach: No Compatibility, Full Modernization*
*Safety: Git Checkpoints + AST Transformations*

---

## Overview

This plan implements aggressive modernization based on the audit findings. We will NOT maintain backward compatibility, using AST-based transformations for safety and consistency.

## Safety Protocol

### Git Checkpoint Strategy
```bash
# Before EVERY phase
git add -A
git commit -m "CHECKPOINT: Before [Phase Name] - $(date +%Y%m%d_%H%M%S)"
git tag -a "checkpoint-[phase]-start" -m "Safety checkpoint before [phase]"

# After successful phase
git add -A
git commit -m "COMPLETE: [Phase Name] - [Results]"
git tag -a "checkpoint-[phase]-complete" -m "Phase complete checkpoint"

# Rollback procedure if needed
git reset --hard checkpoint-[phase]-start
```

### Type Check Protocol
```bash
# Run after EVERY file change batch (max 10 files)
npx tsc --noEmit 2>&1 | tee typecheck-$(date +%s).log

# If errors > previous count
git reset --hard HEAD
echo "ROLLBACK: Type errors increased"
```

---

## Phase 1: Mantine v7 Props Migration (Day 1)

### Objective
Fix all 58 `spacing=` violations without compatibility

### Safety Checkpoint
```bash
git add -A && git commit -m "CHECKPOINT: Before Mantine migration - $(date +%Y%m%d_%H%M%S)"
git tag -a "checkpoint-mantine-start" -m "Before Mantine v7 migration"
```

### AST Transformation Script
```typescript
// scripts/transform-mantine-props.ts
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const transformMantineProps = (sourceFile: ts.SourceFile): ts.SourceFile => {
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    return (sourceFile) => {
      const visitor: ts.Visitor = (node) => {
        if (ts.isJsxAttribute(node) && node.name?.getText() === 'spacing') {
          return ts.factory.createJsxAttribute(
            ts.factory.createIdentifier('gap'),
            node.initializer
          );
        }
        return ts.visitEachChild(node, visitor, context);
      };
      return ts.visitNode(sourceFile, visitor);
    };
  };

  const result = ts.transform(sourceFile, [transformer]);
  return result.transformed[0];
};

// Test mode first
const testFiles = [
  'src/components/mangaDetail.tsx',
  'src/components/settings/MetadataProvidersGrid.tsx'
];

// Apply and verify
```

### Verification
```bash
# Before
grep -r "spacing=" src --include="*.tsx" | wc -l  # Should be 58

# After
grep -r "spacing=" src --include="*.tsx" | wc -l  # Should be 0
grep -r "gap=" src --include="*.tsx" | wc -l     # Should increase by 58
```

---

## Phase 2: AsyncResult Consolidation (Day 2)

### Objective
Eliminate 4 duplicate implementations, create single source of truth

### Safety Checkpoint
```bash
git add -A && git commit -m "CHECKPOINT: Before AsyncResult consolidation - $(date +%Y%m%d_%H%M%S)"
git tag -a "checkpoint-asyncresult-start" -m "Before AsyncResult consolidation"
```

### Consolidation Script
```typescript
// scripts/consolidate-asyncresult.ts
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const filesToConsolidate = [
  'src/utils/async-result-extended.ts',
  'src/utils/async-result-helpers.ts',
  'src/hooks/useAsyncOperation.tsx'
];

// Step 1: Extract all unique functions
const extractFunctions = (filePath: string): Map<string, ts.FunctionDeclaration> => {
  const source = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf-8'),
    ts.ScriptTarget.Latest,
    true
  );

  const functions = new Map<string, ts.FunctionDeclaration>();

  ts.forEachChild(source, node => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.set(node.name.text, node);
    }
  });

  return functions;
};

// Step 2: Merge into single file
const mergeIntoCore = () => {
  const coreFunctions = new Set<string>();
  const coreFile = 'src/utils/async-result.ts';

  // Get existing core functions
  const coreSource = ts.createSourceFile(
    coreFile,
    fs.readFileSync(coreFile, 'utf-8'),
    ts.ScriptTarget.Latest,
    true
  );

  // Remove duplicates, keep best implementation
  // Update imports in all files
};
```

### Update Imports
```typescript
// scripts/update-asyncresult-imports.ts
const updateImports = (sourceFile: ts.SourceFile): ts.SourceFile => {
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    return (sourceFile) => {
      const visitor: ts.Visitor = (node) => {
        if (ts.isImportDeclaration(node)) {
          const moduleSpecifier = node.moduleSpecifier;
          if (ts.isStringLiteral(moduleSpecifier)) {
            const importPath = moduleSpecifier.text;
            if (importPath.includes('async-result-extended') ||
                importPath.includes('async-result-helpers')) {
              // Update to core import
              return ts.factory.updateImportDeclaration(
                node,
                node.decorators,
                node.modifiers,
                node.importClause,
                ts.factory.createStringLiteral('@/utils/async-result'),
                node.assertClause
              );
            }
          }
        }
        return ts.visitEachChild(node, visitor, context);
      };
      return ts.visitNode(sourceFile, visitor);
    };
  };

  const result = ts.transform(sourceFile, [transformer]);
  return result.transformed[0];
};
```

---

## Phase 3: Type Safety Campaign (Days 3-7)

### Objective
Eliminate 3,674 type violations aggressively

### Safety Checkpoint
```bash
git add -A && git commit -m "CHECKPOINT: Before type safety campaign - $(date +%Y%m%d_%H%M%S)"
git tag -a "checkpoint-types-start" -m "Before type safety elimination"
```

### AST Type Replacement Script
```typescript
// scripts/eliminate-any-types.ts
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

interface TypeMapping {
  pattern: RegExp;
  replacement: string;
  context?: string;
}

const typeMappings: TypeMapping[] = [
  // Store mutations
  {
    pattern: /useMutation.*\(options: any\)/,
    replacement: 'UseMutationOptions<TData, TError, TVariables>',
    context: 'store'
  },
  // Component props
  {
    pattern: /manga: any/,
    replacement: 'manga: MangaWithRelations',
    context: 'component'
  },
  {
    pattern: /library: any/,
    replacement: 'library: Library',
    context: 'component'
  },
  // API contexts
  {
    pattern: /context: any/,
    replacement: 'context: GetServerSidePropsContext',
    context: 'api'
  }
];

const eliminateAnyType = (sourceFile: ts.SourceFile): ts.SourceFile => {
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    return (sourceFile) => {
      const visitor: ts.Visitor = (node) => {
        // Replace : any with proper types
        if (ts.isParameter(node) || ts.isPropertySignature(node)) {
          if (node.type && ts.isAnyKeyword(node.type)) {
            // Determine proper type based on context
            const properType = inferProperType(node);
            return ts.factory.updateParameterDeclaration(
              node as ts.ParameterDeclaration,
              node.decorators,
              node.modifiers,
              node.dotDotDotToken,
              node.name,
              node.questionToken,
              properType,
              node.initializer
            );
          }
        }

        // Remove 'as any' assertions
        if (ts.isAsExpression(node) && ts.isAnyKeyword(node.type)) {
          return node.expression; // Remove assertion entirely
        }

        return ts.visitEachChild(node, visitor, context);
      };
      return ts.visitNode(sourceFile, visitor);
    };
  };

  const result = ts.transform(sourceFile, [transformer]);
  return result.transformed[0];
};

// Type inference engine
const inferProperType = (node: ts.Node): ts.TypeNode => {
  const parent = node.parent;
  const name = (node as any).name?.getText();

  // Context-based inference
  if (name === 'manga') return ts.factory.createTypeReferenceNode('MangaWithRelations');
  if (name === 'library') return ts.factory.createTypeReferenceNode('Library');
  if (name === 'user') return ts.factory.createTypeReferenceNode('User');
  if (name === 'settings') return ts.factory.createTypeReferenceNode('Settings');
  if (name === 'context' && parent?.getText().includes('getServerSideProps')) {
    return ts.factory.createTypeReferenceNode('GetServerSidePropsContext');
  }

  // Default to unknown instead of any
  return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
};
```

### Batch Processing with Rollback
```typescript
// scripts/batch-type-safety.ts
const processInBatches = async () => {
  const files = getAllTypeScriptFiles('src');
  const batchSize = 10;
  let successCount = 0;
  let rollbackCount = 0;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    // Create checkpoint
    await exec('git add -A');
    await exec(`git commit -m "BATCH-CHECKPOINT: Files ${i}-${i+batchSize}"`);

    // Process batch
    for (const file of batch) {
      transformFile(file);
    }

    // Type check
    const typeCheckResult = await exec('npx tsc --noEmit 2>&1');
    const errorCount = (typeCheckResult.match(/error TS/g) || []).length;

    if (errorCount > 0) {
      // Rollback this batch
      await exec('git reset --hard HEAD~1');
      rollbackCount++;
      console.log(`❌ Rolled back batch ${i}-${i+batchSize}: ${errorCount} errors`);

      // Try files individually
      for (const file of batch) {
        await processSingleFile(file);
      }
    } else {
      successCount += batch.length;
      console.log(`✅ Batch ${i}-${i+batchSize} successful`);
    }
  }

  return { successCount, rollbackCount };
};
```

---

## Phase 4: tRPC Pattern Modernization (Day 8)

### Objective
Update all legacy tRPC patterns

### Safety Checkpoint
```bash
git add -A && git commit -m "CHECKPOINT: Before tRPC modernization - $(date +%Y%m%d_%H%M%S)"
git tag -a "checkpoint-trpc-start" -m "Before tRPC modernization"
```

### AST Transformation
```typescript
// scripts/modernize-trpc.ts
const modernizeTRPC = (sourceFile: ts.SourceFile): ts.SourceFile => {
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    return (sourceFile) => {
      const visitor: ts.Visitor = (node) => {
        // Replace isLoading with isPending
        if (ts.isPropertyAssignment(node) &&
            node.name?.getText() === 'isLoading') {
          return ts.factory.updatePropertyAssignment(
            node,
            ts.factory.createIdentifier('isPending'),
            node.initializer
          );
        }

        // Update mutation patterns
        if (ts.isCallExpression(node) &&
            node.expression.getText().includes('.mutate')) {
          // Add proper error handling
          return wrapWithErrorBoundary(node);
        }

        return ts.visitEachChild(node, visitor, context);
      };
      return ts.visitNode(sourceFile, visitor);
    };
  };

  const result = ts.transform(sourceFile, [transformer]);
  return result.transformed[0];
};
```

---

## Phase 5: Import Cleanup & Deduplication (Day 9)

### Objective
Clean up all imports, remove deep paths

### Safety Checkpoint
```bash
git add -A && git commit -m "CHECKPOINT: Before import cleanup - $(date +%Y%m%d_%H%M%S)"
git tag -a "checkpoint-imports-start" -m "Before import cleanup"
```

### AST Import Transformer
```typescript
// scripts/cleanup-imports.ts
const cleanupImports = (sourceFile: ts.SourceFile): ts.SourceFile => {
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    return (sourceFile) => {
      const visitor: ts.Visitor = (node) => {
        if (ts.isImportDeclaration(node)) {
          const moduleSpecifier = node.moduleSpecifier;
          if (ts.isStringLiteral(moduleSpecifier)) {
            const importPath = moduleSpecifier.text;

            // Fix deep relative imports
            if (importPath.includes('../../../')) {
              const absolutePath = resolveAbsolutePath(sourceFile.fileName, importPath);
              const aliasPath = convertToAlias(absolutePath);

              return ts.factory.updateImportDeclaration(
                node,
                node.decorators,
                node.modifiers,
                node.importClause,
                ts.factory.createStringLiteral(aliasPath),
                node.assertClause
              );
            }
          }
        }
        return ts.visitEachChild(node, visitor, context);
      };
      return ts.visitNode(sourceFile, visitor);
    };
  };

  const result = ts.transform(sourceFile, [transformer]);
  return result.transformed[0];
};

const convertToAlias = (absolutePath: string): string => {
  if (absolutePath.includes('/server/')) return '@/server' + absolutePath.split('/server')[1];
  if (absolutePath.includes('/utils/')) return '@/utils' + absolutePath.split('/utils')[1];
  if (absolutePath.includes('/components/')) return '@/components' + absolutePath.split('/components')[1];
  return absolutePath;
};
```

---

## Execution Timeline

### Day 1: Mantine Props
```bash
npm run transform:mantine
npm run test
npm run typecheck
git commit -m "COMPLETE: Mantine v7 migration - 58 props updated"
```

### Day 2: AsyncResult
```bash
npm run consolidate:asyncresult
npm run test:utils
npm run typecheck
git commit -m "COMPLETE: AsyncResult consolidation - 4 duplicates removed"
```

### Days 3-7: Type Safety
```bash
# Run in batches of 100 files per day
npm run eliminate:any -- --batch=1
npm run eliminate:any -- --batch=2
# ... continue
npm run typecheck:strict
git commit -m "COMPLETE: Type safety - 3674 violations fixed"
```

### Day 8: tRPC
```bash
npm run modernize:trpc
npm run test:api
npm run typecheck
git commit -m "COMPLETE: tRPC modernization - all patterns updated"
```

### Day 9: Imports
```bash
npm run cleanup:imports
npm run lint:imports
npm run typecheck
git commit -m "COMPLETE: Import cleanup - all paths optimized"
```

---

## Rollback Procedures

### Complete Phase Rollback
```bash
# If phase fails catastrophically
git reset --hard checkpoint-[phase]-start
git clean -fd
npm install
npm run build
```

### Partial Rollback
```bash
# If specific batch fails
git reset --hard HEAD~1  # Rollback last commit
git cherry-pick --no-commit [good-commits]
```

---

## Success Metrics

### Per Phase Validation
```bash
# Run after each phase
npm run audit:full

# Expected results:
# Phase 1: spacing props = 0
# Phase 2: duplicate functions = 0
# Phase 3: any types < 100
# Phase 4: isLoading instances = 0
# Phase 5: deep imports = 0
```

### Final Validation
```bash
# Complete test suite
npm run test:all
npm run build:production
npm run lighthouse
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "transform:mantine": "ts-node scripts/transform-mantine-props.ts",
    "consolidate:asyncresult": "ts-node scripts/consolidate-asyncresult.ts",
    "eliminate:any": "ts-node scripts/eliminate-any-types.ts",
    "modernize:trpc": "ts-node scripts/modernize-trpc.ts",
    "cleanup:imports": "ts-node scripts/cleanup-imports.ts",
    "typecheck": "tsc --noEmit",
    "typecheck:strict": "tsc --noEmit --strict",
    "audit:full": "ts-node scripts/run-full-audit.ts",
    "rollback:last": "git reset --hard HEAD~1 && npm install"
  }
}
```

---

## Risk Mitigation

1. **Test Coverage**: Maintain 80%+ test coverage
2. **Incremental Commits**: Max 10 files per commit
3. **Type Checks**: After every transformation
4. **Build Validation**: After each phase
5. **Rollback Ready**: Tagged checkpoints for instant recovery

---

## No Compatibility Mode

We are NOT maintaining backward compatibility:
- Remove all deprecated patterns immediately
- Delete legacy code without migration paths
- Force modern patterns everywhere
- Update all dependencies to latest versions
- Remove all polyfills and shims

---

## Monitoring

### Real-time Tracking
```bash
# Terminal 1: Continuous type checking
watch -n 5 'npx tsc --noEmit 2>&1 | grep "error TS" | wc -l'

# Terminal 2: File change monitoring
fswatch -o src | xargs -n1 -I{} npm run typecheck

# Terminal 3: Git status
watch -n 10 'git status --short'
```

---

## Post-Implementation

### Cleanup
```bash
# Remove old migration scripts
rm -rf scripts/migrations/old
rm -rf src/deprecated

# Update documentation
npm run docs:generate

# Create final snapshot
git tag -a "v2.0.0-modernized" -m "Full modernization complete"
```

### Lock Down
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

*Ready to execute. All safety measures in place. No compatibility constraints.*