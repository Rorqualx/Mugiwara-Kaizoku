'use client';

/**
 * LivingCover — renders a "living cover": a static character foreground over an
 * inpainted background that drifts behind it (2.5D parallax). The layers are
 * produced offline by the cover-layerizer sidecar (ml/cover-layers) and
 * described by a {@link CoverLayerManifest}.
 *
 * It degrades to the ordinary static {@link MangaCover} whenever motion is off,
 * the OS requests reduced motion, no usable manifest exists, the sidecar marked
 * the cover `flat`, or a layer image fails to load — so a cover is never broken
 * by this feature.
 *
 * Motion is driven imperatively with the Web Animations API (the same mechanism
 * <MangaCover> uses), only the background moves, and it's gated to the viewport
 * so off-screen covers don't animate.
 */

import * as React from 'react';

import { Box } from '@mantine/core';
import { useIntersection } from '@mantine/hooks';

import { useAnimatedCovers } from '@/hooks/useAnimatedCovers';
import type { CoverLayer, CoverLayerManifest } from '@/types/domain/cover-layers-types';

import { getSeedPhaseMs } from './coverSeed';
import { MangaCover, type MangaCoverProps } from './MangaCover';
import classes from './MangaCover.module.css';

/** Extra overscan beyond the drift amplitude so a moving layer never shows a gap. */
const OVERSCAN_MARGIN = 0.04;
const DEFAULT_OVERLAY = 'linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.2))';
const RADIUS_TOKENS = new Set(['xs', 'sm', 'md', 'lg', 'xl']);

function resolveRadius(radius: number | string | undefined): number | string | undefined {
  if (typeof radius === 'string' && RADIUS_TOKENS.has(radius)) {
    return `var(--mantine-radius-${radius})`;
  }
  return radius;
}

/** True when the manifest describes a renderable layered cover. */
function isLayeredManifest(m: CoverLayerManifest | null | undefined): m is CoverLayerManifest {
  return m?.mode === 'layered' && m.layers.length > 0;
}

/** Overscan scale that keeps a drifting layer's edges off-screen. */
function overscanScale(motion: CoverLayer['motion']): number {
  if (motion === null) {
    return 1;
  }
  const maxAmp = Math.max(motion.ampPct[0], motion.ampPct[1]) / 100;
  return 1 + 2 * maxAmp + OVERSCAN_MARGIN;
}

/** Two-frame drift keyframes for a moving layer. */
function driftKeyframes(motion: NonNullable<CoverLayer['motion']>): Keyframe[] {
  const [ax, ay] = motion.ampPct;
  const s = overscanScale(motion);
  return [
    { transform: `translate(${-ax}%, ${-ay}%) scale(${s})` },
    { transform: `translate(${ax}%, ${ay}%) scale(${s + motion.scaleAmp})` },
  ];
}

interface RootStyleArgs {
  fill: boolean;
  radius: number | string | undefined;
  w: number | string | undefined;
  h: number | string | undefined;
  manifest: CoverLayerManifest;
  style: React.CSSProperties | undefined;
}

/** Builds the clipping-container style for the layered cover. */
function buildLayeredRootStyle({ fill, radius, w, h, manifest, style }: RootStyleArgs): React.CSSProperties {
  return {
    backgroundColor: '#f0f0f0',
    borderRadius: fill ? undefined : resolveRadius(radius),
    width: fill ? undefined : (w ?? '100%'),
    height: fill ? undefined : h,
    aspectRatio: fill || h !== undefined ? undefined : `${manifest.w} / ${manifest.h}`,
    ...style,
  };
}

export interface LivingCoverProps extends MangaCoverProps {
  /** Layer manifest from the sidecar; `null`/`undefined` → static fallback. */
  manifest?: CoverLayerManifest | null;
  /** URL prefix for this cover's layer files (e.g. `/api/cover-layers/123`). */
  layerBaseUrl?: string;
}

