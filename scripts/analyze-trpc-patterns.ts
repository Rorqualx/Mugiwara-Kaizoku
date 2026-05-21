#!/usr/bin/env tsx

/**
 * Script to analyze tRPC implementation patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

async function analyzeTRPCPatterns() {
  console.log('\n🔍 Analyzing tRPC Implementation Patterns\n');
  console.log('='.repeat(60));

  const analysis = {
    version: '',
    modernPatterns: {
      v11Features: 0,
      typedProcedures: 0,
      zodSchemas: 0,
      trpcErrors: 0,
      middleware: 0,
      superjson: 0,
    },
    legacyPatterns: {
      untypedProcedures: 0,
      noInputValidation: 0,
      plainErrors: 0,
      legacyHooks: 0,
    },
    routers: {
      total: 0,
      withTypedProcedures: 0,
      withMiddleware: 0,
    },
    procedures: {
      total: 0,
      queries: 0,
      mutations: 0,
      subscriptions: 0,
      withInput: 0,
      withOutput: 0,
    },
    clientUsage: {
      useQuery: 0,
      useMutation: 0,
      useSubscription: 0,
      useInfiniteQuery: 0,
    },
  };

  // Check package.json for version
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  analysis.version = packageJson.dependencies['@trpc/server'] || '';
  console.log(`📦 tRPC Version: ${analysis.version}`);

  // Analyze server-side patterns
  const serverFiles = await glob('server/trpc/**/*.ts', { cwd: SRC_DIR });
  const routerFiles = await glob('server/trpc/routers/*.ts', { cwd: SRC_DIR });
  
  analysis.routers.total = routerFiles.length;

  for (const file of serverFiles) {
    const filePath = path.join(SRC_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Modern patterns
    if (content.includes('protectedProcedure') || content.includes('publicProcedure') || content.includes('adminProcedure')) {
      analysis.modernPatterns.typedProcedures++;
      if (file.includes('/routers/')) {
        analysis.routers.withTypedProcedures++;
      }
    }

    if (content.includes('z.object') || content.includes('z.string') || content.includes('z.number')) {
      analysis.modernPatterns.zodSchemas++;
    }

    if (content.includes('TRPCError')) {
      analysis.modernPatterns.trpcErrors++;
    }

    if (content.includes('.use(') || content.includes('middleware')) {
      analysis.modernPatterns.middleware++;
      if (file.includes('/routers/')) {
        analysis.routers.withMiddleware++;
      }
    }

    if (content.includes('superjson')) {
      analysis.modernPatterns.superjson++;
    }

    // Legacy patterns
    const procedureMatches = content.match(/procedure\s*\./g) || [];
    const typedProcedureMatches = content.match(/(protected|public|admin)Procedure/g) || [];
    if (procedureMatches.length > typedProcedureMatches.length) {
      analysis.legacyPatterns.untypedProcedures += procedureMatches.length - typedProcedureMatches.length;
    }

    // Check for procedures without input validation
    const procedureBlocks = content.match(/procedure\s*\.\s*(query|mutation)\s*\(/g) || [];
    const inputBlocks = content.match(/\.input\s*\(/g) || [];
    if (procedureBlocks.length > inputBlocks.length) {
      analysis.legacyPatterns.noInputValidation += procedureBlocks.length - inputBlocks.length;
    }

    // Count procedure types
    const queries = content.match(/\.query\s*\(/g) || [];
    const mutations = content.match(/\.mutation\s*\(/g) || [];
    const subscriptions = content.match(/\.subscription\s*\(/g) || [];
    
    analysis.procedures.queries += queries.length;
    analysis.procedures.mutations += mutations.length;
    analysis.procedures.subscriptions += subscriptions.length;
    analysis.procedures.total += queries.length + mutations.length + subscriptions.length;
    
    const withInput = content.match(/\.input\s*\(/g) || [];
    const withOutput = content.match(/\.output\s*\(/g) || [];
    analysis.procedures.withInput += withInput.length;
    analysis.procedures.withOutput += withOutput.length;

    // Check for plain Error throws instead of TRPCError
    const throwErrors = content.match(/throw\s+new\s+Error/g) || [];
    analysis.legacyPatterns.plainErrors += throwErrors.length;
  }

  // Analyze client-side patterns
  const clientFiles = await glob('**/*.{ts,tsx}', { 
    cwd: SRC_DIR,
    ignore: ['**/node_modules/**', 'server/**']
  });

  for (const file of clientFiles) {
    const filePath = path.join(SRC_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Client usage patterns
    const useQueryMatches = content.match(/\.useQuery\s*\(/g) || [];
    const useMutationMatches = content.match(/\.useMutation\s*\(/g) || [];
    const useSubscriptionMatches = content.match(/\.useSubscription\s*\(/g) || [];
    const useInfiniteQueryMatches = content.match(/\.useInfiniteQuery\s*\(/g) || [];

    analysis.clientUsage.useQuery += useQueryMatches.length;
    analysis.clientUsage.useMutation += useMutationMatches.length;
    analysis.clientUsage.useSubscription += useSubscriptionMatches.length;
    analysis.clientUsage.useInfiniteQuery += useInfiniteQueryMatches.length;

    // Check for legacy patterns
    if (content.includes('createReactQueryHooks') || content.includes('createTRPCClient')) {
      analysis.legacyPatterns.legacyHooks++;
    }
  }

  // Print analysis report
  console.log('\n📊 Modern Patterns (tRPC v10+):');
  console.log(`   ✅ Typed procedures: ${analysis.modernPatterns.typedProcedures} files`);
  console.log(`   ✅ Zod validation: ${analysis.modernPatterns.zodSchemas} files`);
  console.log(`   ✅ TRPCError usage: ${analysis.modernPatterns.trpcErrors} files`);
  console.log(`   ✅ Middleware: ${analysis.modernPatterns.middleware} files`);
  console.log(`   ✅ SuperJSON: ${analysis.modernPatterns.superjson} files`);

  console.log('\n⚠️  Legacy Patterns:');
  console.log(`   ❌ Untyped procedures: ${analysis.legacyPatterns.untypedProcedures} instances`);
  console.log(`   ❌ No input validation: ${analysis.legacyPatterns.noInputValidation} procedures`);
  console.log(`   ❌ Plain Error throws: ${analysis.legacyPatterns.plainErrors} instances`);
  console.log(`   ❌ Legacy hooks/client: ${analysis.legacyPatterns.legacyHooks} files`);

  console.log('\n📁 Router Statistics:');
  console.log(`   Total routers: ${analysis.routers.total}`);
  console.log(`   With typed procedures: ${analysis.routers.withTypedProcedures}`);
  console.log(`   With middleware: ${analysis.routers.withMiddleware}`);

  console.log('\n🔧 Procedure Statistics:');
  console.log(`   Total procedures: ${analysis.procedures.total}`);
  console.log(`   - Queries: ${analysis.procedures.queries}`);
  console.log(`   - Mutations: ${analysis.procedures.mutations}`);
  console.log(`   - Subscriptions: ${analysis.procedures.subscriptions}`);
  console.log(`   With input validation: ${analysis.procedures.withInput}`);
  console.log(`   With output validation: ${analysis.procedures.withOutput}`);

  console.log('\n📱 Client Usage:');
  console.log(`   useQuery calls: ${analysis.clientUsage.useQuery}`);
  console.log(`   useMutation calls: ${analysis.clientUsage.useMutation}`);
  console.log(`   useSubscription calls: ${analysis.clientUsage.useSubscription}`);
  console.log(`   useInfiniteQuery calls: ${analysis.clientUsage.useInfiniteQuery}`);

  // Calculate implementation score
  const modernScore = 
    (analysis.modernPatterns.typedProcedures * 2) +
    (analysis.modernPatterns.zodSchemas * 2) +
    (analysis.modernPatterns.trpcErrors * 1) +
    (analysis.modernPatterns.middleware * 1) +
    (analysis.modernPatterns.superjson * 1);

  const legacyScore = 
    (analysis.legacyPatterns.untypedProcedures * -2) +
    (analysis.legacyPatterns.noInputValidation * -2) +
    (analysis.legacyPatterns.plainErrors * -1) +
    (analysis.legacyPatterns.legacyHooks * -3);

  const totalScore = Math.max(0, modernScore + legacyScore);
  const maxScore = analysis.routers.total * 7; // Max possible score
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  console.log('\n' + '='.repeat(60));
  console.log(`\n🎯 tRPC Implementation Score: ${percentage}%`);
  
  if (percentage >= 80) {
    console.log('   ✅ Excellent! Phase 4 appears to be mostly complete.');
  } else if (percentage >= 60) {
    console.log('   🔶 Good progress! Some modernization opportunities remain.');
  } else if (percentage >= 40) {
    console.log('   ⚠️  Partial implementation. Phase 4 needs more work.');
  } else {
    console.log('   ❌ Phase 4 has not been fully implemented yet.');
  }

  console.log('\n📋 Recommendations:');
  if (analysis.legacyPatterns.untypedProcedures > 0) {
    console.log('   • Convert untyped procedures to typed (public/protected/admin)');
  }
  if (analysis.legacyPatterns.noInputValidation > 0) {
    console.log('   • Add Zod input validation to all procedures');
  }
  if (analysis.legacyPatterns.plainErrors > 0) {
    console.log('   • Replace Error throws with TRPCError');
  }
  if (analysis.procedures.withOutput < analysis.procedures.total / 2) {
    console.log('   • Add output validation schemas for type safety');
  }
  if (analysis.routers.withMiddleware < analysis.routers.total / 2) {
    console.log('   • Implement authentication/logging middleware');
  }

  console.log('\n');
}

analyzeTRPCPatterns().catch(console.error);