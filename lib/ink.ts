import { getStroke } from "perfect-freehand";
import type { InkPoint, StrokeEl } from "./types";

/**
 * "Lazy brush" stabilizer: the brush tip only moves once the pointer is
 * further than `radius` away, then it is dragged along the rope.
 * This removes the jitter of a mouse or touchpad without adding lag
 * proportional to speed (unlike a moving average).
 */
export class Stabilizer {
  private bx = 0;
  private by = 0;
  constructor(public radius: number) {}

  reset(x: number, y: number) {
    this.bx = x;
    this.by = y;
  }

  /** Feed a pointer position; returns the new brush position, or null if it did not move. */
  update(x: number, y: number): [number, number] | null {
    const dx = x - this.bx;
    const dy = y - this.by;
    const d = Math.hypot(dx, dy);
    if (d <= this.radius) return null;
    const k = (d - this.radius) / d;
    this.bx += dx * k;
    this.by += dy * k;
    return [this.bx, this.by];
  }

  get position(): [number, number] {
    return [this.bx, this.by];
  }
}

/** Points between the brush and the pointer so the stroke ends where the user released. */
export function catchUp(from: [number, number], to: [number, number], step: number): [number, number][] {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (d < 0.5) return [];
  const n = Math.max(1, Math.ceil(d / Math.max(step, 0.5)));
  const out: [number, number][] = [];
  for (let i = 1; i <= n; i++) out.push([from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n]);
  return out;
}

/** Straight line from first to last point, resampled so it still tapers nicely. */
export function straighten(points: InkPoint[]): InkPoint[] {
  if (points.length < 2) return points;
  const a = points[0];
  const b = points[points.length - 1];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(2, Math.ceil(len / 4));
  const out: InkPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.5]);
  }
  return out;
}

/** Snap the end point of a straight line to multiples of 15°. */
export function snapAngle(ax: number, ay: number, bx: number, by: number): [number, number] {
  const len = Math.hypot(bx - ax, by - ay);
  const step = Math.PI / 12;
  const ang = Math.round(Math.atan2(by - ay, bx - ax) / step) * step;
  return [ax + Math.cos(ang) * len, ay + Math.sin(ang) * len];
}

export function strokeOptions(s: Pick<StrokeEl, "size" | "highlighter" | "realPressure">, last: boolean) {
  if (s.highlighter) {
    return { size: s.size, thinning: 0, smoothing: 0.6, streamline: 0.5, simulatePressure: false, last };
  }
  return {
    size: s.size,
    thinning: s.realPressure ? 0.6 : 0.45,
    smoothing: 0.6,
    streamline: 0.45,
    simulatePressure: !s.realPressure,
    easing: (t: number) => Math.sin((t * Math.PI) / 2),
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
    last,
  };
}

/** Converts a perfect-freehand outline into a smooth closed Path2D (quadratic midpoints). */
export function outlineToPath(outline: number[][]): Path2D {
  const p = new Path2D();
  const n = outline.length;
  if (n < 2) return p;
  p.moveTo(outline[0][0], outline[0][1]);
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  p.closePath();
  return p;
}

export function strokePath(s: Pick<StrokeEl, "points" | "size" | "highlighter" | "realPressure">, last: boolean): Path2D {
  if (s.points.length === 1) {
    const [x, y] = s.points[0];
    const p = new Path2D();
    p.arc(x, y, s.size / 2, 0, Math.PI * 2);
    return p;
  }
  return outlineToPath(getStroke(s.points, strokeOptions(s, last)));
}

// Finished strokes are immutable, so their Path2D is cached by object identity.
const cache = new WeakMap<StrokeEl, Path2D>();
export function cachedStrokePath(s: StrokeEl): Path2D {
  let p = cache.get(s);
  if (!p) {
    p = strokePath(s, true);
    cache.set(s, p);
  }
  return p;
}
