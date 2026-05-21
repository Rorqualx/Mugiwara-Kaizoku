# Components

This directory contains all React components used in the Mugiwara-Kaizoku manga management application. These components make up the user interface and handle user interactions.

## Purpose

The components directory serves as the presentation layer of the application. It contains UI components ranging from simple reusable elements to complex feature-specific components. These components are responsible for:

1. Rendering the user interface
2. Handling user interactions
3. Displaying data from the application state
4. Triggering state changes through hooks and actions

## Directory Structure

The components are organized into feature-specific subdirectories:

- `/addManga` - Components for adding manga to the library
- `/auth` - Authentication-related components
- `/events` - Event system display components
- `/library` - Library management components
- `/manga` - Manga display and management components
- `/metadata` - Metadata display and editing components
- `/search` - Search functionality components
- `/settings` - Application settings components
- `/system` - System management components
- `/ui` - Shared UI components
- `/updateManga` - Components for updating manga information

## Key Files

### Core Components
- `MangaList.tsx` - Displays a list of manga
- `MangaDetail.tsx` - Displays detailed information about a manga
- `chaptersTable.tsx` - Displays and manages manga chapters
- `navbar.tsx` - Main navigation component

### Feature-Specific Components
- `addManga/AddMangaModal.tsx` - Modal for adding new manga
- `metadata/RefreshMetadataButton.tsx` - Button to refresh metadata
- `search/SearchForm.tsx` - Form for searching manga
- `settings/MetadataProvidersGrid.tsx` - Grid displaying metadata providers

### Layout Components
- `layouts/MainLayout.tsx` - Main application layout
- `layouts/SettingsLayout.tsx` - Layout for settings pages
- `layouts/AuthLayout.tsx` - Layout for authentication pages

## Design Patterns

### Container/Presenter Pattern

Many components follow the container/presenter pattern:

- **Container components** handle data fetching and state management
- **Presenter components** focus on rendering and UI interactions

Example:
```typescript
// Container Component
function SearchContainer(props) {
  const [results, setResults] = useState([]);
  const { isLoading, search } = useSearch();
  
  // Data fetching logic
  
  return <SearchResults results={results} isLoading={isLoading} />;
}

// Presenter Component
function SearchResults({ results, isLoading }) {
  // UI rendering only
  return (
    <div>
      {isLoading ? <Spinner /> : results.map(item => <ResultItem item={item} />)}
    </div>
  );
}
```

### Component Composition

Components are designed to be composable, with smaller components combined to create more complex UIs.

## Usage

Components use TypeScript with explicit prop interfaces for type safety:

```typescript
interface MangaCardProps {
  manga: MangaEntity;
  onSelect: (manga: MangaEntity) => void;
  isSelected?: boolean;
}

function MangaCard({ manga, onSelect, isSelected = false }: MangaCardProps) {
  // Component implementation
}
```

## State Management

Components typically manage state using:

1. **Local state** with `useState` for component-specific state
2. **Custom hooks** for reusable state logic
3. **Global state** through stores for application-wide state

## Error Handling

Components use error boundaries to catch and display errors:

```typescript
<ErrorBoundary fallback={<ErrorMessage />}>
  <ComplexComponent />
</ErrorBoundary>
```

## Testing

Test components using:

1. Unit tests with React Testing Library
2. Component snapshots
3. Integration tests for component interactions

Example test command:
```bash
npm run test -- --testPathPattern=components
```

## Styling

Components use a combination of:

1. CSS modules (e.g., `chaptersTable.module.css`)
2. Mantine UI components for consistent styling
3. Inline styles for dynamic styling