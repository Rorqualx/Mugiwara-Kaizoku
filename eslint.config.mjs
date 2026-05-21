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
  // Ignore patterns (migrated from .eslintignore)
  {
    ignores: [
      'next-env.d.ts',
      'src/types/mantine.d.ts',
      'src/types/common.d.ts',
      'src/types/jest-matchers.d.ts',
      'dist/',
      'src/server/services/fandom/service.ts',
      '**/.!*', // Ignore macOS/system temporary files
      'healthcheck.js',
      'Dockerfile.bun',
      'bunfig.toml',
      '.next/',
      'node_modules/',
      'build/',
      'coverage/',
      'scripts/', // Utility scripts don't need strict linting
      'tests/**/*.ts', // Test files use separate tsconfig with vitest types
      'tests/**/*.tsx'
    ]
  },

  eslint.configs.recommended,

  // =====================================================
  // TYPESCRIPT FILES (.ts, .tsx) - Full type-aware linting
  // =====================================================
  {
    files: ['**/*.{ts,tsx}'],

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
        JSX: 'readonly',
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        prompt: 'readonly',
        Audio: 'readonly',
        MediaMetadata: 'readonly'
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

      // Note: @typescript-eslint/ban-types was removed in v8
      // Use TypeScript's noImplicitAny and strict mode instead

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
      // Note: @typescript-eslint/no-throw-literal was deprecated in v6+ (renamed to @typescript-eslint/only-throw-error)
      '@typescript-eslint/prefer-promise-reject-errors': 'error',

      // Prevent swallowing errors
      'no-empty': ['error', { allowEmptyCatch: false }],

      // =====================================================
      // NULL SAFETY RULES
      // =====================================================

      // Prevent non-null assertions
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Require nullish coalescing
      '@typescript-eslint/prefer-nullish-coalescing': ['error', {
        ignorePrimitives: {
          boolean: true,  // Don't flag boolean OR logic (a || b)
          string: true,   // Don't flag string comparisons
          number: true    // Don't flag number comparisons
        }
      }],

      // Prefer optional chaining
      '@typescript-eslint/prefer-optional-chain': 'error',

      // Prevent unsafe optional chaining
      '@typescript-eslint/no-unnecessary-condition': ['error', {
        allowConstantLoopConditions: true
      }],

      // =====================================================
      // IMPORT RULES - Enforce path aliases
      // =====================================================

      // Prevent deep relative imports.
      //
      // NOTE: New code should import { notify } from '@/utils/notify' rather
      // than @mantine/notifications directly — the unified helper also persists
      // to the bell dropdown. A no-restricted-syntax rule enforcing this can be
      // re-added once the remaining ~80 legacy importers (loading toasts,
      // sticky-progress, etc.) are migrated.
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
      // Disable base rule in favor of TypeScript version
      'no-unused-vars': 'off',
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
        ignorePropertyModificationsFor: ['draft', 'state'] // For Immer (draft) and Zustand (state)
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
        max: 300,
        skipBlankLines: true,
        skipComments: true
      }],

      // Max number of parameters
      'max-params': ['warn', 5],

      // =====================================================
      // FILE SIZE LIMITS
      // =====================================================

      'max-lines': ['error', {
        max: 10000,
        skipBlankLines: true,
        skipComments: true
      }],

      // =====================================================
      // ASYNC/AWAIT RULES
      // =====================================================

      // Require await in async functions
      '@typescript-eslint/require-await': 'error',

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

      // Prevent potential XSS
      'react/no-danger': 'warn',

      // Prevent eval-like patterns
      'no-new-func': 'error',

      // =====================================================
      // DOCUMENTATION RULES
      // =====================================================

      // Note: require-jsdoc was removed from ESLint 9.x
      // TypeScript type annotations provide documentation
      // Consider eslint-plugin-jsdoc if JSDoc enforcement is needed
    }
  },

  // =====================================================
  // TEST FILES - Relaxed rules for Jest test files
  // =====================================================
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      // Jest's expect.objectContaining() and other matchers return `any`
      // This is inherent to Jest's design and can't be avoided
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // Test helper functions don't always need return types
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Allow using non-null assertions in tests for mocks
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Tests often have longer functions
      'max-lines-per-function': 'off',
      'max-statements': 'off'
    }
  },

  // =====================================================
  // JAVASCRIPT FILES (.js, .jsx) - Basic linting without type-aware rules
  // =====================================================
  {
    files: ['**/*.{js,jsx}'],

    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
        // NO project option - these files aren't in tsconfig.json
      },
      globals: {
        NodeJS: 'readonly',
        React: 'readonly',
        JSX: 'readonly',
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        require: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly'
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
      }
    },

    rules: {
      // =====================================================
      // DISABLED: Type-aware rules (require project option)
      // =====================================================
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/return-await': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/naming-convention': 'off',

      // =====================================================
      // ENABLED: Basic code quality rules
      // =====================================================
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'default-case': 'error',
      'no-fallthrough': 'error',
      'no-extra-bind': 'error',
      'complexity': ['warn', 25],
      'max-depth': ['warn', 5],

      // Import rules
      'import/no-cycle': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],

      // React rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-key': ['error', { checkFragmentShorthand: true }],
      'react/prop-types': 'off',
      'react/no-unused-state': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-danger': 'warn'
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
    // Exception for complex reader component (contains 3 related components)
    files: ['**/components/reader/MobileReader.tsx'],
    rules: {
      'max-lines': ['error', { max: 800 }] // Complex reader with modals
    }
  },

  {
    // Exception for library action bar (complex UI component)
    files: ['**/components/library-action-bar/LibraryActionBar.tsx'],
    rules: {
      'max-lines-per-function': 'off' // ESLint max-lines-per-function rule crashes on this file
    }
  },

  {
    // Exception for prowlarr client (complex service with large functions)
    files: ['**/server/services/prowlarrClient.ts'],
    rules: {
      'max-lines-per-function': 'off' // ESLint max-lines-per-function rule crashes on this file at line 491
    }
  },

  {
    // Exception for ProviderSearchModal (re-export wrapper causing ESLint crash)
    files: ['**/components/manga/ProviderSearchModal.tsx', '**/components/manga/ProviderSearchModal/useProviderSearch.ts'],
    rules: {
      'max-lines-per-function': 'off' // ESLint max-lines-per-function rule crashes on these files at line 129
    }
  },

  {
    // Exception for gallery navigation hook (ESLint bug causes crash)
    files: ['**/components/images/hooks/useGalleryNavigation.ts'],
    rules: {
      'max-lines-per-function': 'off' // ESLint max-lines-per-function rule crashes on this file
    }
  },

  {
    // Exception for Kapowarr integration services (ESLint bug causes crash)
    files: ['**/utils/type-guards/adapters/kapowarr/modules/integration-services.ts'],
    rules: {
      'max-lines-per-function': 'off' // ESLint max-lines-per-function rule crashes on this file
    }
  },

  {
    // Exception for SuwayomiDownloadManager (ESLint bug causes crash at line 73)
    files: ['**/components/suwayomi/SuwayomiDownloadManager.tsx'],
    rules: {
      'max-lines-per-function': 'off' // ESLint max-lines-per-function rule crashes on this file
    }
  },

  {
    // Relaxed rules for page files (UI-heavy with lots of state management)
    files: ['**/pages/**/*.{tsx,jsx}'],
    rules: {
      'max-lines': ['error', { max: 800 }],
      'max-lines-per-function': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
      'complexity': ['warn', 30],
      '@typescript-eslint/no-unnecessary-condition': 'off' // Pages often have runtime conditionals
    }
  },

  {
    // Exception for manga detail page (complex UI with extensive metadata handling)
    files: ['**/pages/manga/[id].tsx'],
    rules: {
      'max-lines': ['error', { max: 2500 }], // Complex detail page with metadata import/export
      'max-lines-per-function': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
      'complexity': ['warn', 40] // Higher complexity due to metadata transformation logic
    }
  },

  {
    // Exception for metadata router (heavy runtime type checking and dynamic property access)
    files: ['**/server/trpc/routers/metadata.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off', // Extensive runtime type guards
      'max-lines': ['error', { max: 6000 }], // Complex metadata operations
      'max-lines-per-function': ['warn', { max: 200, skipBlankLines: true, skipComments: true }]
    }
  },

  {
    // Relaxed rules for test setup/configuration files
    files: ['**/test/setup.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'max-statements': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off', // Mocks use global, window, document
      'no-param-reassign': 'off',
      'import/order': 'off'
    }
  },

  {
    // Relaxed rules for test files
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/__tests__/**'],
    languageOptions: {
      globals: {
        // Jest globals
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        // Performance API
        performance: 'readonly',
        // CommonJS
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly'
      }
    },
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
  // MJS FILES - Node.js integration test files
  // =====================================================
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        // ES module globals
        import: 'readonly',
        // Timer functions
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        // Fetch API (Node 18+)
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      // Disable all TypeScript-ESLint rules for .mjs files
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // Relaxed rules for integration test scripts
      'no-console': 'off',
      'no-undef': 'off', // Allow Node.js globals
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always']
    }
  },

  // =====================================================
  // TEST FILES IN tests/ DIRECTORY - Relaxed rules for integration tests
  // =====================================================
  {
    files: ['tests/**/*.js', 'tests/**/*.mjs'],
    rules: {
      // Integration tests commonly use console for test output
      'no-console': 'off',
      // Unused vars are common in test scaffolding
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      // Test files often have more complex assertions
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      'complexity': 'off'
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
