/**
 * Motion One Type Extensions
 * 
 * This module extends Motion One's type definitions with additional
 * functionality for animations and transforms. It provides:
 * - Extended CSS transform properties
 * - Animation options with overrides
 * - Type-safe animation functions
 * 
 * @module types/motion
 */

declare module '@motionone/dom' {
  /**
   * Extended CSS style declaration
   * Adds transform-related properties to CSS styles
   * 
   * @interface CSSStyleDeclarationWithTransform
   * @property {number | string} [x] - X-axis translation
   * @property {number | string} [y] - Y-axis translation
   * @property {number | string} [z] - Z-axis translation
   * @property {number | string} [scale] - Scale transform
   * @property {number | string} [rotate] - Rotation transform
   * @property {string} [transform] - CSS transform string
   * @property {string} [transformOrigin] - Transform origin point
   * @property {string} [direction] - Animation direction
   * @property {string} [transition] - CSS transition string
   * 
   * @example
   * ```ts
   * const styles: CSSStyleDeclarationWithTransform = {
   *   x: 100,
   *   scale: 1.2,
   *   rotate: "45deg"
   * };
   * ```
   */
  export interface CSSStyleDeclarationWithTransform {
    x?: number | string;
    y?: number | string;
    z?: number | string;
    scale?: number | string;
    rotate?: number | string;
    transform?: string;
    transformOrigin?: string;
    direction?: string;
    transition?: string;
  }

  /**
   * Extended animation options
   * Configuration options for animations with overrides
   * 
   * @interface AnimationOptionsWithOverrides
   * @property {number} [duration] - Animation duration in milliseconds
   * @property {number} [delay] - Start delay in milliseconds
   * @property {number} [endDelay] - End delay in milliseconds
   * @property {number} [repeat] - Number of repetitions
   * @property {string | number[]} [easing] - Easing function or bezier points
   * @property {string} [direction] - Animation direction mode
   * @property {string} [fill] - Fill mode for animation
   * 
   * @example
   * ```ts
   * const options: AnimationOptionsWithOverrides = {
   *   duration: 1000,
   *   easing: "ease-in-out",
   *   repeat: 2,
   *   direction: "alternate"
   * };
   * ```
   */
  export type AnimationOptionsWithOverrides = {
    duration?: number;
    delay?: number;
    endDelay?: number;
    repeat?: number;
    easing?: string | number[];
    direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
    fill?: 'none' | 'forwards' | 'backwards' | 'both' | 'auto';
  };

  /**
   * Animate DOM element
   * Creates and starts an animation on a DOM element
   * 
   * @function animate
   * @param {Element} element - Target DOM element
   * @param {Keyframe[] | PropertyIndexedKeyframes | null} keyframes - Animation keyframes
   * @param {AnimationOptionsWithOverrides} [options] - Animation configuration
   * @returns {Animation} Web Animation instance
   * 
   * @example
   * ```ts
   * animate(element, [
   *   { opacity: 0, scale: 0.8 },
   *   { opacity: 1, scale: 1 }
   * ], {
   *   duration: 500,
   *   easing: "ease-out"
   * });
   * ```
   */
  export function animate(
    element: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: AnimationOptionsWithOverrides
  ): Animation;
}
