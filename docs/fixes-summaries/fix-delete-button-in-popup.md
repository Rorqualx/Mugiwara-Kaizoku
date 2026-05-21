# Fix Delete Button In Popup

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fix Delete Button In Popup

---
# Fix for Delete Button in Manga Update Popup

## Issue Description

The delete button in the manga update popup had two issues:

1. When clicked, it was submitting the form instead of triggering the delete action. This was because the button was inside a form element without a `type="button"` attribute, causing it to default to `type="submit"`.

2. The confirmation dialog was not appearing because there was a conflict between the two modal systems being used:
   - The main update form was using `useClientModal` from `src/hooks/useClientModal.ts`
   - The delete confirmation was using `useModals` directly from `@mantine/modals`

## Solution

The issue was fixed with two changes:

1. Added the `type="button"` attribute to the delete button in the `UpdateForm.tsx` component to prevent form submission:

```tsx
<Button 
  variant="filled" 
  color="red" 
  leftSection={<IconTrash size={16} />}
  onClick={openRemoveModal}
  type="button" // Added this line to prevent form submission
>
  Delete
</Button>
```

2. Modified the `useRemoveModal` hook to accept an optional `parentModals` parameter and pass the same modal system from the parent component:

```tsx
// In removeManga.tsx
export const useRemoveModal = (
  title: string,
  onRemove: (shouldRemoveFiles: boolean) => void,
  parentModals?: any // Accept optional parentModals parameter
) => {
  // Use parentModals if provided, otherwise use the default modals
  const defaultModals = useModals();
  const modals = parentModals || defaultModals;
  
  // ...
}

// In UpdateForm.tsx
// Get the modals instance
const modals = useModals();
  
// Create the remove modal hook and pass the modals instance
const openRemoveModal = useRemoveModal(manga.title, handleRemoveManga, modals);
```

## Implementation Details

1. The delete button in the `UpdateForm.tsx` component was modified to include the `type="button"` attribute.
2. The button uses the `openRemoveModal` function from the `useRemoveModal` hook to open a confirmation dialog.
3. When confirmed, the `handleRemoveManga` function is called to delete the manga.
4. After deletion, the user is redirected to the home page.

## Testing

A test script was created to verify the fix: `scripts/test-delete-button.mjs`

You can run the test script with:

```bash
node scripts/test-delete-button.mjs
```

The script checks for:
- The delete button has the `type="button"` attribute
- The delete button uses the `openRemoveModal` function
- The `handleRemoveManga` function is implemented
- The `useRemoveModal` hook is imported

### Manual Testing

To test the fix manually:

1. Open any manga's edit popup by clicking the edit icon in the library
2. Click the Delete button
3. Confirm the deletion in the confirmation dialog
4. Verify that the manga is deleted and you are redirected to the home page

## Related Components

- `src/components/updateManga/UpdateForm.tsx` - The form component that contains the delete button
- `src/components/removeManga.tsx` - The component that provides the `useRemoveModal` hook for the delete confirmation dialog
