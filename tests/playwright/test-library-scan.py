#!/usr/bin/env python3
"""
Playwright test for library scanning feature.
Tests that Start Scan button works and triggers backend job.
"""

import os

from playwright.sync_api import sync_playwright
import time

# Auth credentials from playwright-guide.md
EMAIL = 'admin@kaizoku.dev'
PASSWORD = 'admin123'

# Library path to scan during the test. Override with TEST_LIBRARY_PATH env
# var to point at your own seeded manga directory.
TEST_LIBRARY_PATH = os.environ.get('TEST_LIBRARY_PATH', '/data/manga')

def login(page):
    """Login to the app using default dev credentials"""
    print("Logging in...")
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    # Fill credentials
    page.locator('input').first.fill(EMAIL)
    page.locator('input[type="password"]').first.fill(PASSWORD)

    # Click sign in
    page.locator('button:has-text("Sign in")').first.click()

    # Wait for redirect to home
    try:
        page.wait_for_url('http://localhost:3000/', timeout=10000)
        print("   Login successful")
    except:
        print(f"   Login may have failed, current URL: {page.url}")

    page.wait_for_timeout(2000)

def test_library_scan():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})

        # Enable console logging for errors
        page.on("console", lambda msg: print(f"[{msg.type.upper()}] {msg.text}") if msg.type == "error" else None)

        try:
            # 1. Login first
            login(page)

            # 2. Navigate to Settings > Library
            print("Navigating to Settings > Library...")
            page.goto('http://localhost:3000/settings/library')
            page.wait_for_load_state('networkidle')
            page.wait_for_timeout(2000)

            page.screenshot(path='/tmp/library-scan-01-page-loaded.png', full_page=True)
            print("   Screenshot: /tmp/library-scan-01-page-loaded.png")

            # 3. Select library - click on the dropdown input
            print("Selecting library...")
            # Find the Target Library section and click on the input/button
            target_section = page.locator('text=Target Library').first
            # The dropdown is usually the next sibling or nearby input
            dropdown_input = page.locator('.mantine-Select-input, [role="combobox"]').first

            if dropdown_input.count() > 0:
                dropdown_input.click()
                page.wait_for_timeout(500)

                # Look for Development Library in the dropdown options
                page.screenshot(path='/tmp/library-scan-02-dropdown-open.png', full_page=True)

                # Click the option
                option = page.locator('[role="option"]:has-text("Development Library"), .mantine-Select-option:has-text("Development Library")')
                if option.count() > 0:
                    option.first.click(force=True)
                    page.wait_for_timeout(500)
                    print("   Selected 'Development Library'")
                else:
                    # Try clicking any visible option
                    any_option = page.locator('[role="option"]').first
                    if any_option.count() > 0:
                        any_option.click(force=True)
                        page.wait_for_timeout(500)
                        print("   Selected first available library")
                    else:
                        print("   No dropdown options found")
            else:
                print("   Dropdown not found")

            page.screenshot(path='/tmp/library-scan-03-library-selected.png', full_page=True)

            # 4. Check "Enter path manually" checkbox
            print("Enabling manual path entry...")
            checkbox_label = page.locator('text=Enter path manually')
            if checkbox_label.count() > 0:
                # Click the checkbox (usually the label or input near it)
                checkbox_label.click()
                page.wait_for_timeout(500)
                print("   Clicked 'Enter path manually'")

            page.screenshot(path='/tmp/library-scan-04-checkbox-clicked.png', full_page=True)

            # 5. Fill the scan directory path
            print("Entering scan path...")
            # The Scan Directory input might be a Mantine TextInput
            # Try multiple selectors to find it

            # Debug: print all inputs
            all_inputs = page.locator('input').all()
            print(f"   Found {len(all_inputs)} total inputs")
            for i, inp in enumerate(all_inputs):
                try:
                    val = inp.input_value()
                    inp_type = inp.get_attribute('type') or 'unknown'
                    is_visible = inp.is_visible()
                    print(f"   Input {i}: type={inp_type}, value='{val[:20]}', visible={is_visible}")
                except Exception as e:
                    print(f"   Input {i}: error - {e}")

            # Find the path input - it should have "/" as value and be visible
            path_filled = False
            for i, inp in enumerate(all_inputs):
                try:
                    if inp.is_visible():
                        val = inp.input_value()
                        inp_type = inp.get_attribute('type') or ''
                        # Skip checkboxes and hidden inputs
                        if inp_type in ['checkbox', 'hidden', 'password']:
                            continue
                        # Look for the input with "/" value
                        if val == '/' or val == '':
                            # Check if it's in the Scan Directory section by looking at nearby text
                            parent_text = inp.locator('xpath=ancestor::*[contains(@class, "mantine")]').first
                            print(f"   Trying input {i} with value '{val}'")
                            inp.click()
                            inp.clear()
                            inp.fill(TEST_LIBRARY_PATH)
                            page.wait_for_timeout(300)
                            new_val = inp.input_value()
                            if new_val == TEST_LIBRARY_PATH:
                                print(f"   Path entered successfully: {new_val}")
                                path_filled = True
                                break
                            else:
                                print(f"   Input didn't accept value, got: {new_val}")
                except Exception as e:
                    print(f"   Error with input {i}: {e}")

            if not path_filled:
                # Last resort: try clicking directly on the visible text input in the form
                print("   Trying fallback: click on visible input near 'Scan Directory'")
                scan_input = page.locator('.mantine-TextInput-input').first
                if scan_input.count() > 0:
                    scan_input.click()
                    scan_input.fill(TEST_LIBRARY_PATH)
                    print("   Filled via .mantine-TextInput-input")

            page.wait_for_timeout(500)
            page.screenshot(path='/tmp/library-scan-05-form-filled.png', full_page=True)

            # 6. Click Start Scan button
            print("Looking for Start Scan button...")
            scan_button = page.locator('button:has-text("Start Scan")')

            if scan_button.count() > 0:
                scan_button.first.scroll_into_view_if_needed()
                is_disabled = scan_button.first.is_disabled()
                button_text = scan_button.first.inner_text()
                print(f"   Button text: '{button_text}', disabled: {is_disabled}")

                page.screenshot(path='/tmp/library-scan-06-button-visible.png', full_page=True)

                if not is_disabled:
                    # Click Start Scan
                    print("Clicking Start Scan...")
                    scan_button.first.click()
                    page.wait_for_timeout(2000)

                    page.screenshot(path='/tmp/library-scan-07-after-click.png', full_page=True)

                    # Check button state changed
                    new_button = page.locator('button:has-text("Start Scan"), button:has-text("Scanning")')
                    if new_button.count() > 0:
                        new_button_text = new_button.first.inner_text()
                        print(f"   Button text after click: '{new_button_text}'")

                    # 7. Wait for progress updates
                    print("Waiting for scan progress...")
                    for i in range(15):
                        page.wait_for_timeout(2000)

                        # Check scan status text
                        status_text = page.locator('text=Scan Status').first
                        if status_text.count() > 0:
                            parent = status_text.locator('xpath=..')
                            full_text = parent.inner_text() if parent.count() > 0 else ""
                            print(f"   Progress {i}: {full_text[:100]}...")

                        page.screenshot(path=f'/tmp/library-scan-progress-{i:02d}.png', full_page=True)

                        # Check for completion
                        if page.locator('text=completed').count() > 0 or page.locator('text=Idle').count() > 0:
                            print("   Scan appears completed!")
                            break
                else:
                    print("   Button is disabled - checking form state...")
                    # Debug: check what's missing
                    library_val = page.locator('.mantine-Select-input').first.input_value() if page.locator('.mantine-Select-input').count() > 0 else "N/A"
                    print(f"   Library value: '{library_val}'")

                    for i, inp in enumerate(all_text_inputs[:5]):
                        try:
                            val = inp.input_value()
                            print(f"   Input {i}: '{val[:50]}'")
                        except:
                            pass
            else:
                print("   Start Scan button not found!")

            # Final screenshot
            page.screenshot(path='/tmp/library-scan-final.png', full_page=True)
            print("\nTest complete! Screenshots in /tmp/library-scan-*.png")

        except Exception as e:
            print(f"\nError: {e}")
            page.screenshot(path='/tmp/library-scan-error.png', full_page=True)
            raise
        finally:
            page.wait_for_timeout(3000)  # Keep browser open to see result
            browser.close()

if __name__ == "__main__":
    test_library_scan()
