# Event Handler Type Safety Guide

This document outlines best practices for implementing type-safe event handlers in React components within the Mugiwara-Kaizoku project. These patterns help ensure proper type checking, improve code quality, and prevent runtime errors.

## Common Event Handler Types

React provides specific event types for different DOM events. Here's a reference for the most common event handler types:

| Event Type | TypeScript Type | Common Usage |
|------------|----------------|--------------|
| Click events | `React.MouseEvent<HTMLButtonElement \| HTMLDivElement \| etc>` | Button clicks, div clicks |
| Form submission | `React.FormEvent<HTMLFormElement>` | Form onSubmit handlers |
| Input changes | `React.ChangeEvent<HTMLInputElement \| HTMLTextAreaElement \| HTMLSelectElement>` | Input value changes |
| Keyboard events | `React.KeyboardEvent<HTMLInputElement \| HTMLDivElement \| etc>` | Key press/down/up handlers |
| Focus events | `React.FocusEvent<HTMLInputElement \| HTMLDivElement \| etc>` | onFocus, onBlur handlers |
| Drag events | `React.DragEvent<HTMLDivElement \| etc>` | Drag and drop functionality |

## Type-Safe Event Handler Patterns

### 1. Form Submission Handlers

```typescript
// Generic approach (avoid this)
const handleSubmit = (event: any) => {
  event.preventDefault();
  // Handler logic
};

// Better approach
const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
  event.preventDefault();
  // Handler logic
};

// Best approach (with useCallback for optimization)
const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement>): void => {
  event.preventDefault();
  // Handler logic
}, [dependencies]);
```

### 2. Input Change Handlers

```typescript
// Avoid this pattern
const handleChange = (event) => {
  setValue(event.target.value);
};

// Better approach
const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
  setValue(event.currentTarget.value);
};

// For select elements
const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
  setValue(event.currentTarget.value);
};
```

### 3. Mantine Component Handlers

Many Mantine components provide direct value handlers rather than event objects:

```typescript
// MultiSelect component
const handleMultiSelectChange = (selectedValues: string[]): void => {
  setFormState(prevState => ({
    ...prevState,
    selectedItems: selectedValues
  }));
};

// Select component 
const handleSelectChange = (value: string | null): void => {
  setFormState(prevState => ({
    ...prevState,
    selectedOption: value ?? defaultValue
  }));
};
```

### 4. Checkbox Change Handlers

```typescript
const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
  setFormState(prevState => ({
    ...prevState,
    isChecked: event.currentTarget.checked
  }));
};
```

## Recent Fixes Applied

In our recent TypeScript improvements, we've addressed several event handler typing issues:

### 1. Fixed Form Event Type in SearchForm.tsx

```typescript
// Before
const handleSubmit = useCallback((event: FormEvent): void => {
  event.preventDefault();
  triggerSearch();
}, [triggerSearch]);

// After
const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>): void => {
  event.preventDefault();
  triggerSearch();
}, [triggerSearch]);
```

### 2. Improved Null Handling in Select Handlers

```typescript
// Before - Potential logical error with || operator
const handleSortByChange = useCallback((value: string | null): void => {
  setFormState(prevState => ({
    ...prevState,
    sortBy: value as SortCriteria || SortCriteria.RELEVANCE
  }));
}, []);

// After - Safer handling with nullish coalescing
const handleSortByChange = useCallback((value: string | null): void => {
  setFormState(prevState => ({
    ...prevState,
    sortBy: (value as SortCriteria) ?? SortCriteria.RELEVANCE
  }));
}, []);
```

## Best Practices

1. **Always Type Event Parameters**: Never use `any` or omit types for event parameters.

2. **Use Specific Event Types**: Match the event type to the actual event (e.g., `MouseEvent` for clicks, `ChangeEvent` for input changes).

3. **Specify Element Generic**: Include the element type in the generic parameter (e.g., `ChangeEvent<HTMLInputElement>`).

4. **Prefer `currentTarget` Over `target`**: Use `event.currentTarget` instead of `event.target` for more reliable type checking.

5. **Use Nullish Coalescing**: When handling potentially null values from controlled components, use `??` instead of `||` for safer default value assignment.

6. **Wrap With useCallback**: Optimize event handlers with `useCallback` to prevent unnecessary re-renders.

7. **Include Return Type Annotations**: Add `: void` return type annotations to event handlers for clarity.

## Anti-Patterns to Avoid

1. ❌ **Generic Event Types**: Avoid using `React.SyntheticEvent` when a more specific type is appropriate.

2. ❌ **Type Assertions Without Checks**: Don't use type assertions (`as EventType`) without proper validation.

3. ❌ **Logical OR for Defaults**: Avoid using `||` for default values as it treats empty strings, 0, and false as falsy.

4. ❌ **Inline Anonymous Functions**: Prefer named functions with proper type annotations over inline anonymous functions.

## Implementing These Patterns

When implementing or modifying event handlers in React components:

1. Identify the event type (form submission, input change, click, etc.)
2. Use the appropriate React event type with the correct element generic
3. Implement proper null/undefined handling with nullish coalescing (`??`)
4. Add return type annotations for clarity
5. Optimize with `useCallback` when appropriate

These practices will help maintain type safety and prevent common runtime errors related to event handling in React components.