# Test Templates

This directory contains templates for different types of tests in the Mugiwara-Kaizoku project. These templates follow the established patterns and best practices identified during the test fixing process.

## Available Templates

1. **Component Test Template** (`component-test.template.tsx`)
   - Template for testing React components
   - Includes patterns for mocking UI components, handling events, and testing accessibility

2. **Hook Test Template** (`hook-test.template.ts`)
   - Template for testing React hooks
   - Includes patterns for mocking dependencies, testing state changes, and handling side effects

3. **API Test Template** (`api-test.template.ts`)
   - Template for testing Next.js API endpoints
   - Includes patterns for mocking requests/responses, database operations, and authentication

## How to Use These Templates

### Creating a New Test File

1. Copy the appropriate template to your test directory
2. Rename it to match your component/hook/API (e.g., `YourComponent.test.tsx`)
3. Uncomment and modify the relevant sections
4. Add your specific test cases

### Example: Creating a Component Test

```bash
# Copy the template
cp src/test/templates/component-test.template.tsx src/components/__tests__/YourComponent.test.tsx

# Edit the file to uncomment and customize for your component
```

### Common Testing Patterns

These templates incorporate the following key patterns:

#### 1. Factory Pattern for Test Data

```typescript
const createMockData = (overrides = {}) => ({
  id: 1,
  name: 'Test Name',
  // Default properties
  ...overrides,
});

// Usage
const testData = createMockData({ name: 'Custom Name' });
```

#### 2. Console Mocking Pattern

```typescript
let originalConsole;

beforeEach(() => {
  originalConsole = { ...console };
  console.error = jest.fn();
  console.log = jest.fn();
});

afterEach(() => {
  Object.assign(console, originalConsole);
});
```

#### 3. UI Component Mocking

```typescript
jest.mock('@mantine/core', () => {
  return {
    Button: ({ children, onClick, ...props }) => (
      <button 
        onClick={onClick}
        data-testid="mantine-button"
        {...props}
      >
        {children}
      </button>
    ),
    // Other components...
  };
});
```

#### 4. Edge Case Testing

```typescript
it('handles undefined props gracefully', () => {
  render(<YourComponent items={undefined} />);
  expect(screen.getByText(/no items available/i)).toBeInTheDocument();
});

it('handles null props gracefully', () => {
  render(<YourComponent items={null} />);
  expect(screen.getByText(/no items available/i)).toBeInTheDocument();
});
```

#### 5. Accessibility Testing

```typescript
it('has proper ARIA attributes', () => {
  render(<YourComponent />);
  expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Do something');
});
```

## Best Practices

1. **Clear Test Organization**
   - Group related tests in `describe` blocks
   - Use nested `describe` blocks for different aspects of functionality

2. **Meaningful Test Names**
   - Use descriptive names that explain what is being tested
   - Focus on behavior rather than implementation details

3. **Isolation and Independence**
   - Reset mocks between tests
   - Avoid test pollution with proper setup and teardown

4. **Edge Case Testing**
   - Always test null/undefined inputs
   - Test boundary conditions and error scenarios

5. **Accessibility Testing**
   - Include tests for ARIA attributes
   - Verify proper screen reader support

## Troubleshooting Common Issues

### Mock Not Working

If your mocks aren't working correctly, check:
- The mock is defined before importing the module
- The mock path exactly matches the import path in the component
- You're using `jest.mock()` correctly (not `jest.fn()`) for modules

### Act Warning

If you see warnings about updates during render:
- Wrap state updates in `act()`
- For async operations, use `await act(async () => {...})`
- Ensure all promises are resolved before assertions

### Test Output Too Verbose

If you're getting too much console output:
- Mock `console.log`, `console.error`, etc.
- Use `console.warn = jest.fn()` to suppress specific warnings

## Additional Resources

- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Next.js API Routes](https://nextjs.org/docs/app/building-your-application/testing/api-testing)
- [Accessibility Testing Best Practices](https://testing-library.com/docs/queries/byrole)