interface LayerImgProps {
  layer: CoverLayer;
  src: string;
  alt: string;
  loading: 'lazy' | 'eager';
  imgRef: (el: HTMLImageElement | null) => void;
  onError: () => void;
}

/** A single absolutely-positioned cover layer image. */
function LayerImg({ layer, src, alt, loading, imgRef, onError }: LayerImgProps): React.ReactElement {
  const isCharacter = layer.role === 'character';
  return (
    <img
      ref={imgRef}
      src={src}
      alt={isCharacter ? alt : ''}
      aria-hidden={!isCharacter}
      loading={loading}
      draggable={false}
      onError={onError}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center',
        zIndex: layer.z,
        ...(layer.motion !== null ? { willChange: 'transform', backfaceVisibility: 'hidden' } : {}),
      }}
    />
  );
}

/**
 * Renders a manga cover with a locked subject and a drifting background.
 *
 * @param props - See {@link LivingCoverProps}.
 * @returns The layered living cover, or a static {@link MangaCover} fallback.
 */
export function LivingCover(props: LivingCoverProps): React.ReactElement {
  const { manifest, layerBaseUrl, ...coverProps } = props;
  const motionAllowed = useAnimatedCovers();
  const enabled = motionAllowed && coverProps.animated !== false;

  const [failed, setFailed] = React.useState(false);
  const layerRefs = React.useRef<Record<string, HTMLImageElement | null>>({});
  const { ref: intersectionRef, entry } = useIntersection({ threshold: 0.01 });
  const visible = entry?.isIntersecting ?? false;
  const usable = enabled && !failed && layerBaseUrl !== undefined && isLayeredManifest(manifest);

  // Drive the background drift while the cover is on-screen.
  React.useEffect(() => {
    if (!usable || !visible || !isLayeredManifest(manifest)) {
      return undefined;
    }
    const seed = coverProps.seed ?? manifest.coverId;
    const anims = manifest.layers.flatMap((layer): Animation[] => {
      const el = layerRefs.current[layer.id];
      if (layer.motion === null || el === null || el === undefined || typeof el.animate !== 'function') {
        return [];
      }
      const anim = el.animate(driftKeyframes(layer.motion), {
        duration: layer.motion.durationMs,
        iterations: Infinity,
        direction: layer.motion.alternate ? 'alternate' : 'normal',
        easing: layer.motion.easing,
      });
      anim.currentTime = getSeedPhaseMs(seed, layer.motion.durationMs);
      return [anim];
    });
    return () => {
      anims.forEach((a) => a.cancel());
    };
  }, [usable, visible, manifest, coverProps.seed]);

  if (!usable) {
    return <MangaCover {...coverProps} />;
  }

  const { fill = false, withOverlay = false, overlayGradient, radius, w, h, loading = 'lazy', className, style, onClick, children } = coverProps;
  const sorted = [...manifest.layers].sort((a, b) => a.z - b.z);
  const rootStyle = buildLayeredRootStyle({ fill, radius, w, h, manifest, style });
  const rootClassName = [classes['root'], fill ? classes['fill'] : null, className].filter(Boolean).join(' ');

  return (
    <Box ref={intersectionRef} className={rootClassName} style={rootStyle} onClick={onClick}>
      {sorted.map((layer) => (
        <LayerImg
          key={layer.id}
          layer={layer}
          src={`${layerBaseUrl}/${layer.file}`}
          alt={coverProps.alt}
          loading={loading}
          imgRef={(el) => {
            layerRefs.current[layer.id] = el;
          }}
          onError={() => setFailed(true)}
        />
      ))}
      {withOverlay && (
        <div className={classes['overlay']} style={{ backgroundImage: overlayGradient ?? DEFAULT_OVERLAY, zIndex: 50 }} />
      )}
      {children !== undefined && <div className={classes['content']}>{children}</div>}
    </Box>
  );
}
