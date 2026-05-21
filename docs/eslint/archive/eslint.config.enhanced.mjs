/**
 * Enhanced ESLint Configuration for Technical Debt Prevention
 *
 * This configuration enforces strict type safety, code quality, and best practices
 * to prevent the introduction of technical debt.
 *
 * Created: October 2, 2025
 *
 * To use this configuration:
 * 1. Rename to eslint.config.mjs (backup the old one first)
 * 2. Run: pnpm install (to ensure all plugins are installed)
 * 3. Run: pnpm lint to check compliance
 */

import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

export default [
  eslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,js,jsx}'],

    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        },
        project: './tsconfig.json'
      },
      globals: {
        NodeJS: 'readonly',
        React: 'readonly',
        JSX: 'readonly'
      }
    },

    plugins: {
      '@typescript-eslint': tseslint,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      'import': importPlugin
    },

    settings: {
      react: {
        version: 'detect'
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json'
        }
      }
    },

    rules: {
      // =====================================================
      // TYPE SAFETY RULES - Prevent `any` and unsafe types
      // =====================================================

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Enforce explicit return types on functions
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true
      }],

      // Require explicit types for exported functions
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // Prevent usage of `any` type
      '@typescript-eslint/ban-types': ['error', {
        types: {
          'object': {
            message: 'Use Record<string, unknown> or a specific interface instead',
            fixWith: 'Record<string, unknown>'
          },
          '{}': {
            message: 'Use Record<string, unknown> or a specific interface instead',
            fixWith: 'Record<string, unknown>'
          }
        },
        extendDefaults: true
      }],

      // =====================================================
      // LOGGING RULES - Prevent console.log
      // =====================================================

      'no-console': ['error', {
        allow: ['warn', 'error']
      }],

      // =====================================================
      // ERROR HANDLING RULES
      // =====================================================

      // Require error handling in promises
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Require proper error handling
      '@typescript-eslint/no-throw-literal': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'error',

      // Prevent swallowing errors
      'no-empty': ['error', { allowEmptyCatch: false }],

      // =====================================================
      // NULL SAFETY RULES
      // =====================================================

      // Prevent non-null assertions
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Require nullish coalescing
      '@typescript-eslint/prefer-nullish-coalescing': 'error',

      // Prefer optional chaining
      '@typescript-eslint/prefer-optional-chain': 'error',

      // Prevent unsafe optional chaining
      '@typescript-eslint/no-unnecessary-condition': ['error', {
        allowConstantLoopConditions: true
      }],

      // =====================================================
      // IMPORT RULES - Enforce path aliases
      // =====================================================

      // Prevent deep relative imports
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../**/..', '../../../*', '../../../../*', '../../../../../*'],
            message: 'Use path aliases (@/) instead of deep relative imports'
          }
        ]
      }],

      // Enforce import order
      'import/order': ['error', {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'type'
        ],
        pathGroups: [
          {
            pattern: 'react',
            group: 'external',
            position: 'before'
          },
          {
            pattern: '@/**',
            group: 'internal',
            position: 'before'
          }
        ],
        pathGroupsExcludedImportTypes: ['react'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        }
      }],

      // Prevent circular dependencies
      'import/no-cycle': 'error',

      // Prevent unused imports
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],

      // =====================================================
      // REACT RULES
      // =====================================================

      // Enforce hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Prevent missing key prop
      'react/jsx-key': ['error', {
        checkFragmentShorthand: true
      }],

      // Require proper prop types
      'react/prop-types': 'off', // Using TypeScript instead

      // Prevent unused state
      'react/no-unused-state': 'error',

      // Prevent direct state mutation
      'react/no-direct-mutation-state': 'error',

      // =====================================================
      // CODE QUALITY RULES
      // =====================================================

      // Prevent var usage
      'no-var': 'error',

      // Require const for variables that are never reassigned
      'prefer-const': 'error',

      // Prevent parameter reassignment
      'no-param-reassign': ['error', {
        props: true,
        ignorePropertyModificationsFor: ['draft'] // For Immer
      }],

      // Require === instead of ==
      'eqeqeq': ['error', 'always'],

      // Prevent eval and related
      'no-eval': 'error',
      'no-implied-eval': 'error',

      // Require default case in switch
      'default-case': 'error',

      // Prevent fall-through in switch
      'no-fallthrough': 'error',

      // Prevent unused expressions
      'no-unused-expressions': ['error', {
        allowShortCircuit: true,
        allowTernary: true
      }],

      // Prevent unnecessary bind
      'no-extra-bind': 'error',

      // Prevent return await (should use return directly)
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],

      // =====================================================
      // NAMING CONVENTIONS
      // =====================================================

      '@typescript-eslint/naming-convention': ['error',
        // Enforce camelCase for variables
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow'
        },
        // Enforce PascalCase for types
        {
          selector: 'typeLike',
          format: ['PascalCase']
        },
        // Enforce camelCase for functions
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase']
        },
        // Enforce UPPER_CASE for enum members
        {
          selector: 'enumMember',
          format: ['UPPER_CASE']
        }
      ],

      // =====================================================
      // COMPLEXITY RULES - Prevent overly complex code
      // =====================================================

      // Max cyclomatic complexity
      'complexity': ['warn', 20],

      // Max depth of nested blocks
      'max-depth': ['warn', 4],

      // Max number of statements per function
      'max-statements': ['warn', 50],

      // Max lines per function
      'max-lines-per-function': ['warn', {
        max: 150,
        skipBlankLines: true,
        skipComments: true
      }],

      // Max number of parameters
      'max-params': ['warn', 5],

      // =====================================================
      // FILE SIZE LIMITS
      // =====================================================

      'max-lines': ['error', {
        max: 1000,
        skipBlankLines: true,
        skipComments: true
      }],

      // =====================================================
      // ASYNC/AWAIT RULES
      // =====================================================

      // Require await in async functions
      '@typescript-eslint/require-await': 'error',

      // Prevent async functions with no await
      '@typescript-eslint/no-unnecessary-async': 'error',

      // Prevent mixing promises and callbacks
      'no-promise-executor-return': 'error',

      // =====================================================
      // PERFORMANCE RULES
      // =====================================================

      // Prevent array mutation methods in loops
      'no-await-in-loop': 'warn',

      // Prevent unnecessary constructor
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-constructor': 'error',

      // =====================================================
      // SECURITY RULES
      // =====================================================

      // Prevent dangerous regexes
      'no-unsafe-regex': 'error',

      // Prevent potential XSS
      'react/no-danger': 'warn',

      // Prevent eval-like patterns
      'no-new-func': 'error',

      // =====================================================
      // DOCUMENTATION RULES
      // =====================================================

      // Require JSDoc for exports (warning, not error for gradual adoption)
      'require-jsdoc': ['warn', {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: false,
          FunctionExpression: false
        }
      }]
    }
  },

  // =====================================================
  // SPECIFIC FILE PATTERNS
  // =====================================================

  {
    // Stricter rules for router files
    files: ['**/server/trpc/routers/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 800 }],
      'max-lines-per-function': ['error', { max: 100 }]
    }
  },

  {
    // Stricter rules for service files
    files: ['**/server/services/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 1000 }],
      '@typescript-eslint/explicit-function-return-type': 'error'
    }
  },

  {
    // Stricter rules for component files
    files: ['**/components/**/*.{tsx,jsx}'],
    rules: {
      'max-lines': ['error', { max: 500 }],
      'react-hooks/exhaustive-deps': 'error' // Stricter for components
    }
  },

  {
    // Relaxed rules for test files
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off' // Allow in tests
    }
  },

  {
    // Relaxed rules for migration files
    files: ['**/migrations/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off'
    }
  },

  // =====================================================
  // IGNORED FILES
  // =====================================================

  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '*.config.js',
      '*.config.mjs',
      'prisma/generated/**'
    ]
  }
];
