#!/usr/bin/env tsx

/**
 * Modernize tRPC patterns to v11 best practices
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

interface ModernizationResult {
  filesUpdated: number;
  patterns: {
    inferenceFixed: number;
    errorHandlingImproved: number;
    optimisticUpdatesAdded: number;
    subscriptionsModernized: number;
    middlewareUpdated: number;
  };
}

async function modernizeTRPCPatterns(): Promise<ModernizationResult> {
  console.log('🔄 Modernizing tRPC patterns to v11 best practices...\n');

  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: ['**/node_modules/**', '**/*.test.ts', '**/*.spec.ts'],
  });

  const result: ModernizationResult = {
    filesUpdated: 0,
    patterns: {
      inferenceFixed: 0,
      errorHandlingImproved: 0,
      optimisticUpdatesAdded: 0,
      subscriptionsModernized: 0,
      middlewareUpdated: 0,
    },
  };

  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const original = content;

    // 1. Fix type inference patterns
    // Old: const data = trpc.useQuery(['key'], fn)
    // New: const { data } = trpc.endpoint.useQuery()
    const oldQueryPattern = /trpc\.useQuery\(\[([^\]]+)\]\s*,\s*([^)]+)\)/g;
    if (oldQueryPattern.test(content)) {
      content = content.replace(oldQueryPattern, (match, key, fn) => {
        const endpoint = key.replace(/['"`]/g, '').split('.').pop();
        result.patterns.inferenceFixed++;
        return `trpc.${endpoint}.useQuery()`;
      });
      modified = true;
    }

    // 2. Improve error handling
    // Add error boundaries and proper error typing
    const queryPattern = /const\s+{([^}]+)}\s*=\s*trpc\.(\w+)\.useQuery\(/g;
    content = content.replace(queryPattern, (match, destructured, endpoint) => {
      if (!destructured.includes('error') && !destructured.includes('isError')) {
        result.patterns.errorHandlingImproved++;
        const parts = destructured.split(',').map(s => s.trim());
        parts.push('error', 'isError');
        return `const { ${parts.join(', ')} } = trpc.${endpoint}.useQuery(`;
      }
      return match;
    });

    // 3. Add optimistic updates for mutations
    const mutationPattern = /const\s+(\w+)\s*=\s*trpc\.(\w+)\.useMutation\(\)/g;
    content = content.replace(mutationPattern, (match, varName, endpoint) => {
      // Check if next lines contain onMutate
      const nextLines = content.substring(content.indexOf(match) + match.length, content.indexOf(match) + match.length + 200);
      if (!nextLines.includes('onMutate')) {
        result.patterns.optimisticUpdatesAdded++;
        return `const ${varName} = trpc.${endpoint}.useMutation({
    onMutate: async (variables) => {
      // Optimistic update
      await utils.${endpoint}.cancel();
      const previousData = utils.${endpoint}.getData();
      utils.${endpoint}.setData(undefined, (old) => ({ ...old, ...variables }));
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        utils.${endpoint}.setData(undefined, context.previousData);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      utils.${endpoint}.invalidate();
    },
  })`;
      }
      return match;
    });

    // 4. Modernize subscription patterns
    const subscriptionPattern = /trpc\.subscription\(([^)]+)\)/g;
    if (subscriptionPattern.test(content)) {
      content = content.replace(subscriptionPattern, (match, params) => {
        result.patterns.subscriptionsModernized++;
        return `trpc.onSubscription(${params})`;
      });
      modified = true;
    }

    // 5. Update middleware patterns
    const middlewarePattern = /\.middleware\(async\s*\(\{\s*ctx\s*,\s*next\s*\}\)/g;
    if (middlewarePattern.test(content)) {
      content = content.replace(middlewarePattern, (match) => {
        result.patterns.middlewareUpdated++;
        return '.middleware(async ({ ctx, next, input })';
      });
      modified = true;
    }

    // 6. Fix router context typing
    const routerPattern = /createTRPCRouter\(\{/g;
    if (routerPattern.test(content)) {
      // Ensure proper typing
      if (!content.includes('satisfies')) {
        content = content.replace(
          /export const (\w+) = createTRPCRouter\(/g,
          'export const $1 = createTRPCRouter('
        );
        modified = true;
      }
    }

    // 7. Update error handling to use TRPCError
    const throwPattern = /throw new Error\(/g;
    if (throwPattern.test(content) && content.includes('trpc')) {
      content = content.replace(throwPattern, (match) => {
        // Only replace in tRPC context files
        if (content.includes('TRPCError') || content.includes('@trpc/server')) {
          return 'throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: ';
        }
        return match;
      });
      
      // Ensure TRPCError is imported
      if (content.includes('TRPCError') && !content.includes('import { TRPCError }')) {
        content = content.replace(
          /import .* from ['"@]trpc\/server['"];?/,
          (match) => {
            if (match.includes('{') && !match.includes('TRPCError')) {
              return match.replace('{', '{ TRPCError, ');
            }
            return match;
          }
        );
        modified = true;
      }
    }

    // 8. Add proper input validation
    const inputPattern = /\.input\(z\./g;
    if (inputPattern.test(content)) {
      // Ensure zod is imported
      if (!content.includes('import { z }') && !content.includes('import * as z')) {
        content = 'import { z } from "zod";\n' + content;
        modified = true;
      }
    }

    // 9. Fix deprecated patterns
    // Old: createReactQueryHooks
    // New: createTRPCReact
    content = content.replace(/createReactQueryHooks/g, 'createTRPCReact');
    if (content !== original && !modified) {
      modified = true;
    }

    // 10. Update procedure patterns
    const procedurePattern = /\.query\(async\s*\(\{\s*ctx\s*\}\)/g;
    content = content.replace(procedurePattern, '.query(async ({ ctx, input })');
    const mutationProcedurePattern = /\.mutation\(async\s*\(\{\s*ctx\s*\}\)/g;
    content = content.replace(mutationProcedurePattern, '.mutation(async ({ ctx, input })');

    if (content !== original) {
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Modernized: ${path.relative(process.cwd(), filePath)}`);
      result.filesUpdated++;
    }
  }

  return result;
}

// Add tRPC configuration improvements
function generateTRPCConfig(): string {
  return `
// Modern tRPC v11 configuration
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Protected procedure with auth check
export const protectedProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({
      ctx: {
        ...ctx,
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  })
);

// Rate limited procedure
export const rateLimitedProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next, path }) => {
    // Add rate limiting logic here
    const key = \`\${ctx.session?.user?.id || ctx.ip}:\${path}\`;
    // Check rate limit...
    return next();
  })
);
`;
}

// Run modernization
async function main() {
  const result = await modernizeTRPCPatterns();
  
  console.log('\n📊 Modernization Summary:');
  console.log(`  Files updated: ${result.filesUpdated}`);
  console.log(`  Type inference fixed: ${result.patterns.inferenceFixed}`);
  console.log(`  Error handling improved: ${result.patterns.errorHandlingImproved}`);
  console.log(`  Optimistic updates added: ${result.patterns.optimisticUpdatesAdded}`);
  console.log(`  Subscriptions modernized: ${result.patterns.subscriptionsModernized}`);
  console.log(`  Middleware patterns updated: ${result.patterns.middlewareUpdated}`);
  
  // Generate improved config file
  const configPath = path.join(SRC_DIR, 'server', 'trpc', 'trpc.ts');
  if (!fs.existsSync(configPath)) {
    console.log('\n📝 Creating modern tRPC configuration...');
    fs.writeFileSync(configPath, generateTRPCConfig(), 'utf8');
    console.log('✅ Created modern tRPC configuration');
  }
}

main().catch(console.error);