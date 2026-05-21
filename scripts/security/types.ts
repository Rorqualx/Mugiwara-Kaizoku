/**
 * Shared TypeScript types for security validation modules
 */

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type CheckStatus = 'pass' | 'fail' | 'warning' | 'skipped';

export type ViolationCategory =
  | 'secrets'
  | 'dependencies'
  | 'authentication'
  | 'authorization'
  | 'architectural-drift'
  | 'race-conditions'
  | 'business-logic'
  | 'input-validation'
  | 'crypto'
  | 'xss'
  | 'sql-injection';

export interface SecurityViolation {
  category: ViolationCategory;
  severity: SeverityLevel;
  message: string;
  file: string;
  line?: number;
  column?: number;
  pattern?: string;
  suggestion?: string;
  code?: string; // The actual code snippet
  cwe?: string; // CWE identifier
  owasp?: string; // OWASP category
}

export interface CheckResult {
  checkName: string;
  status: CheckStatus;
  violations: SecurityViolation[];
  duration: number; // milliseconds
  skipped?: boolean;
  skipReason?: string;
}

export interface SecurityReport {
  timestamp: Date;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  skippedChecks: number;
  totalViolations: number;
  blockingViolations: number; // critical/high severity
  warningViolations: number; // medium/low severity
  results: CheckResult[];
  duration: number; // total milliseconds
  shouldBlock: boolean; // true if commit should be blocked
}

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  entropy?: number; // minimum entropy threshold
  severity: SeverityLevel;
  description: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  exists: boolean;
  created?: Date;
  downloads?: number;
  repository?: string;
  suspicious: boolean;
  reasons: string[];
  hallucinated: boolean;
}

export interface CVEInfo {
  id: string;
  severity: SeverityLevel;
  package: string;
  vulnerable_versions: string;
  patched_versions?: string;
  title: string;
  url: string;
}

export interface AuthPattern {
  type: 'procedure' | 'query' | 'mutation';
  name: string;
  procedureType: 'public' | 'protected' | 'admin' | 'unknown';
  hasInputValidation: boolean;
  hasAuthorizationCheck: boolean;
  file: string;
  line: number;
}

export interface ArchitecturalDriftIssue {
  pattern: string;
  file: string;
  line: number;
  severity: SeverityLevel;
  description: string;
  replacement?: string;
}

export interface RaceConditionIssue {
  type: 'toctou' | 'missing-transaction' | 'missing-lock';
  file: string;
  line: number;
  description: string;
  suggestion: string;
}

export interface BusinessLogicIssue {
  type:
    | 'missing-pagination'
    | 'missing-rate-limit'
    | 'unbounded-loop'
    | 'missing-validation'
    | 'state-transition';
  file: string;
  line: number;
  description: string;
  suggestion: string;
}

export interface SecurityConfig {
  secrets: {
    enabled: boolean;
    excludePaths: string[];
    customPatterns?: SecretPattern[];
  };
  dependencies: {
    enabled: boolean;
    verifyAll: boolean; // true = all deps, false = only new
    blockOnCritical: boolean;
    blockOnHigh: boolean;
  };
  auth: {
    enabled: boolean;
    requireProtectedForMutations: boolean;
    requireOwnershipChecks: boolean;
    allowlistedPublicMutations: string[]; // e.g., ['login', 'register']
  };
  architecturalDrift: {
    enabled: boolean;
    forbiddenPatterns: string[];
    requiredPatterns: string[];
  };
  raceConditions: {
    enabled: boolean;
    warnOnly: boolean;
  };
  businessLogic: {
    enabled: boolean;
    warnOnly: boolean;
  };
  performance: {
    timeout: number; // milliseconds
    parallelChecks: boolean;
  };
}

export interface CLIOptions {
  skipSecrets?: boolean;
  skipDeps?: boolean;
  skipAuth?: boolean;
  skipDrift?: boolean;
  skipRace?: boolean;
  skipLogic?: boolean;
  reportOnly?: boolean; // run checks but don't block
  verbose?: boolean;
  json?: boolean; // output as JSON
  output?: string; // output file path
}
