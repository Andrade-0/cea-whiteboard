import type { Box, El, InkPoint } from "./types";
import { matrixLayout, type Measure } from "./matrix";

export const emptyBox = (): Box => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

export function union(a: Box, b: Box): Box {
  return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) };
}

export function intersects(a: Box, b: Box): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export function contains(outer: Box, inner: Box): boolean {
  return inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY;
}

export function pointsBox(points: InkPoint[], pad: number): Box {
  const b = emptyBox();
  for (const [x, y] of points) {
    if (x < b.minX) b.minX = x;
    if (y < b.minY) b.minY = y;
    if (x > b.maxX) b.maxX = x;
    if (y > b.maxY) b.maxY = y;
  }
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}

export function textLines(text: string): string[] {
  return text.split("\n");
}

let boxCache = new WeakMap<El, Box>();

/** Call after web fonts load: text and matrix boxes depend on glyph widths. */
export function resetBoxCache() {
  boxCache = new WeakMap();
}

export function elBox(el: El, measure: Measure): Box {
  const cached = boxCache.get(el);
  if (cached) return cached;
  let b: Box;
  switch (el.type) {
    case "stroke":
      b = pointsBox(el.points, el.size);
      break;
    case "shape": {
      const p = el.size + (el.kind === "arrow" ? el.size * 4 : 0);
      b = { minX: Math.min(el.x1, el.x2) - p, minY: Math.min(el.y1, el.y2) - p, maxX: Math.max(el.x1, el.x2) + p, maxY: Math.max(el.y1, el.y2) + p };
      break;
    }
    case "matrix": {
      const L = matrixLayout(el, measure);
      b = { minX: el.x, minY: el.y, maxX: el.x + L.width, maxY: el.y + L.height };
      break;
    }
    case "text": {
      const lines = textLines(el.text || " ");
      const w = Math.max(...lines.map((l) => measure(l || " ", el.fontSize)));
      const braceW = el.system ? el.fontSize * 0.7 : 0;
      b = { minX: el.x - braceW, minY: el.y, maxX: el.x + Math.max(w, el.fontSize), maxY: el.y + lines.length * el.fontSize * 1.3 };
      break;
    }
    case "image":
      b = { minX: el.x, minY: el.y, maxX: el.x + el.w, maxY: el.y + el.h };
      break;
  }
  boxCache.set(el, b);
  return b;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Precise hit test used by the eraser and by click-to-select. */
export function hitEl(el: El, x: number, y: number, r: number, measure: Measure): boolean {
  const b = elBox(el, measure);
  if (x < b.minX - r || x > b.maxX + r || y < b.minY - r || y > b.maxY + r) return false;
  if (el.type === "stroke") {
    const pts = el.points;
    const tol = r + el.size / 2;
    if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= tol;
    for (let i = 1; i < pts.length; i++) if (distToSegment(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= tol) return true;
    return false;
  }
  if (el.type === "shape") {
    const tol = r + el.size;
    if (el.kind === "line" || el.kind === "arrow") return distToSegment(x, y, el.x1, el.y1, el.x2, el.y2) <= tol;
    if (el.kind === "rect") {
      const x1 = Math.min(el.x1, el.x2), x2 = Math.max(el.x1, el.x2), y1 = Math.min(el.y1, el.y2), y2 = Math.max(el.y1, el.y2);
      return (
        distToSegment(x, y, x1, y1, x2, y1) <= tol || distToSegment(x, y, x2, y1, x2, y2) <= tol ||
        distToSegment(x, y, x2, y2, x1, y2) <= tol || distToSegment(x, y, x1, y2, x1, y1) <= tol
      );
    }
    const cx = (el.x1 + el.x2) / 2, cy = (el.y1 + el.y2) / 2;
    const rx = Math.abs(el.x2 - el.x1) / 2 || 1, ry = Math.abs(el.y2 - el.y1) / 2 || 1;
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
    return Math.abs(d - 1) * Math.min(rx, ry) <= tol;
  }
  return true; // matrices, text and images: the whole box is the target
}

/** Splits a stroke by removing the points within r of (x, y). Returns null if untouched. */
export function erasePartial(points: InkPoint[], x: number, y: number, r: number): InkPoint[][] | null {
  let touched = false;
  const runs: InkPoint[][] = [];
  let cur: InkPoint[] = [];
  for (const p of points) {
    if (Math.hypot(p[0] - x, p[1] - y) <= r) {
      touched = true;
      if (cur.length) runs.push(cur);
      cur = [];
    } else cur.push(p);
  }
  if (cur.length) runs.push(cur);
  if (!touched) return null;
  return runs.filter((r2) => r2.length >= 2);
}

export function translateEl<T extends El>(el: T, dx: number, dy: number): T {
  switch (el.type) {
    case "stroke":
      return { ...el, points: el.points.map(([x, y, p]) => [x + dx, y + dy, p] as InkPoint) };
    case "shape":
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    default:
      return { ...el, x: (el as { x: number }).x + dx, y: (el as { y: number }).y + dy };
  }
}
