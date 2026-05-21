# Fix Dom Nesting Validation

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fix Dom Nesting Validation

---
# DOM Nesting Validation Fix

## Issue Description

The application was experiencing React DOM nesting validation warnings in the browser console:

```
Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>.
```

This warning occurs because HTML specifications don't allow block-level elements (`<div>`) inside paragraph elements (`<p>`). In our application, this was happening because:

1. Mantine UI's `Text` component renders as a `<p>` element by default
2. Components like `Badge`, `Box`, etc. render as `<div>` elements
3. When these components were nested inside `Text` components, it created invalid HTML structure

## Affected Components

The issue was found in the following components:

1. `src/pages/system/updates.tsx` - Badge components inside Text component
2. `src/components/events/EventsPanel.tsx` - Multiple Badge components inside Text component

## Applied Fix

The fix was simple - we added the `component="div"` prop to the Text components that contained other components:

```tsx
// Before
<Text size="sm">
  {updateInfo?.isDocker 
    ? <Badge leftSection={<IconBrandDocker size={12} />} color="blue">Docker</Badge>
    : <Badge leftSection={<IconTerminal2 size={12} />} color="gray">Local Installation</Badge>
  }
</Text>

// After
<Text size="sm" component="div">
  {updateInfo?.isDocker 
    ? <Badge leftSection={<IconBrandDocker size={12} />} color="blue">Docker</Badge>
    : <Badge leftSection={<IconTerminal2 size={12} />} color="gray">Local Installation</Badge>
  }
</Text>
```

This changes the rendered element from a `<p>` to a `<div>`, which can legally contain other `<div>` elements.

## Best Practices for Preventing DOM Nesting Issues

To prevent similar issues in the future, follow these guidelines:

1. **When using Mantine's Text component with other components inside it:**
   - Add `component="div"` to the Text component
   - Example: `<Text component="div">Content with <Badge>components</Badge></Text>`

2. **Alternatively, restructure your component hierarchy:**
   - Place Text and Badge components as siblings inside a Group or Box
   - Example: 
     ```tsx
     <Group>
       <Text>Text content</Text>
       <Badge>Badge content</Badge>
     </Group>
     ```

3. **For components that must be inline, use span-based components:**
   - Some Mantine components accept a `component` prop to change their rendered element
   - Example: `<Box component="span">Inline content</Box>`

## HTML Nesting Rules to Remember

- `<p>` elements can only contain inline elements (text, `<span>`, `<a>`, etc.)
- Block elements (`<div>`, `<section>`, etc.) cannot be placed inside `<p>` elements
- If you need to wrap block elements, use a `<div>` or other block-level container

## Related Resources

- [React DOM Nesting Validation](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)
- [HTML Element Nesting Rules](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/p)
- [Mantine Text Component](https://mantine.dev/core/text/)
