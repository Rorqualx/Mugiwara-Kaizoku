/**
 * Shared on-screen tracking for animated covers.
 *
 * A grid can hold hundreds of covers; one IntersectionObserver for all of
 * them is cheaper than one per cover. Each observed element gets a callback
 * with its current visibility.
 *
 * @module components/manga/MangaCover/cover-visibility
 */

type VisibilityCallback = (visible: boolean) => void;

const callbacks = new Map<Element, VisibilityCallback>();
let observer: IntersectionObserver | null = null;

function sharedObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) callbacks.get(entry.target)?.(entry.isIntersecting);
    },
    // Start moving shortly before a cover scrolls into view.
    { rootMargin: '200px 0px' }
  );
  return observer;
}

/**
 * Calls `onChange` whenever `el` enters or leaves the viewport (first call
 * comes asynchronously after observing). Returns a function that stops
 * observing. Without IntersectionObserver support the element counts as
 * always visible.
 */
export function observeCoverVisibility(el: Element, onChange: VisibilityCallback): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    onChange(true);
    return () => {};
  }
  const io = sharedObserver();
  callbacks.set(el, onChange);
  io.observe(el);
  return () => {
    callbacks.delete(el);
    io.unobserve(el);
  };
}
