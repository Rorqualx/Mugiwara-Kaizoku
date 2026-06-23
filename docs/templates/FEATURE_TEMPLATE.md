# FEATURE_TEMPLATE

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for FEATURE_TEMPLATE

---
# [Feature/Component Name]

> **Status**: [Draft | Review | Approved]  
> **Author**: [Your Name]  
> **Last Updated**: [Date]  
> **Canonical**: [Yes/No - Is this the authoritative doc for this topic?]

## Overview

[Brief description of what this feature/component does and why it exists]

## Key Concepts

[Explain any important concepts, terminology, or background knowledge needed]

## Architecture

```typescript
// Include relevant type definitions or interfaces
interface Example {
  // ...
}
```

## Usage

### Basic Example

```typescript
// Show a simple, working example
import { Component } from '@/path/to/component';

// Usage example
```

### Advanced Usage

```typescript
// Show more complex patterns if applicable
```

## API Reference

### Props/Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| prop1 | `string` | - | Description |
| prop2 | `boolean` | `false` | Description |

### Methods/Functions

#### `functionName(param: Type): ReturnType`

Description of what this function does.

**Parameters:**
- `param` - Description of parameter

**Returns:** Description of return value

**Example:**
```typescript
const result = functionName(value);
```

## Error Handling

[Describe error scenarios and how to handle them]

```typescript
try {
  // Operation
} catch (error) {
  if (error instanceof SpecificError) {
    // Handle specific error
  }
}
```

## Best Practices

1. **Do**: [Best practice with example]
2. **Don't**: [Anti-pattern to avoid]
3. **Consider**: [Things to think about]

## Testing

[Describe how to test this component/feature]

```typescript
// Example test
describe('Component', () => {
  it('should work correctly', () => {
    // Test implementation
  });
});
```

## Migration Guide

[If replacing something, explain how to migrate]

### Before
```typescript
// Old pattern
```

### After
```typescript
// New pattern
```

## Common Issues

### Issue: [Description]
**Solution**: [How to fix]

### Issue: [Description]
**Solution**: [How to fix]

## Related Documentation

- [Link to related doc 1]
- [Link to related doc 2]
- See also: CANONICAL_DOCS.md

## Changelog

- **[Date]**: Initial documentation
- **[Date]**: [What changed]

---

**Questions?** Check CANONICAL_DOCS.md or ask in #dev-help
