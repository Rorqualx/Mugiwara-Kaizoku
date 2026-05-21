# Playwright Testing Guide for Mugiwara Kaizoku

*Status: Active*
*Author: Development Team*
*Last Updated: 2025-11-29*

## Overview

This guide documents best practices for writing Playwright tests for the Mugiwara Kaizoku manga management application, based on lessons learned from real testing sessions.

---

## Prerequisites

### Installation

```bash
# Install Playwright
pip install playwright

# Install browsers
playwright install chromium
```

### Dev Server

Ensure the development server is running before tests:

```bash
bun run dev
# Server runs at http://localhost:3000
```

---

## Authentication

**CRITICAL**: The app requires authentication for most features.

### Default Development Credentials

```python
EMAIL = 'admin@kaizoku.dev'
PASSWORD = 'admin123'
```

### Login Pattern

```python
def login(page):
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    # Fill credentials
    page.locator('input').first.fill('admin@kaizoku.dev')
    page.locator('input[type="password"]').first.fill('admin123')

    # Click sign in
    page.locator('button:has-text("Sign in")').first.click()

    # Wait for redirect to home
    try:
        page.wait_for_url('http://localhost:3000/', timeout=10000)
        print("Login successful")
    except:
        print(f"Login may have failed, current URL: {page.url}")

    page.wait_for_timeout(2000)
```

---

## App Navigation Structure

### Sidebar Links
- Home (`/`)
- Library (`/library`)
- Calendar (`/calendar`)
- Activity (`/activity`)
- Wanted (`/wanted`)
- System (`/system`)
- Settings (`/settings`)

### Library Pages
- Library list: `/library`
- Individual library: `/library/1`, `/library/2`, etc.

### Key UI Elements

| Element | Selector |
|---------|----------|
| Sidebar links | `nav a`, `aside a` |
| ActionIcon buttons | `button.mantine-ActionIcon-root` |
| Paper cards | `.mantine-Paper-root` |
| Modal | `.mantine-Modal-root`, `.mantine-Modal-body` |
| Tabs | `[role="tab"]` |
| Loader | `.mantine-Loader-root` |

---

## Common Patterns

### Waiting for Page Load

```python
# Wait for network to settle
page.wait_for_load_state('networkidle')

# Wait for loader to disappear
try:
    page.wait_for_selector('.mantine-Loader-root', state='hidden', timeout=15000)
except:
    pass

# Fixed wait (use sparingly)
page.wait_for_timeout(2000)
```

### Handling Modals

```python
# Close any open modals
page.keyboard.press('Escape')
page.wait_for_timeout(500)

# Wait for modal to open
modal = page.locator('.mantine-Modal-root')
modal.wait_for(state='visible', timeout=5000)

# Find elements within modal
modal_input = page.locator('.mantine-Modal-body input[type="text"]').first
```

### Force Clicking (When Overlays Block)

```python
# Use force=True when elements are blocked by overlays
element.click(force=True)

# Alternative: Remove overlay via JavaScript
page.evaluate("document.querySelector('.mantine-Modal-overlay')?.remove()")
```

### Clicking Toolbar Buttons

```python
# The toolbar has multiple ActionIcon buttons
toolbar_buttons = page.locator('button.mantine-ActionIcon-root').all()

# Find by title attribute
for btn in toolbar_buttons:
    title = btn.get_attribute('title')
    if title and 'add' in title.lower():
        btn.click()
        break

# Or by index (e.g., second button is usually "Add")
if len(toolbar_buttons) >= 2:
    toolbar_buttons[1].click()
```

---

## Testing the Add Manga Flow

This is the most complex flow. Here's a complete example:

```python
#!/usr/bin/env python3
from playwright.sync_api import sync_playwright

def test_add_manga():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})

        try:
            # 1. Login
            print("1. Logging in...")
            page.goto('http://localhost:3000/login')
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(2000)

            page.locator('input').first.fill('admin@kaizoku.dev')
            page.locator('input[type="password"]').first.fill('admin123')
            page.locator('button:has-text("Sign in")').first.click()
            page.wait_for_timeout(3000)

            # 2. Navigate to library
            print("2. Navigating to library...")
            page.goto('http://localhost:3000/library/1')
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(3000)

            # Close any modals
            page.keyboard.press('Escape')
            page.wait_for_timeout(500)

            # 3. Click "Add Manga" card (NOT toolbar button)
            print("3. Clicking Add Manga card...")
            add_card = page.locator('text="Add Manga"').first
            add_card.click(force=True)
            page.wait_for_timeout(2000)

            # 4. Search in modal
            print("4. Searching...")
            # The modal search has a specific placeholder
            modal_search = page.locator('input[placeholder*="Search by title"]').first
            modal_search.fill('Fire Force')
            modal_search.press('Enter')
            page.wait_for_timeout(10000)  # Wait for API

            # 5. Click result card
            print("5. Clicking result...")
            result_card = page.locator('.mantine-Paper-root:has-text("Fire Force"):has-text("ANILIST") img').first
            result_card.click()
            page.wait_for_timeout(5000)

            # 6. Wizard should open automatically
            print("6. Waiting for wizard...")
            page.wait_for_timeout(15000)  # Wait for metadata APIs

            # 7. Take screenshot
            page.screenshot(path='/tmp/wizard_result.png', full_page=True)
            print("Screenshot saved!")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path='/tmp/error.png', full_page=True)
        finally:
            browser.close()

if __name__ == "__main__":
    test_add_manga()
```

