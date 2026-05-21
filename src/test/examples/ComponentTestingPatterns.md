# Component Testing Patterns

This document demonstrates how to use the mock helpers to address common component testing patterns and challenges in our codebase.

## Table of Contents

1. [Testing Components with Modals](#testing-components-with-modals)
2. [Testing Components with tRPC](#testing-components-with-trpc)
3. [Testing Components with Mantine Hooks](#testing-components-with-mantine-hooks)
4. [Testing Components with File System Access API](#testing-components-with-file-system-access-api)
5. [Testing Components with Complex Contexts](#testing-components-with-complex-contexts)
6. [Complete Test Example](#complete-test-example)

## Testing Components with Modals

When testing components that use Mantine modals, the key challenge is that the modal content is rendered outside the component tree, typically at the end of the DOM. Here's how to test a component that opens a modal:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockMantineModals, StandardTestWrapper } from '@/test/utils/mockHelpers';

// Test a component that opens a modal
describe('ModalButton Component', () => {
  beforeEach(() => {
    // Mock the modals
    mockMantineModals();
  });

  test('opens modal when clicked', async () => {
    const user = userEvent.setup();
    render(<ModalButton />, { wrapper: StandardTestWrapper });
    
    // Click the button that opens the modal
    const button = screen.getByRole('button', { name: /open modal/i });
    await user.click(button);
    
    // Verify that the openModal function was called
    const { useModals } = require('@mantine/modals');
    expect(useModals().openModal).toHaveBeenCalled();
  });

  test('handles form submission in modal', async () => {
    const user = userEvent.setup();
    const onSaveMock = jest.fn();
    
    render(<ModalButton onSave={onSaveMock} />, { wrapper: StandardTestWrapper });
    
    // Open the modal
    const button = screen.getByRole('button', { name: /open modal/i });
    await user.click(button);
    
    // Get the modal controls
    const { useModals } = require('@mantine/modals');
    const modalFunctions = useModals();
    
    // Get the onClose function passed to the modal content
    const closeModalCallback = modalFunctions.openModal.mock.calls[0][0].children.props.onClose;
    
    // Call the onClose function to simulate a successful form submission
    closeModalCallback();
    
    // Verify that the modal was closed and the onSave callback was called
    expect(modalFunctions.closeModal).toHaveBeenCalled();
    expect(onSaveMock).toHaveBeenCalled();
  });
});
```

## Testing Components with tRPC

Testing components that use tRPC involves mocking the tRPC client and its hooks. Here's how to do it:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMockTRPC, StandardTestWrapper } from '@/test/utils/mockHelpers';

// Mock the tRPC module
jest.mock('@/utils/trpcClient', () => ({
  trpc: createMockTRPC({
    'user.get.useQuery': () => ({
      data: { id: 1, name: 'Test User' },
      isLoading: false,
      error: null,
    }),
    'user.update.useMutation': () => ({
      mutateAsync: jest.fn().mockResolvedValue({ id: 1, name: 'Updated User' }),
      isLoading: false,
      error: null,
    }),
  }),
}));

describe('UserProfile Component', () => {
  test('displays user data from tRPC', () => {
    render(<UserProfile userId={1} />, { wrapper: StandardTestWrapper });
    
    // Check that the user data is displayed
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
  
  test('updates user data with tRPC mutation', async () => {
    const user = userEvent.setup();
    render(<UserProfile userId={1} />, { wrapper: StandardTestWrapper });
    
    // Click the edit button
    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);
    
    // Fill in the form
    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated User');
    
    // Submit the form
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    // Verify that the mutation was called
    const { trpc } = require('@/utils/trpcClient');
    const mutateAsync = trpc.user.update.useMutation().mutateAsync;
    expect(mutateAsync).toHaveBeenCalledWith({
      id: 1,
      name: 'Updated User',
    });
  });
});
```

## Testing Components with Mantine Hooks

Testing components that use Mantine hooks requires mocking those hooks to provide predictable values:

```tsx
import { render, screen } from '@testing-library/react';
import { mockMantineHooks, StandardTestWrapper } from '@/test/utils/mockHelpers';

describe('ThemeToggle Component', () => {
  beforeEach(() => {
    // Mock Mantine hooks
    mockMantineHooks();
  });
  
  test('renders with light theme', () => {
    // Override the default mock for useColorScheme
    const { useColorScheme } = require('@mantine/hooks');
    useColorScheme.mockReturnValue('light');
    
    render(<ThemeToggle />, { wrapper: StandardTestWrapper });
    
    // Check that the light theme is active
    expect(screen.getByText(/light mode/i)).toBeInTheDocument();
  });
  
  test('renders with dark theme', () => {
    // Override the default mock for useColorScheme
    const { useColorScheme } = require('@mantine/hooks');
    useColorScheme.mockReturnValue('dark');
    
    render(<ThemeToggle />, { wrapper: StandardTestWrapper });
    
    // Check that the dark theme is active
    expect(screen.getByText(/dark mode/i)).toBeInTheDocument();
  });
});
```

## Testing Components with File System Access API

Testing components that use the File System Access API requires mocking the API:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFileSystemAccessAPI, StandardTestWrapper } from '@/test/utils/mockHelpers';

describe('DirectoryPicker Component', () => {
  afterEach(() => {
    // Clean up the mock after each test
    jest.restoreAllMocks();
  });
  
  test('selects a directory successfully', async () => {
    const user = userEvent.setup();
    const onSelectMock = jest.fn();
    
    // Mock the File System Access API
    const { mockShowDirectoryPicker } = mockFileSystemAccessAPI({
      directoryHandle: { name: 'selected-folder', kind: 'directory' }
    });
    
    render(<DirectoryPicker onSelect={onSelectMock} />, { wrapper: StandardTestWrapper });
    
    // Click the browse button
    const browseButton = screen.getByRole('button', { name: /browse/i });
    await user.click(browseButton);
    
    // Verify that showDirectoryPicker was called
    expect(mockShowDirectoryPicker).toHaveBeenCalled();
    
    // Verify that onSelect was called with the directory name
    expect(onSelectMock).toHaveBeenCalledWith('selected-folder');
  });
  
  test('handles errors when selecting a directory', async () => {
    const user = userEvent.setup();
    const onErrorMock = jest.fn();
    
    // Mock the File System Access API to throw an error
    mockFileSystemAccessAPI({
      shouldThrowError: true,
      errorType: 'SecurityError'
    });
    
    render(<DirectoryPicker onError={onErrorMock} />, { wrapper: StandardTestWrapper });
    
    // Click the browse button
    const browseButton = screen.getByRole('button', { name: /browse/i });
    await user.click(browseButton);
    
    // Verify that onError was called with the error
    expect(onErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });
  
  test('gracefully handles unsupported browsers', async () => {
    const user = userEvent.setup();
    
    // Mock the File System Access API as not supported
    mockFileSystemAccessAPI({ isSupported: false });
    
    render(<DirectoryPicker />, { wrapper: StandardTestWrapper });
    
    // Verify that the component shows a message about unsupported browsers
    expect(screen.getByText(/not supported in this browser/i)).toBeInTheDocument();
  });
});
```

## Testing Components with Complex Contexts

Testing components that rely on multiple React contexts:

```tsx
import { render, screen } from '@testing-library/react';
import { createContextWrapper, StandardTestWrapper } from '@/test/utils/mockHelpers';

describe('Dashboard Component', () => {
  test('renders with mocked contexts', () => {
    // Create a wrapper with mocked contexts
    const ContextWrapper = createContextWrapper({
      UserContext: {
        user: { id: 1, name: 'Test User', role: 'ADMIN' },
        isLoading: false,
      },
      ThemeContext: {
        colorScheme: 'dark',
        toggleColorScheme: jest.fn(),
      },
      NotificationContext: {
        notifications: [],
        addNotification: jest.fn(),
        removeNotification: jest.fn(),
      },
    });
    
    // Combine the context wrapper with the standard wrapper
    const CombinedWrapper: React.FC<{children: React.ReactNode}> = ({ children }) => (
      <StandardTestWrapper>
        <ContextWrapper>{children}</ContextWrapper>
      </StandardTestWrapper>
    );
    
    render(<Dashboard />, { wrapper: CombinedWrapper });
    
    // Verify that the component renders with the mocked context values
    expect(screen.getByText(/test user/i)).toBeInTheDocument();
    expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
  });
});
```

## Complete Test Example

Here's a complete example that combines multiple testing patterns:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { 
  createMockTRPC, 
  mockMantineModals, 
  mockMantineHooks,
  mockFileSystemAccessAPI,
  StandardTestWrapper 
} from '@/test/utils/mockHelpers';

// Mock dependencies
jest.mock('@tabler/icons-react', () => ({
  IconFolderPlus: ({ size, ...props }: any) => (
    <svg data-testid="icon-folder-plus" width={size} height={size} {...props}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  IconCheck: ({ size, ...props }: any) => (
    <svg data-testid="icon-check" width={size} height={size} {...props}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
}));

jest.mock('@/utils/trpcClient', () => ({
  trpc: createMockTRPC({
    'library.create.useMutation': () => ({
      mutateAsync: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Test Library',
        path: '/test/path',
      }),
      isLoading: false,
      error: null,
    }),
  }),
}));

describe('AddLibrary Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMantineModals();
    mockMantineHooks();
    mockFileSystemAccessAPI({
      directoryHandle: { name: 'selected-folder', kind: 'directory' }
    });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  test('renders button with correct text and icon', () => {
    const mockOnCreate = jest.fn();
    render(<AddLibrary onCreate={mockOnCreate} />, { wrapper: StandardTestWrapper });
    
    // Check for button text and icon
    expect(screen.getByText('Create a Library')).toBeInTheDocument();
    expect(screen.getByTestId('icon-folder-plus')).toBeInTheDocument();
  });
  
  test('opens modal when button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnCreate = jest.fn();
    render(<AddLibrary onCreate={mockOnCreate} />, { wrapper: StandardTestWrapper });
    
    // Get the button and click it
    const createButton = screen.getByRole('button', { name: /create a library/i });
    await user.click(createButton);
    
    // Check that the modal was opened
    const { useModals } = require('@mantine/modals');
    expect(useModals().openModal).toHaveBeenCalled();
  });
  
  test('passes onCreate to form for successful submission', async () => {
    const user = userEvent.setup();
    const mockOnCreate = jest.fn();
    render(<AddLibrary onCreate={mockOnCreate} />, { wrapper: StandardTestWrapper });
    
    // Get the button and click it
    const createButton = screen.getByRole('button', { name: /create a library/i });
    await user.click(createButton);
    
    // Mock the modal closing callback (this simulates a successful form submission)
    const { useModals } = require('@mantine/modals');
    const closeModalCallback = useModals().openModal.mock.calls[0][0].children.props.onClose;
    
    // Call the onClose function passed to the LibraryForm
    closeModalCallback();
    
    // Check that the modal was closed and onCreate was called
    expect(useModals().closeModal).toHaveBeenCalled();
    expect(mockOnCreate).toHaveBeenCalled();
  });
});
```

This document provides patterns for addressing the most common testing challenges in our codebase. By using these patterns, we can write more consistent, reliable, and maintainable tests.

## Enhanced Test Patterns

The following enhanced test patterns have been added to improve test reliability and maintainability.

### Factory Pattern for Mocks

Use the factory pattern to create and manage Jest mock functions, avoiding variable hoisting issues:

```tsx
import { createMockFactory } from '@/test/utils/testPatterns';

describe('Component using notification hooks', () => {
  test('shows success notification on save', async () => {
    // Create mock factory
    const mockFactory = createMockFactory();
    
    // Create mocks before imports
    mockFactory.create('showSuccess');
    mockFactory.create('showError');
    
    // Mock the notification module
    jest.mock('@/hooks/useNotification', () => ({
      useNotification: () => ({
        showSuccess: mockFactory.getMocks().showSuccess,
        showError: mockFactory.getMocks().showError
      })
    }));
    
    // Render component and trigger action
    render(<SaveButton />);
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);
    
    // Verify notification was shown
    const { showSuccess } = mockFactory.getMocks();
    expect(showSuccess).toHaveBeenCalledWith('Saved successfully');
  });
});
```

### Test-Specific Hook Implementations

Create controlled implementations of complex hooks for more predictable testing:

```tsx
import { useNotification } from '@/hooks/useNotification';

// Original hook implementation
function useSettings() {
  const { data, isLoading } = trpc.settings.get.useQuery();
  const { mutateAsync } = trpc.settings.update.useMutation();
  
  const updateSettings = async (newSettings) => {
    // Complex implementation
  };
  
  return { settings: data, isLoading, updateSettings };
}

// Test-specific implementation
function useSettingsTestImpl() {
  const { showSuccess, showError } = useNotification();
  const [settings, setSettings] = useState(defaultSettings);
  
  const updateSettings = jest.fn().mockImplementation(async (newSettings) => {
    try {
      setSettings({ ...settings, ...newSettings });
      showSuccess('Settings updated');
      return true;
    } catch (error) {
      showError('Failed to update settings');
      return false;
    }
  });
  
  return {
    settings,
    isLoading: false,
    updateSettings
  };
}

// Mock the hook in tests
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => useSettingsTestImpl()
}));
```

### Safe Null/Undefined Handling

Use the safeProp utility or nullish coalescing operator to handle null/undefined values:

```tsx
import { safeProp } from '@/test/utils/testPatterns';

// In component code
<TextInput
  value={value ?? ''}
  onChange={handleChange}
/>

// In tests
test('renders with null values', () => {
  render(
    <Component 
      value={safeProp(null, '')} 
      color={safeProp(undefined, 'default')}
    />
  );
  
  // Component should render without warnings
});
```

### TRPC Mock Implementation

Use the createTrpcTestHook utility for consistent TRPC mocking:

```tsx
import { createTrpcTestHook } from '@/test/utils/testPatterns';

// Create mock data
const mockManga = { id: 1, title: 'Test Manga' };

// Mock the TRPC client
jest.mock('@/utils/trpcClient', () => ({
  trpc: {
    manga: {
      detail: createTrpcTestHook(mockManga),
      update: createTrpcTestHook(null, { isLoading: false })
    }
  }
}));

// Test component that uses TRPC
test('displays manga details', () => {
  render(<MangaDetails id={1} />);
  expect(screen.getByText('Test Manga')).toBeInTheDocument();
});
```

For additional test patterns and utilities, refer to:
- [Test Patterns Guide](../../../docs/testing-guide-unified.md)
- [Test Fixing Guide](../../../docs/test-fixing-guide.md)
- [Test Utilities README](../utils/README.md)