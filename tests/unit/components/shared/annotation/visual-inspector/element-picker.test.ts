/**
 * Element Picker Unit Tests
 *
 * Tests for the interactive element picker utility.
 */

import { JSDOM } from 'jsdom';

import {
  createElementPicker,
  type ElementPickerConfig
} from '@/components/shared/annotation/visual-inspector/element-picker';

// Setup JSDOM with script execution for event testing
function createTestDocument(html: string): Document {
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  return dom.window.document;
}

describe('element-picker', () => {
  describe('createElementPicker', () => {
    it('should create overlay and tooltip elements', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div class="content">Test Content</div>
          </body>
        </html>
      `);

      const config: ElementPickerConfig = {
        onElementSelected: jest.fn()
      };

      const cleanup = createElementPicker(doc, config);

      // Check overlay was created
      const overlay = doc.getElementById('element-picker-overlay');
      expect(overlay).not.toBeNull();

      // Check tooltip was created
      const tooltip = doc.getElementById('element-picker-tooltip');
      expect(tooltip).not.toBeNull();

      // Cleanup
      cleanup();
    });

    it('should remove elements on cleanup', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div>Content</div>
          </body>
        </html>
      `);

      const config: ElementPickerConfig = {
        onElementSelected: jest.fn()
      };

      const cleanup = createElementPicker(doc, config);

      // Elements should exist
      expect(doc.getElementById('element-picker-overlay')).not.toBeNull();
      expect(doc.getElementById('element-picker-tooltip')).not.toBeNull();

      // Cleanup
      cleanup();

      // Elements should be removed
      expect(doc.getElementById('element-picker-overlay')).toBeNull();
      expect(doc.getElementById('element-picker-tooltip')).toBeNull();
    });

    it('should call onElementSelected when element is clicked', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div class="clickable">Click me</div>
          </body>
        </html>
      `);

      const onElementSelected = jest.fn();
      const config: ElementPickerConfig = {
        onElementSelected
      };

      const cleanup = createElementPicker(doc, config);

      // Simulate click on element
      const element = doc.querySelector('.clickable');
      if (element) {
        const clickEvent = new doc.defaultView!.MouseEvent('click', {
          bubbles: true,
          cancelable: true
        });
        element.dispatchEvent(clickEvent);
      }

      // Should have called onElementSelected
      expect(onElementSelected).toHaveBeenCalledTimes(1);
      expect(onElementSelected).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object)
      );

      cleanup();
    });

    it('should call onCancel when ESC is pressed', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div>Content</div>
          </body>
        </html>
      `);

      const onCancel = jest.fn();
      const config: ElementPickerConfig = {
        onElementSelected: jest.fn(),
        onCancel,
        enableKeyboard: true
      };

      const cleanup = createElementPicker(doc, config);

      // Simulate ESC key press
      const keyEvent = new doc.defaultView!.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });
      doc.dispatchEvent(keyEvent);

      // Should have called onCancel
      expect(onCancel).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('should use custom highlight color', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div>Content</div>
          </body>
        </html>
      `);

      const customColor = '#ff0000';
      const config: ElementPickerConfig = {
        onElementSelected: jest.fn(),
        highlightColor: customColor
      };

      const cleanup = createElementPicker(doc, config);

      const overlay = doc.getElementById('element-picker-overlay');
      expect(overlay).not.toBeNull();

      if (overlay) {
        expect(overlay.style.cssText).toContain(customColor);
      }

      cleanup();
    });

    it('should not call onCancel when keyboard is disabled', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div>Content</div>
          </body>
        </html>
      `);

      const onCancel = jest.fn();
      const config: ElementPickerConfig = {
        onElementSelected: jest.fn(),
        onCancel,
        enableKeyboard: false
      };

      const cleanup = createElementPicker(doc, config);

      // Simulate ESC key press
      const keyEvent = new doc.defaultView!.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });
      doc.dispatchEvent(keyEvent);

      // Should NOT have called onCancel (keyboard disabled)
      expect(onCancel).not.toHaveBeenCalled();

      cleanup();
    });

    it('should ignore clicks on overlay and tooltip elements', () => {
      const doc = createTestDocument(`
        <html>
          <body>
            <div>Content</div>
          </body>
        </html>
      `);

      const onElementSelected = jest.fn();
      const config: ElementPickerConfig = {
        onElementSelected
      };

      const cleanup = createElementPicker(doc, config);

      // Try clicking on the overlay
      const overlay = doc.getElementById('element-picker-overlay');
      if (overlay) {
        const clickEvent = new doc.defaultView!.MouseEvent('click', {
          bubbles: true,
          cancelable: true
        });
        overlay.dispatchEvent(clickEvent);
      }

      // Should NOT have called onElementSelected for overlay click
      expect(onElementSelected).not.toHaveBeenCalled();

      cleanup();
    });
  });
});
