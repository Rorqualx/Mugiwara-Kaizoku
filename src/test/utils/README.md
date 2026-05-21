# Test Utilities

This directory contains utilities and helpers for testing components in the Mugiwara-Kaizoku project.

## Available Utilities

### 1. Test Helpers (`testHelpers.tsx`)

Common utility functions for testing:

- `render()` - Enhanced render function with provider wrappers
- `waitForComponentToPaint()` - Helper for waiting for component updates
- `mockConsole()` - Helper for mocking console methods
- `createMockComponentFactory()` - Factory for creating mock components
- `createMockDate()` - Helper for creating dates safely in tests
- `createDataFactory()` - Factory function for test data
- `createMockEvent()` - Helper for creating mock events
- `mockResizeObserver()` - Mocks the ResizeObserver API
- `mockIntersectionObserver()` - Mocks the IntersectionObserver API
- `createTestWrapper()` - Creates a test wrapper with providers
- `createTestContext()` - Helper for testing React contexts

### 2. Mock Components (`mockComponents.tsx`)

Ready-to-use mock implementations of common components:

- `mockMantineComponents` - Mocks for @mantine/core components
- `mockTablerIcons` - Mocks for @tabler/icons-react components
- `mockDataTable` - Mock for mantine-datatable DataTable component

### 3. Test Data Factories (`factories.ts`)

Factory functions for creating test data:

- `createTestUser()` - Creates a test user
- `createTestManga()` - Creates a test manga
- `createTestChapter()` - Creates a test chapter
- `createTestLibrary()` - Creates a test library
- `createTestTask()` - Creates a test task
- `createTestDownloadQueueItem()` - Creates a test download queue item
- `createTestMetadata()` - Creates a test metadata item
- `createTestSearchResult()` - Creates a test search result
- `createTestNotification()` - Creates a test notification
- `createTestSettings()` - Creates a test settings object
- `createTestEvent()` - Creates a test event

### 4. Test Patterns (`testPatterns.ts`)

Reusable patterns and utilities for common testing scenarios:

#### Basic Utilities
- `findByRoleSafely` - Safely find elements by role (handling multiple elements with the same role)
- `renderAndUnmount` - Safely handle component unmounting and remounting
- `expectStructuredError` - Validate structured API error responses
- `mountForTesting` - Mount components with proper test wrappers
- `createTestableVersion` - Create testable versions of components that might be globally mocked
- `expectVisibleAndInteractive` - Check if elements are visible and interactive for accessibility testing

#### Enhanced Utilities
- `createMockFactory` - Factory pattern for creating and managing Jest mock functions
- `safeProp` - Safely handle null/undefined values in components
- `createTrpcTestHook` - Create test implementations of TRPC hooks
- `createTestPagination` - Test pagination without infinite loops

### Usage Examples

#### Test Helpers

```typescript
import { render, mockConsole, createMockDate } from '@/test/utils/testHelpers';

test('component renders correctly', () => {
  // Enhanced render with providers
  const { getByText } = render(<MyComponent />);
  expect(getByText('Hello World')).toBeInTheDocument();
});

test('logs error message', () => {
  // Mock console methods
  const { mocks, restore } = mockConsole(['error']);
  
  myFunction(); // Function that calls console.error
  
  expect(mocks.error).toHaveBeenCalledWith('Expected error');
  restore(); // Restore original console.error
});

test('formats date correctly', () => {
  // Create a mock date without timezone issues
  const mockDate = createMockDate('2025-01-15T12:00:00Z');
  
  const { getByText } = render(<DateDisplay date={mockDate} />);
  expect(getByText('January 15, 2025')).toBeInTheDocument();
});
```

#### Mock Components

```typescript
import { mockMantineComponents, mockTablerIcons } from '@/test/utils/mockComponents';

// Mock Mantine components
jest.mock('@mantine/core', () => mockMantineComponents);

// Mock Tabler icons
jest.mock('@tabler/icons-react', () => mockTablerIcons);

test('button has correct props', () => {
  const { getByTestId } = render(<MyComponent />);
  
  const button = getByTestId('mantine-button');
  expect(button).toHaveAttribute('data-variant', 'filled');
  expect(button).toHaveAttribute('data-color', 'blue');
});

test('uses search icon', () => {
  const { getByTestId } = render(<MyComponent />);
  
  const icon = getByTestId('icon-search');
  expect(icon).toBeInTheDocument();
});
```

