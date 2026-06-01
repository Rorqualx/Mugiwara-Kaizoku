'use client';

/**
 * MangaCover — the single shared cover renderer for the whole app.
 *
 * Replaces the ~13 bespoke `<Image>` / CSS `background-image` cover renders
 * that previously each reimplemented their own static cover. It draws the
 * cover and, when enabled, gives it autoplaying "living" motion (a slow drift
 * + gentle zoom) generated from the existing static image — no animated asset,
 * no extra network cost.
 *
 * The motion is driven imperatively with the Web Animations API
 * (`Element.animate`) rather than CSS keyframes. That is deliberate: CSS-module
 * keyframe scoping and CSS `animation-play-state` proved unreliable in this
 * app's virtualized grid, leaving covers frozen on a scaled frame. WAA runs
 * independently of all that, autoplays on call, and the driving effect re-runs
 * on remount (so list virtualization can't strand it).
 *
 * Motion gating (all must hold): `useAnimatedCovers()` (user toggle AND OS
 * `prefers-reduced-motion`, mounted-gated) and the per-surface `animated` prop.
 *
 * Two layouts:
 *  - default: a sized foreground cover (drop-in for Mantine `<Image>`).
 *  - `fill`: absolutely fills a positioned parent and sits behind `children`,
 *    so card components can keep their badges/overlay content on top.
 */

import * as React from 'react';

import { Box } from '@mantine/core';

import { useAnimatedCovers } from '@/hooks/useAnimatedCovers';

import { getCoverAnimation } from './coverSeed';
import classes from './MangaCover.module.css';

const FALLBACK_SRC = '/cover-not-found.jpg';

/** Default dark gradient matching the legacy card background overlay. */
const DEFAULT_OVERLAY = 'linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.2))';

const RADIUS_TOKENS = new Set(['xs', 'sm', 'md', 'lg', 'xl']);

/** Maps a Mantine radius token to its CSS var; passes numbers/other strings through. */
function resolveRadius(radius: number | string | undefined): number | string | undefined {
  if (typeof radius === 'string' && RADIUS_TOKENS.has(radius)) {
    return `var(--mantine-radius-${radius})`;
  }
  return radius;
}

/** Chooses the displayable source, falling back when the cover URL is empty. */
function resolveBaseSrc(src: string | null | undefined, fallbackSrc: string): string {
  return src !== null && src !== undefined && src.length > 0 ? src : fallbackSrc;
}

/** Builds the image style: absolute in `fill` mode, aspect-driven otherwise. */
function buildImgStyle(
  fill: boolean,
  hasExplicitHeight: boolean,
  animate: boolean,
): React.CSSProperties {
  const layout: React.CSSProperties = fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%' }
    : { position: 'relative', width: '100%', height: hasExplicitHeight ? '100%' : 'auto' };
  return {
    display: 'block',
    objectFit: 'cover',
    objectPosition: 'center',
    ...(animate ? { willChange: 'transform', backfaceVisibility: 'hidden' } : {}),
    ...layout,
  };
}

/** Builds the root container style for foreground vs `fill` layouts. */
function buildRootStyle(
  fill: boolean,
  radius: number | string | undefined,
  w: number | string | undefined,
  h: number | string | undefined,
  style: React.CSSProperties | undefined,
): React.CSSProperties {
  return {
    backgroundColor: '#f0f0f0',
    borderRadius: fill ? undefined : resolveRadius(radius),
    // In foreground mode default to filling the parent's width (matching the
    // Mantine <Image> these replace, which stretch to their container).
    width: fill ? undefined : (w ?? '100%'),
    height: fill ? undefined : h,
    ...style,
  };
}

export interface MangaCoverProps {
  /** Cover URL, already resolved via `getCoverUrl()`. Empty/nullish shows the fallback. */
  src: string | null | undefined;
  /** Accessible alt text (usually the manga title). */
  alt: string;
  /** Replacement shown when the cover fails to load. */
  fallbackSrc?: string;
  /** Per-surface opt-out for motion (still gated by the user/OS prefs). Default `true`. */
  animated?: boolean;
  /** Stable seed for motion variation; prefer the manga id. Falls back to `src`. */
  seed?: number | string;
  /** Absolutely fill a positioned parent and render behind `children`. */
  fill?: boolean;
  /** Render a gradient overlay above the cover (for text/badge legibility). */
  withOverlay?: boolean;
  /** Custom overlay gradient (CSS `background-image` value). */
  overlayGradient?: string;
  /** Border radius (Mantine token or explicit value). Ignored in `fill` mode (parent clips). */
  radius?: number | string;
  /** Width in default (non-fill) mode. */
  w?: number | string;
  /** Height in default (non-fill) mode. */
  h?: number | string;
  /** Native lazy-loading hint for the underlying image. Default `'lazy'`. */
  loading?: 'lazy' | 'eager';
  className?: string;
  style?: React.CSSProperties;
  /** Click handler applied to the cover container (e.g. navigate to detail). */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  /** Content layered above the cover (badges, buttons) — typically with `fill`. */
  children?: React.ReactNode;
  /** Called when the cover image fails to load. */
  onError?: () => void;
}

/**
 * Renders a manga cover with optional autoplaying ambient motion.
 *
 * @param props - See {@link MangaCoverProps}.
 * @returns The cover element (sized, or filling its parent when `fill`).
 */
export function MangaCover({
  src,
  alt,
  fallbackSrc = FALLBACK_SRC,
  animated = true,
  seed,
  fill = false,
  withOverlay = false,
  overlayGradient,
  radius,
  w,
  h,
  loading = 'lazy',
  className,
  style,
  onClick,
  children,
  onError,
}: MangaCoverProps): React.ReactElement {
  const motionAllowed = useAnimatedCovers();
  const enabled = motionAllowed && animated;

  const imgRef = React.useRef<HTMLImageElement>(null);
  const [errored, setErrored] = React.useState(false);

  const baseSrc = resolveBaseSrc(src, fallbackSrc);
  const resolvedSrc = errored ? fallbackSrc : baseSrc;

  // Drive the "living" motion imperatively. Re-runs (and re-animates) whenever
  // the element remounts or the seed/source/enabled state changes; cancelling
  // on cleanup restores the static transform so toggling off looks identical
  // to the pre-feature cover.
  React.useEffect(() => {
    const el = imgRef.current;
    if (!enabled || el === null || typeof el.animate !== 'function') {
      return undefined;
    }
    const { keyframes, durationMs, offsetMs } = getCoverAnimation(seed ?? baseSrc);
    const anim = el.animate(keyframes, {
      duration: durationMs,
      iterations: Infinity,
      direction: 'alternate',
      easing: 'ease-in-out',
    });
    anim.currentTime = offsetMs;
    return () => {
      anim.cancel();
    };
  }, [enabled, baseSrc, seed]);

  const handleError = (): void => {
    setErrored(true);
    onError?.();
  };

  const rootClassName = [classes['root'], fill ? classes['fill'] : null, className]
    .filter(Boolean)
    .join(' ');

  return (
    <Box
      className={rootClassName}
      style={buildRootStyle(fill, radius, w, h, style)}
      onClick={onClick}
    >
      <img
        ref={imgRef}
        style={buildImgStyle(fill, h !== undefined, enabled)}
        src={resolvedSrc}
        alt={alt}
        loading={loading}
        draggable={false}
        onError={handleError}
      />
      {withOverlay && (
        <div
          className={classes['overlay']}
          style={{ backgroundImage: overlayGradient ?? DEFAULT_OVERLAY }}
        />
      )}
      {children !== undefined && <div className={classes['content']}>{children}</div>}
    </Box>
  );
}
