#!/usr/bin/env node

const fs = require('fs');

// Fix searchStep.tsx
const searchStepPath = 'src/components/addManga/steps/searchStep.tsx';
if (fs.existsSync(searchStepPath)) {
  let code = fs.readFileSync(searchStepPath, 'utf8');
  // These don't have .loading property at all - they use isLoading
  code = code.replace(/\.loading\b/g, '.isLoading');
  fs.writeFileSync(searchStepPath, code);
  console.log(`✓ Fixed searchStep.tsx`);
}

// Fix CalendarListView - remove isLoading from props destructuring
const calendarPath = 'src/components/calendar/CalendarListView.tsx';
if (fs.existsSync(calendarPath)) {
  let code = fs.readFileSync(calendarPath, 'utf8');
  // Find the props destructuring and remove isLoading
  code = code.replace(/(\{[^}]*),?\s*isLoading\s*,?([^}]*\})/g, '$1$2');
  // Clean up any double commas
  code = code.replace(/,\s*,/g, ',');
  // Clean up trailing commas before }
  code = code.replace(/,\s*\}/g, '}');
  fs.writeFileSync(calendarPath, code);
  console.log(`✓ Fixed CalendarListView`);
}

// Fix store selectors - already tried to fix, let's be more specific
const selectorsPath = 'src/store/useStoreSelectors.ts';
if (fs.existsSync(selectorsPath)) {
  let code = fs.readFileSync(selectorsPath, 'utf8');
  // Replace specific instances
  code = code.replace(/state\.ui\.forms\.loading/g, 'state.ui.forms.isLoading');
  fs.writeFileSync(selectorsPath, code);
  console.log(`✓ Fixed store selectors`);
}

// Fix test setup - remove duplicate _loading declarations
const setupPath = 'src/test/setup.ts';
if (fs.existsSync(setupPath)) {
  let code = fs.readFileSync(setupPath, 'utf8');
  // Find and fix the duplicate _loading issue on lines 768-769
  // This is in the Button component mock
  code = code.replace(
    /const \{ leftSection: _leftSection, rightSection: _rightSection, fullWidth: _fullWidth, variant: _variant, grow: _grow, _loading: _loading, \.\.\./g,
    'const { leftSection: _leftSection, rightSection: _rightSection, fullWidth: _fullWidth, variant: _variant, grow: _grow, ...'
  );
  // Also remove loading: _loading from the destructuring since we renamed it
  code = code.replace(/Button: \(\{ children, _loading, /g, 'Button: ({ children, loading: _loading, ');
  
  fs.writeFileSync(setupPath, code);
  console.log(`✓ Fixed test setup`);
}

console.log('\n✅ Last errors fixed!');