#### Test Data Factories

```typescript
import { createTestManga, createTestChapter } from '@/test/utils/factories';

test('displays manga details', () => {
  // Create test manga with custom properties
  const manga = createTestManga({ 
    title: 'One Piece', 
    alternativeTitles: ['ワンピース']
  });
  
  const { getByText } = render(<MangaDetails manga={manga} />);
  
  expect(getByText('One Piece')).toBeInTheDocument();
  expect(getByText('ワンピース')).toBeInTheDocument();
});

test('displays chapter list', () => {
  // Create multiple test items
  const chapters = [
    createTestChapter({ id: 1, title: 'Chapter 1' }),
    createTestChapter({ id: 2, title: 'Chapter 2' }),
    createTestChapter({ id: 3, title: 'Chapter 3' }),
  ];
  
  const { getAllByTestId } = render(<ChapterList chapters={chapters} />);
  
  const chapterItems = getAllByTestId('chapter-item');
  expect(chapterItems).toHaveLength(3);
});
```

#### Basic Utilities

```typescript
import testPatterns from './testPatterns';

// Working with accessibility landmarks
it('maintains proper landmark structure', () => {
  render(<MyComponent />);
  
  // Safely find main landmark (even if there are multiple)
  const mainLandmark = testPatterns.findByRoleSafely('main');
  expect(mainLandmark).toContainElement(screen.getByText('Content'));
});

// Testing component remounting
it('handles remounting correctly', () => {
  const { unmount, rerender } = testPatterns.renderAndUnmount(
    <MyComponent content="Initial" />
  );
  
  // Completely unmount
  unmount();
  
  // Safely remount (handles correctly whether unmounted or not)
  rerender(<MyComponent content="Remounted" />);
  
  expect(screen.getByText('Remounted')).toBeInTheDocument();
});

// Testing API responses
it('validates structured error responses', async () => {
  const response = await makeApiCall();
  
  testPatterns.expectStructuredError(response, {
    errorMessage: 'Validation error',
    fieldErrors: [
      { field: 'username', messagePattern: 'at least 3 characters' }
    ]
  });
});
```

#### Enhanced Utilities

```typescript
import {
  createMockFactory,
  safeProp,
  createTrpcTestHook,
  createTestPagination
} from './testPatterns';

// Factory Pattern for Mocks
const mockFactory = createMockFactory();
mockFactory.create('showSuccess');
mockFactory.create('showError');
mockFactory.create('trpcQuery', () => ({ data: 'test' }));

// Get all mocks
const { showSuccess, showError, trpcQuery } = mockFactory.getMocks();

// Safe Null/Undefined Handling
it('renders with null values safely', () => {
  render(
    <Component 
      value={safeProp(null, '')} 
      color={safeProp(undefined, 'default')}
    />
  );
  // Component should render without warnings
});

// TRPC Mock Implementation
const mockManga = { id: 1, title: 'Test Manga' };
const trpcHook = createTrpcTestHook(mockManga, { isLoading: false });

// Create a complete mock for trpc
jest.mock('@/utils/trpcClient', () => ({
  trpc: {
    manga: {
      detail: createTrpcTestHook(mockManga)
    }
  }
}));

// Test Pagination Implementation
jest.mock('@/hooks/usePagination', () => ({
  usePagination: (items, options) => createTestPagination(items, options)
}));
```

## Test-Specific Hook Implementations

For complex hooks with dependencies, create a test-specific implementation:

```typescript
function useMetadataTestImpl(mangaId: number) {
  // Use controlled mocks
  const { showSuccess, showError } = useNotification();
  const metadataQuery = mockDetailUseQuery({ id: mangaId });
  
  // Implement core functionality with predictable behavior
  const refreshMetadata = async () => {
    try {
      await mockRefreshMetadata(mangaId);
      showSuccess('Metadata refreshed successfully');
      return true;
    } catch (error) {
      showError('Failed to refresh metadata');
      return false;
    }
  };
  
  return {
    metadata: metadataQuery.data?.metadata || null,
    isLoading: metadataQuery.isLoading,
    refreshMetadata
  };
}
```

