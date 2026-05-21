# Robust Rectangle Selection Implementation Plan

**Goal**: 100% accuracy in selecting all text-containing elements within a rectangle selection.

**Current Problem**: Allowlist approach misses unlisted element types and the "leaf element" check skips parents with nested children.

---

## Phase 1: Denylist-Based Element Collection

### 1.1 Replace Allowlist with Denylist

**Current (Fragile):**
```javascript
var textElementSelectors = 'p, span, td, th, li, h1, h2, h3, h4, h5, h6, a, label, dt, dd, figcaption, caption, blockquote';
```

**New (Robust):**
```javascript
// Elements that NEVER contain displayable text
var NON_TEXT_ELEMENTS = [
  // Metadata/Script elements
  'script', 'style', 'noscript', 'template', 'meta', 'link', 'head', 'title',
  // Media elements (handle separately)
  'img', 'video', 'audio', 'canvas', 'svg', 'picture', 'source', 'track',
  // Form inputs (value handled separately)
  'input', 'select', 'textarea', 'button', 'option', 'optgroup',
  // Embedded content
  'iframe', 'embed', 'object', 'portal',
  // Structural/non-text
  'br', 'hr', 'wbr', 'col', 'colgroup',
  // Tables structure (content is in td/th)
  'table', 'thead', 'tbody', 'tfoot', 'tr'
];

var DENYLIST_SELECTOR = NON_TEXT_ELEMENTS.join(',');
```

### 1.2 New Collection Algorithm

```javascript
function collectElementsInRectangle() {
  var bounds = getSelectionBounds();
  var allElements = document.body.getElementsByTagName('*');
  var candidates = [];
  var seenTexts = new Set(); // Dedupe by text content

  for (var i = 0; i < allElements.length; i++) {
    var el = allElements[i];

    // Skip denied elements
    if (isElementDenied(el)) continue;

    // Skip invisible elements
    if (!isElementVisible(el)) continue;

    // Check intersection with rectangle
    var rect = el.getBoundingClientRect();
    if (!rectsIntersect(bounds, rect)) continue;

    // Must have text content
    var text = getDirectTextContent(el);
    if (!text || text.trim().length === 0) continue;

    // Dedupe: prefer deepest element for same text
    var textKey = text.trim();
    if (!seenTexts.has(textKey)) {
      seenTexts.add(textKey);
      candidates.push(el);
    }
  }

  // Sort by DOM depth (deepest first) for precise selection
  candidates.sort(function(a, b) {
    return getElementDepth(b) - getElementDepth(a);
  });

  return candidates;
}
```

---

## Phase 2: Visibility and Intersection Checks

### 2.1 Robust Visibility Check

```javascript
function isElementVisible(el) {
  // Check computed styles
  var style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) === 0) return false;

  // Check dimensions
  var rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  // Check if in viewport (or at least has position)
  if (rect.top === 0 && rect.left === 0 && rect.bottom === 0 && rect.right === 0) return false;

  return true;
}
```

### 2.2 Denylist Check

```javascript
function isElementDenied(el) {
  var tagName = el.tagName.toLowerCase();
  return NON_TEXT_ELEMENTS.indexOf(tagName) !== -1;
}
```

### 2.3 Direct Text Content (Exclude Nested Element Text)

```javascript
function getDirectTextContent(el) {
  // Get only the text directly in this element, not from children
  var text = '';
  for (var i = 0; i < el.childNodes.length; i++) {
    var node = el.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.nodeValue || '';
    }
  }
  return text;
}

// OR: Get all text but only if this is the deepest container
function getLeafTextContent(el) {
  // If element has no element children, get all textContent
  if (el.children.length === 0) {
    return el.textContent || '';
  }
  // Otherwise, get only direct text nodes
  return getDirectTextContent(el);
}
```

---

## Phase 3: Smart Deduplication

### 3.1 Problem: Parent/Child Double Selection

When user selects:
```html
<td>
  <a href="...">Romance Dawn</a>
</td>
```

Both `<td>` and `<a>` contain "Romance Dawn". We need to choose ONE.

### 3.2 Solution: Deepest-Element-First Strategy

```javascript
function deduplicateElements(elements) {
  // Sort by depth (deepest first)
  elements.sort(function(a, b) {
    return getElementDepth(b) - getElementDepth(a);
  });

  var result = [];
  var selectedNodes = new Set();

  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];

    // Check if any ancestor already selected
    var isDescendantOfSelected = false;
    var ancestor = el.parentElement;
    while (ancestor) {
      if (selectedNodes.has(ancestor)) {
        isDescendantOfSelected = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }

    // Check if any descendant already selected
    var hasSelectedDescendant = false;
    var descendants = el.querySelectorAll('*');
    for (var j = 0; j < descendants.length; j++) {
      if (selectedNodes.has(descendants[j])) {
        hasSelectedDescendant = true;
        break;
      }
    }

    // Only add if unique in the hierarchy
    if (!isDescendantOfSelected && !hasSelectedDescendant) {
      result.push(el);
      selectedNodes.add(el);
    }
  }

  return result;
}
```

