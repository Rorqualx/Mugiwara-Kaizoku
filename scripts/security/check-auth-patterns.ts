/**
 * Authentication/Authorization pattern checking module
 * Ensures tRPC procedures have proper auth and authorization checks
 */

import * as fs from 'fs';
import type { CheckResult, SecurityViolation, AuthPattern } from './types';
import {
  getStagedFiles,
  getStagedFileContent,
  shouldExcludeFile,
  isTypeScriptFile,
  createTimer,
  getLineFromContent,
} from './utils';
import { EXCLUDE_PATTERNS, DEFAULT_CONFIG } from './config';

/**
 * Extract tRPC procedure definitions from file
 */
function extractTRPCProcedures(
  filePath: string,
  content: string
): AuthPattern[] {
  const procedures: AuthPattern[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match: export const procedureName = publicProcedure|protectedProcedure|adminProcedure
    const procedureMatch = line?.match(
      /export\s+const\s+(\w+)\s*=\s*(publicProcedure|protectedProcedure|adminProcedure)/
    );

    if (procedureMatch) {
      const [, name, procedureType] = procedureMatch;

      // Determine procedure type (query or mutation)
      let type: 'query' | 'mutation' | 'procedure' = 'procedure';
      let hasInputValidation = false;
      let hasAuthorizationCheck = false;

      // Look ahead to find .query() or .mutation()
      for (let j = i; j < Math.min(i + 50, lines.length); j++) {
        const nextLine = lines[j];

        if (nextLine?.includes('.query(')) {
          type = 'query';
        } else if (nextLine?.includes('.mutation(')) {
          type = 'mutation';
        }

        // Check for .input() (Zod validation)
        if (nextLine?.includes('.input(')) {
          hasInputValidation = true;
        }

        // Check for authorization patterns
        if (
          nextLine?.match(
            /if\s*\([^)]*(?:userId|authorId|ownerId)[^)]*!==|role\s*===\s*['"]ADMIN['"]/
          )
        ) {
          hasAuthorizationCheck = true;
        }

        // Stop when we hit another procedure
        if (j > i && nextLine?.match(/export\s+const\s+\w+\s*=\s*\w+Procedure/)) {
          break;
        }
      }

      procedures.push({
        type,
        name: name ?? 'unknown',
        procedureType:
          procedureType === 'publicProcedure'
            ? 'public'
            : procedureType === 'protectedProcedure'
              ? 'protected'
              : procedureType === 'adminProcedure'
                ? 'admin'
                : 'unknown',
        hasInputValidation,
        hasAuthorizationCheck,
        file: filePath,
        line: i + 1,
      });
    }
  }

  return procedures;
}

/**
 * Check for raw SQL queries (Prisma $queryRaw, $executeRaw)
 */