## Testing Mocked Components

If you find that a component is globally mocked in `setup.ts`, you have two options:

1. **Use the mock as-is** - Create a `.fixed.test.tsx` file that tests the mocked implementation
2. **Create a testable version** - Use `createTestableVersion` to wrap the component for testing

Example:

```typescript
import { SearchResults } from '../../components/search/SearchResults';
import testPatterns from '../utils/testPatterns';

// Create a testable version of the component
const TestableSearchResults = testPatterns.createTestableVersion(SearchResults);

it('renders loading state correctly', () => {
  render(<TestableSearchResults isLoading results={[]} />);
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});
```

## Handling Null/Undefined Values

Always provide fallbacks for null/undefined values in component tests:

```typescript
// In component code
<TextInput
  value={value ?? ''}
  onChange={handleChange}
/>

// In tests
render(
  <Component 
    value={null} 
    onChange={jest.fn()}
  />
);
// This would trigger a React warning without the ?? operator
```

## Finding Failing Tests

Use the `find-failing-tests.js` script in the `scripts` directory to identify failing tests:

```bash
node scripts/find-failing-tests.js --component=SearchResults
```

## Best Practices

### 1. Use Factory Functions for Test Data

Always use factory functions to create test data:

```typescript
// Good
const manga = createTestManga({ title: 'Custom Title' });

// Avoid
const manga = {
  id: 1,
  title: 'Custom Title',
  // ... incomplete data might cause errors
};
```

### 2. Mock External Dependencies

Use the provided mock components for consistent testing:

```typescript
// Good
jest.mock('@mantine/core', () => mockMantineComponents);

// Avoid
jest.mock('@mantine/core', () => ({
  Button: () => <button>Mock Button</button>,
  // ... incomplete mocks might miss important props
}));
```

### 3. Test Edge Cases

Always test with null/undefined values:

```typescript
// Test with null/undefined values
test('handles null data', () => {
  render(<Component data={null} />);
  expect(screen.getByText('No data available')).toBeInTheDocument();
});

// Test with empty arrays
test('handles empty arrays', () => {
  render(<Component items={[]} />);
  expect(screen.getByText('No items available')).toBeInTheDocument();
});
```

### 4. Test for Accessibility

```typescript
test('has proper ARIA attributes', () => {
  render(<Component />);
  
  // Check for proper roles
  expect(screen.getByRole('button')).toBeInTheDocument();
  
  // Check for aria labels
  expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Download');
});
```

### 5. Keep Tests Clean and Isolated

```typescript
// Use beforeEach/afterEach for setup/teardown
let consoleMock;

beforeEach(() => {
  consoleMock = mockConsole(['error', 'warn']);
});

afterEach(() => {
  consoleMock.restore();
  jest.clearAllMocks();
});
```

### 6. Follow the Testing Trophy

- **Unit Tests**: Test small units of code
- **Integration Tests**: Test how units work together
- **UI Tests**: Test user interactions
- **End-to-End Tests**: Test complete user flows

### 7. Use Appropriate Assertions

```typescript
// For existence
expect(element).toBeInTheDocument();

// For visibility
expect(element).toBeVisible();

// For attribute values
expect(element).toHaveAttribute('aria-label', 'Download');

// For content
expect(element).toHaveTextContent('Expected text');
```

## Additional Resources

For more information, see:
- [Test Patterns Guide](../../../docs/testing-guide-unified.md)
- [Test Fixing Guide](../../../docs/test-fixing-guide.md)
- [Test Debugging Guide](../../../docs/test-debugging-guide.md)
- [Test Fixes Summary](../../../docs/test-fixes-summary.md)
- [Test Template Guide](../../../docs/test-template-guide.md)
- [CI/CD Workflows](../../../docs/ci-cd-workflows.md)
- [Test Infrastructure Summary](../../../docs/test-infrastructure-summary.md)