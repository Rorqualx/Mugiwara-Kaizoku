// ESLint Custom Rules for Mugiwara-Kaizoku
// Add these to your .eslintrc.json or create as custom rules

module.exports = {
  rules: {
    // Rule: Prevent Mantine v6 deprecated props
    'no-restricted-props': [
      'error',
      {
        // Text component
        {
          object: 'Text',
          property: 'weight',
          message: 'Use "fw" instead of "weight" for Mantine v7'
        },
        // Group component
        {
          object: 'Group',
          property: 'spacing',
          message: 'Use "gap" instead of "spacing" for Mantine v7'
        },
        {
          object: 'Group',
          property: 'position',
          message: 'Use "justify" instead of "position" for Mantine v7'
        },
        // Stack component
        {
          object: 'Stack',
          property: 'spacing',
          message: 'Use "gap" instead of "spacing" for Mantine v7'
        },
        // Progress component
        {
          object: 'Progress',
          property: 'animate',
          message: 'Use "animated" instead of "animate" for Mantine v7'
        },
        // MultiSelect component
        {
          object: 'MultiSelect',
          property: 'creatable',
          message: '"creatable" prop is not supported in Mantine v7'
        }
      }
    ],

    // Rule: Prevent incorrect tRPC usage
    'no-restricted-syntax': [
      'error',
      {
        selector: 'MemberExpression[object.property.name="query"][property.name="useQuery"]',
        message: 'Use tRPC v10 syntax: trpc.resource.methodName.useQuery() instead of trpc.resource.query.useQuery()'
      },
      {
        selector: 'MemberExpression[property.name="isLoading"][object.property.name=/use(Query|Mutation)/]',
        message: 'Use "isPending" instead of "isLoading" for tRPC v10 queries and mutations'
      }
    ],

    // Rule: Enforce type imports for type-only imports
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        disallowTypeAnnotations: true,
        fixStyle: 'separate-type-imports'
      }
    ],

    // Rule: Prevent any types
    '@typescript-eslint/no-explicit-any': [
      'error',
      {
        fixToUnknown: true,
        ignoreRestArgs: false
      }
    ],

    // Rule: Enforce explicit function return types
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true
      }
    ],

    // Rule: Prevent unused variables
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }
    ],

    // Rule: Enforce nullish coalescing
    '@typescript-eslint/prefer-nullish-coalescing': [
      'error',
      {
        ignoreConditionalTests: true,
        ignoreTernaryTests: true,
        ignoreMixedLogicalExpressions: false
      }
    ],

    // Rule: Enforce optional chaining
    '@typescript-eslint/prefer-optional-chain': 'error',

    // Rule: Prevent floating promises
    '@typescript-eslint/no-floating-promises': [
      'error',
      {
        ignoreVoid: true,
        ignoreIIFE: true
      }
    ],

    // Rule: Enforce consistent type assertions
    '@typescript-eslint/consistent-type-assertions': [
      'error',
      {
        assertionStyle: 'as',
        objectLiteralTypeAssertions: 'allow-as-parameter'
      }
    ],

    // Rule: Require await in async functions
    '@typescript-eslint/require-await': 'error',

    // Rule: No unsafe member access
    '@typescript-eslint/no-unsafe-member-access': 'error',

    // Rule: No unsafe assignment
    '@typescript-eslint/no-unsafe-assignment': 'error',

    // Rule: No unsafe return
    '@typescript-eslint/no-unsafe-return': 'error',

    // Rule: Strict boolean expressions
    '@typescript-eslint/strict-boolean-expressions': [
      'error',
      {
        allowString: false,
        allowNumber: false,
        allowNullableObject: true,
        allowNullableBoolean: true,
        allowNullableString: false,
        allowNullableNumber: false,
        allowAny: false
      }
    ]
  }
};

// Custom ESLint Plugin for Project-Specific Rules
// Save as eslint-plugin-mugiwara/index.js

module.exports = {
  rules: {
    // Rule: Enforce ID conversion when passing to tRPC/Prisma
    'require-id-conversion': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require ID type conversion when passing to tRPC or Prisma operations',
          category: 'Type Safety'
        },
        fixable: 'code',
        schema: []
      },
      create(context) {
        return {
          ObjectExpression(node) {
            node.properties.forEach(prop => {
              if (
                prop.type === 'Property' &&
                prop.key.type === 'Identifier' &&
                (prop.key.name === 'mangaId' || prop.key.name === 'chapterId' || prop.key.name.endsWith('Id')) &&
                prop.value.type === 'MemberExpression' &&
                prop.value.property.type === 'Identifier' &&
                prop.value.property.name === 'id'
              ) {
                context.report({
                  node: prop,
                  message: `Use toNumberId() to convert ID type: ${prop.key.name}: toNumberId(${context.getSourceCode().getText(prop.value)})`,
                  fix(fixer) {
                    return fixer.replaceText(
                      prop.value,
                      `toNumberId(${context.getSourceCode().getText(prop.value)})`
                    );
                  }
                });
              }
            });
          }
        };
      }
    },

    // Rule: Enforce AsyncResult pattern usage
    'async-result-complete-check': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Ensure all AsyncResult states are checked',
          category: 'Error Handling'
        },
        schema: []
      },
      create(context) {
        return {
          IfStatement(node) {
            const sourceCode = context.getSourceCode();
            const text = sourceCode.getText(node.test);
            
            // Check if this is an AsyncResult check
            if (text.includes('isSuccess(') || text.includes('isError(')) {
              // Look for sibling if statements
              let hasErrorCheck = false;
              let hasSuccessCheck = false;
              
              // Check current and sibling nodes
              if (text.includes('isSuccess(')) hasSuccessCheck = true;
              if (text.includes('isError(')) hasErrorCheck = true;
              
              // Check else-if chain
              let current = node;
              while (current.alternate) {
                if (current.alternate.type === 'IfStatement') {
                  const altText = sourceCode.getText(current.alternate.test);
                  if (altText.includes('isSuccess(')) hasSuccessCheck = true;
                  if (altText.includes('isError(')) hasErrorCheck = true;
                  current = current.alternate;
                } else {
                  break;
                }
              }
              
              if (!hasErrorCheck || !hasSuccessCheck) {
                context.report({
                  node,
                  message: 'AsyncResult usage must check both isSuccess() and isError() states'
                });
              }
            }
          }
        };
      }
    },

    // Rule: Prevent direct prisma model access without verification
    'verify-prisma-model': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Ensure Prisma models exist in schema before use',
          category: 'Database'
        },
        schema: []
      },
      create(context) {
        const knownModels = [
          'manga', 'chapter', 'library', 'user', 'settings',
          'metadata', 'task', 'syncTask', 'notification'
        ];
        
        return {
          MemberExpression(node) {
            if (
              node.object.type === 'Identifier' &&
              node.object.name === 'prisma' &&
              node.property.type === 'Identifier' &&
              !knownModels.includes(node.property.name)
            ) {
              context.report({
                node,
                message: `Unknown Prisma model "${node.property.name}". Ensure it exists in schema.prisma and run "npx prisma generate"`
              });
            }
          }
        };
      }
    }
  }
};