function checkForRawSQL(
  filePath: string,
  content: string
): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match $queryRaw or $executeRaw
    if (line?.match(/\$(?:queryRaw|executeRaw)`/)) {
      // Check if there's any variable interpolation (dangerous)
      if (line.includes('${')) {
        violations.push({
          category: 'sql-injection',
          severity: 'critical',
          message: 'Raw SQL query with string interpolation detected (SQL injection risk)',
          file: filePath,
          line: i + 1,
          code: line.trim(),
          suggestion:
            'Use Prisma parameterized queries or use sql tagged template with proper escaping',
          pattern: 'Raw SQL with interpolation',
        });
      } else {
        violations.push({
          category: 'sql-injection',
          severity: 'medium',
          message: 'Raw SQL query detected',
          file: filePath,
          line: i + 1,
          code: line.trim(),
          suggestion:
            'Consider using Prisma ORM methods instead of raw SQL for better type safety',
          pattern: 'Raw SQL',
        });
      }
    }
  }

  return violations;
}

/**
 * Validate auth patterns in a procedure
 */
function validateProcedure(procedure: AuthPattern): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  const allowlist = DEFAULT_CONFIG.auth.allowlistedPublicMutations;

  // Rule 1: Mutations should not use publicProcedure (unless allowlisted)
  if (
    procedure.type === 'mutation' &&
    procedure.procedureType === 'public' &&
    !allowlist.includes(procedure.name)
  ) {
    violations.push({
      category: 'authentication',
      severity: 'critical',
      message: `Mutation "${procedure.name}" uses publicProcedure (unauthenticated)`,
      file: procedure.file,
      line: procedure.line,
      pattern: 'Unauthenticated Mutation',
      suggestion:
        'Use protectedProcedure for authenticated mutations, or adminProcedure for admin-only mutations',
      code: `export const ${procedure.name} = publicProcedure.mutation(...)`,
    });
  }

  // Rule 2: Protected procedures should have input validation
  if (
    !procedure.hasInputValidation &&
    procedure.procedureType !== 'public' &&
    (procedure.type === 'mutation' || procedure.type === 'query')
  ) {
    violations.push({
      category: 'input-validation',
      severity: 'high',
      message: `Procedure "${procedure.name}" is missing input validation (.input() with Zod schema)`,
      file: procedure.file,
      line: procedure.line,
      pattern: 'Missing Input Validation',
      suggestion: 'Add .input(z.object({...})) to validate input parameters',
      code: `export const ${procedure.name} = ${procedure.procedureType}Procedure.${procedure.type}(...)`,
    });
  }

  // Rule 3: Protected mutations should have authorization checks (for resource modifications)
  if (
    procedure.type === 'mutation' &&
    procedure.procedureType === 'protected' &&
    !procedure.hasAuthorizationCheck
  ) {
    violations.push({
      category: 'authorization',
      severity: 'high',
      message: `Mutation "${procedure.name}" may be missing authorization check (ownership verification)`,
      file: procedure.file,
      line: procedure.line,
      pattern: 'Missing Authorization Check',
      suggestion:
        'Add ownership check: if (resource.userId !== ctx.session.user.id) { throw new TRPCError({ code: "FORBIDDEN" }) }',
      code: `export const ${procedure.name} = protectedProcedure.mutation(...)`,
    });
  }

  return violations;
}

/**
 * Main auth pattern checking function
 */
export async function checkAuthPatterns(): Promise<CheckResult> {
  const timer = createTimer();

  try {
    const stagedFiles = getStagedFiles();
    const violations: SecurityViolation[] = [];

    // Filter to TypeScript files in server/routers directory
    const filesToCheck = stagedFiles.filter(
      (file) =>
        isTypeScriptFile(file) &&
        (file.includes('server/routers') || file.includes('server/api')) &&
        !shouldExcludeFile(file, EXCLUDE_PATTERNS.auth)
    );

    if (filesToCheck.length === 0) {
      return {
        checkName: 'Auth Pattern Validation',
        status: 'pass',
        violations: [],
        duration: timer.stop(),
      };
    }

    // Check each file
    for (const file of filesToCheck) {
      try {
        const content = getStagedFileContent(file);

        // Extract tRPC procedures
        const procedures = extractTRPCProcedures(file, content);

        // Validate each procedure
        for (const procedure of procedures) {
          const procedureViolations = validateProcedure(procedure);
          violations.push(...procedureViolations);
        }

        // Check for raw SQL
        const sqlViolations = checkForRawSQL(file, content);
        violations.push(...sqlViolations);
      } catch (error) {
        // File might have been deleted, skip it
        continue;
      }
    }

    // Determine status
    const hasCritical = violations.some(
      (v) => v.severity === 'critical' || v.severity === 'high'
    );
    const status =
      violations.length === 0 ? 'pass' : hasCritical ? 'fail' : 'warning';

    return {
      checkName: 'Auth Pattern Validation',
      status,
      violations,
      duration: timer.stop(),
    };
  } catch (error) {
    return {
      checkName: 'Auth Pattern Validation',
      status: 'fail',
      violations: [
        {
          category: 'authentication',
          severity: 'high',
          message: `Auth pattern validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          file: '',
        },
      ],
      duration: timer.stop(),
    };
  }
}

/**
 * CLI entry point (for standalone execution)
 */
if (require.main === module) {
  (async () => {
    const result = await checkAuthPatterns();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'fail' ? 1 : 0);
  })();
}
