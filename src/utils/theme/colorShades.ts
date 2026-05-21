/**
 * Generate a 10-shade Mantine color tuple from a single hex color.
 *
 * Mantine's `theme.colors[name]` requires exactly 10 valid CSS color strings,
 * ordered lightest → darkest, with the brand color sitting around index 5–6.
 * We build the tuple by ramping HSL lightness while preserving hue/saturation,
 * which yields perceptually consistent shades for any input hex.
 */

import type { MantineColorsTuple } from '@mantine/core';

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const FALLBACK_TUPLE: MantineColorsTuple = [
  '#f1f3f5',
  '#e9ecef',
  '#dee2e6',
  '#ced4da',
  '#adb5bd',
  '#868e96',
  '#495057',
  '#343a40',
  '#212529',
  '#0c0d0e',
];

function hexToRgb(hex: string): RGB {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (v: number): string => {
    const clamped = Math.max(0, Math.min(255, Math.round(v)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hueToRgb = (p: number, q: number, t: number): number => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

const TARGET_LIGHTNESS = [0.96, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.34, 0.26, 0.18];

export function generateMantineShades(hex: string): MantineColorsTuple {
  if (!HEX_RE.test(hex)) {
    return FALLBACK_TUPLE;
  }
  const { h, s } = rgbToHsl(hexToRgb(hex));
  const shades = TARGET_LIGHTNESS.map((l) =>
    rgbToHex(hslToRgb({ h, s: Math.max(0.15, s), l }))
  );
  return shades as unknown as MantineColorsTuple;
}
