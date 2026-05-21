/**
 * Fullscreen API Types
 *
 * Type definitions for the Fullscreen API including vendor prefixes.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
 */

interface ExtendedHTMLElement extends HTMLElement {
  // Vendor-prefixed fullscreen request methods
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface ExtendedDocument extends Document {
  // Vendor-prefixed fullscreen exit methods
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;

  // Vendor-prefixed fullscreen enabled properties
  webkitFullscreenEnabled?: boolean;
  mozFullScreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;

  // Vendor-prefixed fullscreen element properties
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
}

declare global {
  interface Document extends ExtendedDocument {}
  interface HTMLElement extends ExtendedHTMLElement {}
}

export {};