---

## Selector Best Practices

### DO Use

```python
# Specific placeholders
page.locator('input[placeholder*="Search by title"]')

# Text content with provider
page.locator('.mantine-Paper-root:has-text("Fire Force"):has-text("ANILIST")')

# Role-based selectors
page.locator('[role="tab"]:has-text("Wikipedia")')

# Mantine component classes
page.locator('.mantine-Modal-body input')
page.locator('button.mantine-ActionIcon-root')
```

### AVOID

```python
# Generic selectors that match too many elements
page.locator('input')  # Too broad
page.locator('button')  # Too broad

# Regex in comma-separated selectors (causes errors)
page.locator('text=/pattern/i, text="other"')  # Will fail
```

---

## Debugging Tips

### Take Screenshots Frequently

```python
page.screenshot(path='/tmp/step_01.png', full_page=True)
```

### Print Visible Elements

```python
# List all buttons
buttons = page.locator('button:visible').all()
for btn in buttons:
    try:
        text = btn.inner_text().strip()
        if text:
            print(f"Button: {text[:40]}")
    except:
        pass

# Check current URL
print(f"Current URL: {page.url}")
```

### Check for Error Messages

```python
error_text = page.locator('text="Failed to load"').first
if error_text.is_visible():
    print("ERROR: Page failed to load")
```

---

## Common Issues & Solutions

### Issue: "Modal overlay intercepting pointer events"

**Solution**: Use `force=True` or close modals first

```python
element.click(force=True)
# OR
page.keyboard.press('Escape')
page.wait_for_timeout(500)
```

### Issue: "Strict mode violation - multiple elements found"

**Solution**: Use `.first` or more specific selectors

```python
# Instead of
page.locator('.mantine-Modal-root')

# Use
page.locator('.mantine-Modal-root').first
# OR
page.locator('.mantine-Modal-root:has-text("Search for Manga")')
```

### Issue: Login not working

**Solution**: Check credentials and wait for redirect

```python
# Correct credentials
EMAIL = 'admin@kaizoku.dev'  # NOT admin@example.com
PASSWORD = 'admin123'

# Wait for redirect
page.wait_for_url('http://localhost:3000/', timeout=10000)
```

### Issue: Search input types in wrong field

**Solution**: Use specific placeholder selector

```python
# Header search has placeholder "Search your library..."
# Modal search has placeholder "Search by title, anilist:ID..."

modal_search = page.locator('input[placeholder*="Search by title"]').first
```

### Issue: Elements not found after navigation

**Solution**: Wait for loaders and network

```python
page.wait_for_load_state('networkidle')
try:
    page.wait_for_selector('.mantine-Loader-root', state='hidden', timeout=15000)
except:
    pass
page.wait_for_timeout(2000)
```

---

## Test File Location

Place test scripts in `/tmp/` for quick iteration or in `tests/e2e/` for permanent tests:

```
tests/
└── e2e/
    ├── add-manga.spec.py
    ├── library-navigation.spec.py
    └── search-providers.spec.py
```

---

## Running Tests

```bash
# Run a single test
python3 /tmp/test_add_manga.py

# Run with headed browser (visible)
# Set headless=False in script

# Run headless (CI/CD)
# Set headless=True in script
```

---

## Quick Reference

| Action | Code |
|--------|------|
| Login | See login pattern above |
| Navigate | `page.goto('http://localhost:3000/library/1')` |
| Wait for load | `page.wait_for_load_state('networkidle')` |
| Click card | `page.locator('text="Add Manga"').first.click(force=True)` |
| Search modal input | `page.locator('input[placeholder*="Search by title"]').first` |
| Click result | `page.locator('.mantine-Paper-root:has-text("Title")').first.click()` |
| Wait for API | `page.wait_for_timeout(10000)` |
| Screenshot | `page.screenshot(path='/tmp/test.png', full_page=True)` |
| Close modal | `page.keyboard.press('Escape')` |

---

## Related Documentation

- [Testing Guide](./testing-guide.md) - General testing practices
- [Development Rules](../development/DEVELOPMENT_RULES.md) - Code standards
- [Architecture Overview](../architecture/architecture-overview.md) - App structure

---

*Last Updated: 2025-11-29*
