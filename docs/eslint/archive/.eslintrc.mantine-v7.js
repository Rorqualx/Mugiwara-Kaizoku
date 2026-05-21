/**
 * ESLint configuration for Mantine v7 migration
 * Add this to your main .eslintrc.js extends array
 */

module.exports = {
  rules: {
    // Custom rule to catch deprecated Mantine props
    'no-restricted-syntax': [
      'error',
      {
        selector: 'JSXAttribute[name.name="spacing"]',
        message: 'The "spacing" prop is deprecated in Mantine v7. Use "gap" instead.'
      },
      {
        selector: 'JSXAttribute[name.name="position"]',
        message: 'The "position" prop is deprecated in Mantine v7. Use "justify" instead with values: "space-between" (was "apart"), "center", "flex-start" (was "left"), "flex-end" (was "right").'
      },
      {
        selector: 'JSXAttribute[name.name="weight"]',
        message: 'The "weight" prop is deprecated in Mantine v7. Use "fw" (font-weight) instead.'
      },
      {
        selector: 'JSXOpeningElement[name.name="Progress"] > JSXAttribute[name.name="animate"]',
        message: 'The "animate" prop is deprecated in Mantine v7 Progress component. Use "animated" instead.'
      }
    ],

    // Additional pattern matching for Mantine components
    'no-restricted-properties': [
      'error',
      {
        object: 'props',
        property: 'spacing',
        message: 'The "spacing" prop is deprecated in Mantine v7. Use "gap" instead.'
      },
      {
        object: 'props',
        property: 'position',
        message: 'The "position" prop is deprecated in Mantine v7. Use "justify" instead.'
      },
      {
        object: 'props',
        property: 'weight',
        message: 'The "weight" prop is deprecated in Mantine v7. Use "fw" instead.'
      }
    ]
  },

  overrides: [
    {
      // Apply stricter rules to component files
      files: ['*.tsx', '*.jsx'],
      rules: {
        // Can add component-specific rules here
      }
    }
  ]
};

/**
 * Alternative: Custom ESLint Plugin for more advanced checks
 *
 * If you need more sophisticated checking, create a custom plugin:
 *
 * // eslint-plugin-mantine-v7/index.js
 * module.exports = {
 *   rules: {
 *     'no-deprecated-props': {
 *       create(context) {
 *         return {
 *           JSXAttribute(node) {
 *             const deprecated = {
 *               spacing: 'gap',
 *               position: 'justify',
 *               weight: 'fw',
 *               animate: 'animated'
 *             };
 *
 *             const propName = node.name.name;
 *             if (deprecated[propName]) {
 *               context.report({
 *                 node,
 *                 message: `The "${propName}" prop is deprecated. Use "${deprecated[propName]}" instead.`,
 *                 fix(fixer) {
 *                   return fixer.replaceText(node.name, deprecated[propName]);
 *                 }
 *               });
 *             }
 *           }
 *         };
 *       }
 *     }
 *   }
 * };
 */