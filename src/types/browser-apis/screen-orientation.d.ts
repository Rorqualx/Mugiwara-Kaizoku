/**
 * Screen Orientation API Types
 *
 * Type definitions for the Screen Orientation API.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen_Orientation_API
 */

type OrientationType =
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary'
  | 'portrait'
  | 'landscape'
  | 'natural'
  | 'any';

type OrientationLockType =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

interface ScreenOrientation extends EventTarget {
  /** Current orientation type */
  readonly type: OrientationType;

  /** Current orientation angle (0, 90, 180, 270) */
  readonly angle: number;

  /** Lock the screen orientation */
  lock(orientation: OrientationLockType): Promise<void>;

  /** Unlock the screen orientation */
  unlock(): void;

  /** Event handler for orientation changes */
  onchange: ((this: ScreenOrientation, ev: Event) => void) | null;
}

interface ScreenWithOrientation extends Screen {
  /** Screen orientation API */
  readonly orientation?: ScreenOrientation;
}

declare global {
  interface Window {
    screen: ScreenWithOrientation;
  }
}

export {};
