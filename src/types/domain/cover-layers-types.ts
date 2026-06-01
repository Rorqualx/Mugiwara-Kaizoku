/**
 * Cover-layer types — the manifest the cover-layerizer sidecar emits and the
 * <LivingCover> component consumes. See ml/cover-layers/layerize.py.
 *
 * A "living cover" is a flat cover split into a static character foreground and
 * an inpainted background that drifts behind it. When the sidecar can't produce
 * a good split (painterly art, full-bleed character) it emits `mode: 'flat'`
 * and the app renders the ordinary static cover.
 */

/** Role of a single rendered layer. */
export type CoverLayerRole = 'background' | 'character' | 'text' | 'object';

/** Whether a cover was successfully layered or should render flat. */
export type CoverLayerMode = 'layered' | 'flat';

/** Drift motion for a layer (only the background moves in the MVP). */
export interface CoverLayerMotion {
  type: 'drift';
  /** Peak translation per axis, as a percentage of the cover's dimension. */
  ampPct: [number, number];
  /** Peak extra zoom on top of the overscan (0 = pan only). */
  scaleAmp: number;
  /** One-way drift duration in ms (played `alternate`). */
  durationMs: number;
  /** CSS easing for the drift. */
  easing: string;
  /** Whether the drift reverses each iteration. */
  alternate: boolean;
}

/** One image layer in a living cover. */
export interface CoverLayer {
  /** Stable layer id (e.g. `bg`, `char`). */
  id: string;
  role: CoverLayerRole;
  /** Layer image filename, relative to the cover's layer directory. */
  file: string;
  /** Stacking order; higher renders on top. */
  z: number;
  /** Motion for this layer, or `null` when it stays locked in frame. */
  motion: CoverLayerMotion | null;
}

/** The full per-cover manifest. */
export interface CoverLayerManifest {
  schemaVersion: number;
  /** Manga/cover id this manifest describes. */
  coverId: string;
  /** `sha256:<hex>` of the source cover bytes — the invalidation key. */
  sourceHash: string;
  /** Source cover width in px. */
  w: number;
  /** Source cover height in px. */
  h: number;
  /** Foreground coverage fraction (0–1) measured during segmentation. */
  fgCoverage: number;
  mode: CoverLayerMode;
  /** Why a cover is flat (`no-subject`, `full-bleed`); absent when layered. */
  reason?: string;
  /** Render layers, bottom-first. Empty when `mode` is `flat`. */
  layers: CoverLayer[];
}