---

## Phase 4: Handle Special Cases

### 4.1 Images with Alt Text

```javascript
function collectImagesInRectangle(bounds) {
  var images = [];
  document.querySelectorAll('img').forEach(function(img) {
    if (!isElementVisible(img)) return;
    var rect = img.getBoundingClientRect();
    if (!rectsIntersect(bounds, rect)) return;

    // Include if has alt text or is within selection
    var alt = img.getAttribute('alt') || '';
    images.push({
      element: img,
      type: 'image',
      alt: alt,
      src: img.src
    });
  });
  return images;
}
```

### 4.2 Ruby Text (Japanese Readings)

```javascript
// For elements like <ruby>漢字<rt>かんじ</rt></ruby>
function handleRubyElements(el) {
  if (el.tagName.toLowerCase() === 'ruby') {
    // Get base text and reading separately
    var baseText = '';
    var reading = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        baseText += node.nodeValue || '';
      } else if (node.tagName && node.tagName.toLowerCase() === 'rt') {
        reading = node.textContent || '';
      }
    }
    return { base: baseText.trim(), reading: reading.trim() };
  }
  return null;
}
```

### 4.3 Tables - Cell-Level Selection

```javascript
function collectTableCellsInRectangle(bounds) {
  var cells = [];
  document.querySelectorAll('td, th').forEach(function(cell) {
    if (!isElementVisible(cell)) return;
    var rect = cell.getBoundingClientRect();
    if (!rectsIntersect(bounds, rect)) return;

    // Get full cell content including nested elements
    var text = cell.textContent ? cell.textContent.trim() : '';
    if (text.length > 0) {
      cells.push(cell);
    }
  });
  return cells;
}
```

---

## Phase 5: Complete Implementation

### 5.1 Main Collection Function

```javascript
function collectTokensInRectangle() {
  var bounds = getSelectionBounds();
  toolSelectionState.collectedElements = [];
  toolSelectionState.collectedImages = [];

  // Strategy: Use TreeWalker for guaranteed complete traversal
  var walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: function(node) {
        // Reject denied elements and their subtrees
        if (isElementDenied(node)) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip invisible elements
        if (!isElementVisible(node)) {
          return NodeFilter.FILTER_SKIP;
        }
        // Accept elements that intersect with bounds
        var rect = node.getBoundingClientRect();
        if (rectsIntersect(bounds, rect)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  var candidates = [];
  var node;
  while ((node = walker.nextNode())) {
    // Special handling for images
    if (node.tagName === 'IMG') {
      toolSelectionState.collectedImages.push(node);
      continue;
    }

    // Get text content
    var text = getLeafTextContent(node);
    if (text && text.trim().length > 0) {
      candidates.push(node);
    }
  }

  // Deduplicate (prefer deepest elements)
  toolSelectionState.collectedElements = deduplicateElements(candidates);
}
```

---

## Phase 6: Testing & Verification

### 6.1 Test Cases

| Test Case | Expected Result |
|-----------|-----------------|
| `<div>Plain text</div>` | ✅ div selected |
| `<td><a>Link text</a></td>` | ✅ `a` selected (deepest) |
| `<p><strong>Bold</strong> normal</p>` | ✅ `strong` + direct text |
| `<ruby>漢字<rt>かんじ</rt></ruby>` | ✅ ruby with reading |
| `<img alt="Cover">` | ✅ image captured |
| `<script>code</script>` | ❌ denied |
| `<div style="display:none">Hidden</div>` | ❌ invisible |
| Deeply nested `div > div > span > text` | ✅ deepest span selected |

### 6.2 Verification Commands

```bash
# After implementation, test with Playwright
python3 /tmp/test-rectangle-all-elements.py
```

---

## Implementation Order

1. **Step 1**: Add `NON_TEXT_ELEMENTS` denylist constant
2. **Step 2**: Implement `isElementDenied()` function
3. **Step 3**: Implement `isElementVisible()` function
4. **Step 4**: Implement `getLeafTextContent()` function
5. **Step 5**: Implement `deduplicateElements()` function
6. **Step 6**: Replace `collectTokensInRectangle()` with new implementation
7. **Step 7**: Add image collection support
8. **Step 8**: Test with Playwright

---

## Success Criteria

- [ ] All text-containing elements in rectangle are selected
- [ ] No duplicate selections for same text
- [ ] Hidden elements are excluded
- [ ] Script/style/meta elements are excluded
- [ ] Images are captured separately
- [ ] Table cells with nested links work correctly
- [ ] Ruby text (Japanese readings) work correctly
- [ ] No performance regression (< 100ms for large pages)
