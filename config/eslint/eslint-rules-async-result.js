/**
 * ESLint rules for AsyncResult pattern enforcement
 * Add to your main .eslintrc.js extends array
 */

module.exports = {
  rules: {
    // Prevent direct access to .success property
    'no-restricted-syntax': [
      'error',
      {
        selector: 'MemberExpression[property.name="success"]',
        message: 'Use isSuccess() helper instead of accessing .success directly'
      },
      {
        selector: 'MemberExpression[property.name="value"]',
        message: 'Use .data property after isSuccess() check instead of .value'
      },
      {
        selector: 'MemberExpression[property.name="isLoading"][object.type="Identifier"]',
        message: 'For mutations use .isPending, for queries check if this is correct'
      }
    ],

    // Custom rule for ID conversions
    'no-direct-id-assignment': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce ID type conversion when passing to APIs',
          category: 'Possible Errors',
          recommended: true
        },
        fixable: 'code',
        schema: []
      },
      create(context) {
        return {
          'ObjectExpression > Property[key.name="mangaId"][value.type="MemberExpression"][value.property.name="id"]': function(node) {
            const sourceCode = context.getSourceCode();
            const text = sourceCode.getText(node.value);

            // Check if it's already wrapped in toNumberId
            const parent = sourceCode.getText(node);
            if (!parent.includes('toNumberId')) {
              context.report({
                node: node.value,
                message: 'Use toNumberId() when assigning manga.id to mangaId',
                fix(fixer) {
                  return fixer.replaceText(node.value, `toNumberId(${text})`);
                }
              });
            }
          }
        };
      }
    },

    // Warn about tRPC v11 syntax
    'trpc-v11-syntax': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Ensure tRPC v11 syntax is used',
          category: 'Best Practices',
          recommended: true
        },
        schema: []
      },
      create(context) {
        return {
          'MemberExpression[property.name="query"] > MemberExpression[property.name="useQuery"]': function(node) {
            // Check if this is a tRPC call pattern
            const sourceCode = context.getSourceCode();
            const text = sourceCode.getText(node.parent.parent);

            if (text.includes('trpc.') && text.includes('.query.useQuery')) {
              context.report({
                node: node.parent,
                message: 'Note: .query.useQuery() is valid if "query" is a procedure name. Consider renaming for clarity.'
              });
            }
          }
        };
      }
    },

    // Mantine v7 prop compliance
    'mantine-v7-props': {
      meta: {
        type: 'error',
        docs: {
          description: 'Enforce Mantine v7 prop names',
          category: 'Best Practices',
          recommended: true
        },
        fixable: 'code',
        schema: []
      },
      create(context) {
        return {
          'JSXAttribute[name.name="weight"]': function(node) {
            context.report({
              node,
              message: 'Use "fw" instead of "weight" (Mantine v7)',
              fix(fixer) {
                return fixer.replaceText(node.name, 'fw');
              }
            });
          },
          'JSXAttribute[name.name="spacing"]': function(node) {
            // Check if parent is Group, Stack, SimpleGrid
            const parent = node.parent.parent;
            if (parent && parent.name && ['Group', 'Stack', 'SimpleGrid'].includes(parent.name.name)) {
              context.report({
                node,
                message: 'Use "gap" instead of "spacing" (Mantine v7)',
                fix(fixer) {
                  return fixer.replaceText(node.name, 'gap');
                }
              });
            }
          },
          'JSXAttribute[name.name="position"]': function(node) {
            // Check if parent is Group
            const parent = node.parent.parent;
            if (parent && parent.name && parent.name.name === 'Group') {
              const value = node.value.value;
              const replacements = {
                'apart': 'space-between',
                'center': 'center',
                'left': 'flex-start',
                'right': 'flex-end'
              };

              context.report({
                node,
                message: 'Use "justify" instead of "position" (Mantine v7)',
                fix(fixer) {
                  const newValue = replacements[value] || value;
                  return fixer.replaceText(node, `justify="${newValue}"`);
                }
              });
            }
          },
          'JSXAttribute[name.name="animate"]': function(node) {
            // Check if parent is Progress
            const parent = node.parent.parent;
            if (parent && parent.name && parent.name.name === 'Progress') {
              context.report({
                node,
                message: 'Use "animated" instead of "animate" (Mantine v7)',
                fix(fixer) {
                  return fixer.replaceText(node.name, 'animated');
                }
              });
            }
          }
        };
      }
    }
  }
};