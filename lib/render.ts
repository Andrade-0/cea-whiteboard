import type { Background, Camera, El, ImageEl, MatrixEl, Page, ShapeEl, StrokeEl, TextEl } from "./types";
import { cachedStrokePath, strokePath } from "./ink";
import { changedCells, formatCell, formatText, matrixLayout, sarrusApplies, type MatrixLayout, type Measure } from "./matrix";
import { BOARD_BG, colorOf, fontFamily, HIGHLIGHT_FILL, modeOf } from "./theme";
import { elBox, emptyBox, intersects, textLines, union } from "./geometry";
import { viewportBox } from "./camera";

// ---------- text measuring ----------

let measureCtx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();

export function fontString(fs: number, bold = false, kind: "math" | "hand" = "math") {
  return `${bold ? 600 : 400} ${fs}px ${fontFamily(kind)}`;
}

export const measure: Measure = (text, fs, bold = false) => {
  const key = `${bold ? 1 : 0}|${fs}|${text}`;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  if (!measureCtx) {
    if (typeof document === "undefined") return text.length * fs * 0.55;
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  measureCtx!.font = fontString(fs, bold);
  const w = measureCtx!.measureText(text).width;
  widthCache.set(key, w);
  return w;
};

export function resetMeasureCache() {
  widthCache.clear();
}

// ---------- images ----------

const images = new Map<string, HTMLImageElement>();
let onImageLoad: () => void = () => {};
export function setImageLoadListener(fn: () => void) {
  onImageLoad = fn;
}
function imageFor(el: ImageEl): HTMLImageElement | null {
  let img = images.get(el.src);
  if (!img) {
    img = new Image();
    img.onload = () => onImageLoad();
    img.src = el.src;
    images.set(el.src, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

// ---------- background ----------

export function drawBackground(ctx: CanvasRenderingContext2D, bg: Background, cam: Camera, w: number, h: number) {
  ctx.fillStyle = BOARD_BG[bg];
  ctx.fillRect(0, 0, w, h);
  if (bg === "plain") return;
  const spacing = 32 * cam.z;
  if (spacing < 6) return;
  ctx.lineWidth = 1;
  if (bg === "grid" || bg === "dark") {
    ctx.strokeStyle = bg === "dark" ? "rgba(255,255,255,0.06)" : "rgba(31,122,140,0.13)";
    const ox = -((cam.x * cam.z) % spacing), oy = -((cam.y * cam.z) % spacing);
    ctx.beginPath();
    for (let x = ox; x < w; x += spacing) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, h);
    }
    for (let y = oy; y < h; y += spacing) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(w, Math.round(y) + 0.5);
    }
    ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(31,122,140,0.2)";
    const oy = -((cam.y * cam.z) % spacing);
    ctx.beginPath();
    for (let y = oy; y < h; y += spacing) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(w, Math.round(y) + 0.5);
    }
    ctx.stroke();
    // notebook margin
    const mx = (80 - cam.x) * cam.z;
    if (mx > 0 && mx < w) {
      ctx.strokeStyle = "rgba(214,51,132,0.35)";
      ctx.beginPath();
      ctx.moveTo(Math.round(mx) + 0.5, 0);
      ctx.lineTo(Math.round(mx) + 0.5, h);
      ctx.stroke();
    }
  }
}

// ---------- elements ----------

function drawShape(ctx: CanvasRenderingContext2D, el: ShapeEl, bg: Background) {
  ctx.strokeStyle = colorOf(el.color, bg);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = el.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (el.kind === "line" || el.kind === "arrow") {
    ctx.moveTo(el.x1, el.y1);
    ctx.lineTo(el.x2, el.y2);
    ctx.stroke();
    if (el.kind === "arrow") {
      const ang = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
      const len = Math.max(10, el.size * 4.5);
      ctx.beginPath();
      ctx.moveTo(el.x2, el.y2);
      ctx.lineTo(el.x2 - len * Math.cos(ang - 0.42), el.y2 - len * Math.sin(ang - 0.42));
      ctx.moveTo(el.x2, el.y2);
      ctx.lineTo(el.x2 - len * Math.cos(ang + 0.42), el.y2 - len * Math.sin(ang + 0.42));
      ctx.stroke();
    }
  } else if (el.kind === "rect") {
    ctx.strokeRect(Math.min(el.x1, el.x2), Math.min(el.y1, el.y2), Math.abs(el.x2 - el.x1), Math.abs(el.y2 - el.y1));
  } else {
    ctx.ellipse((el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2, Math.abs(el.x2 - el.x1) / 2, Math.abs(el.y2 - el.y1) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawText(ctx: CanvasRenderingContext2D, el: TextEl, bg: Background) {
  ctx.fillStyle = colorOf(el.color, bg);
  ctx.font = fontString(el.fontSize);
  ctx.textBaseline = "top";
  textLines(el.text).forEach((line, i) => ctx.fillText(el.system ? formatCell(line) : formatText(line), el.x, el.y + i * el.fontSize * 1.3 + el.fontSize * 0.1));
  if (el.system && el.text.trim()) drawSystemBrace(ctx, el, bg, textLines(el.text).length);
}

/** Curly brace "{" spanning the lines of a linear system. */
export function drawSystemBrace(ctx: CanvasRenderingContext2D, el: TextEl, bg: Background, lines: number) {
  const fs = el.fontSize;
  const top = el.y + fs * 0.05;
  const bottom = el.y + Math.max(1, lines) * fs * 1.3 - fs * 0.1;
  const mid = (top + bottom) / 2;
  const w = fs * 0.42; // width of the brace
  const right = el.x - fs * 0.32; // where the arms end
  const spine = right - w * 0.55;
  const tip = right - w;
  const r = Math.min(w * 0.6, (bottom - top) / 6);
  ctx.save();
  ctx.strokeStyle = colorOf(el.color, bg);
  ctx.lineWidth = Math.max(1.6, fs * 0.065);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(right, top);
  ctx.quadraticCurveTo(spine, top, spine, top + r);
  ctx.lineTo(spine, mid - r);
  ctx.quadraticCurveTo(spine, mid, tip, mid);
  ctx.quadraticCurveTo(spine, mid, spine, mid + r);
  ctx.lineTo(spine, bottom - r);
  ctx.quadraticCurveTo(spine, bottom, right, bottom);
  ctx.stroke();
  ctx.restore();
}

function drawDelimiter(ctx: CanvasRenderingContext2D, kind: MatrixEl["delim"], x: number, y: number, h: number, side: -1 | 1, fs: number) {
  const t = Math.max(1.6, fs * 0.075);
  const tick = fs * 0.28;
  ctx.lineWidth = t;
  ctx.lineCap = "square";
  ctx.beginPath();
  if (kind === "bracket") {
    ctx.moveTo(x - side * tick, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x - side * tick, y + h);
  } else if (kind === "paren") {
    ctx.lineCap = "round";
    const bulge = fs * 0.32;
    ctx.moveTo(x - side * bulge * 0.15, y);
    ctx.quadraticCurveTo(x + side * bulge * 0.9, y + h / 2, x - side * bulge * 0.15, y + h);
  } else if (kind === "bar") {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
  }
  ctx.stroke();
}

export function drawMatrix(ctx: CanvasRenderingContext2D, m: MatrixEl, bg: Background, byId: Map<string, El>, hideCells = false) {
  const L = matrixLayout(m, measure);
  const fs = m.fontSize;
  const mode = modeOf(bg);
  const ink = colorOf("ink", bg);
  const top = m.y;
  const h = L.height;

  // highlights (behind everything)
  const fills = HIGHLIGHT_FILL[mode];
  for (const [r, c] of Object.entries(m.rowHl)) {
    ctx.fillStyle = fills[c];
    ctx.fillRect(m.x + L.cellsX - fs * 0.15, top + Number(r) * L.rowH, L.right - L.cellsX - L.pad + fs * 0.3, L.rowH);
  }
  for (const [col, c] of Object.entries(m.colHl)) {
    const j = Number(col);
    if (L.colX[j] === undefined) continue;
    ctx.fillStyle = fills[c];
    ctx.fillRect(m.x + L.colX[j], top + fs * 0.08, L.colW[j], h - fs * 0.16);
  }
  for (const [key, c] of Object.entries(m.cellHl)) {
    const [i, j] = key.split(",").map(Number);
    if (L.colX[j] === undefined || i >= m.cells.length) continue;
    ctx.fillStyle = fills[c];
    ctx.fillRect(m.x + L.colX[j] + 2, top + i * L.rowH + 2, L.colW[j] - 4, L.rowH - 4);
  }

  // label
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  if (L.labelW && !hideCells) {
    ctx.fillStyle = ink;
    ctx.font = fontString(fs);
    ctx.fillText(formatCell(m.label), m.x, top + h / 2);
  }

  // delimiters
  ctx.strokeStyle = ink;
  drawDelimiter(ctx, m.delim, m.x + L.left + fs * 0.1, top, h, -1, fs);
  drawDelimiter(ctx, m.delim, m.x + L.right - fs * 0.1, top, h, 1, fs);

  // augmented bar
  if (m.aug !== null && L.colX[m.aug] !== undefined) {
    ctx.save();
    ctx.strokeStyle = mode === "dark" ? "rgba(255,255,255,0.45)" : "rgba(43,47,58,0.45)";
    ctx.lineWidth = Math.max(1.2, fs * 0.045);
    ctx.setLineDash([fs * 0.16, fs * 0.14]);
    ctx.beginPath();
    const x = m.x + L.colX[m.aug];
    ctx.moveTo(x, top + fs * 0.15);
    ctx.lineTo(x, top + h - fs * 0.15);
    ctx.stroke();
    ctx.restore();
  }

  // cells; cells changed since the previous step are drawn in pink
  const prev = m.prevId ? byId.get(m.prevId) : undefined;
  const changed = prev && prev.type === "matrix" ? changedCells(prev.cells, m.cells) : null;
  ctx.textAlign = "center";
  if (!hideCells) {
    m.cells.forEach((row, i) =>
      row.forEach((v, j) => {
        const isChanged = changed?.has(`${i},${j}`) ?? false;
        ctx.font = fontString(fs, isChanged);
        ctx.fillStyle = isChanged ? colorOf("pink", bg) : ink;
        ctx.fillText(formatCell(v), m.x + L.colX[j] + L.colW[j] / 2, top + i * L.rowH + L.rowH / 2 + fs * 0.04);
      }),
    );
  }

  if (sarrusApplies(m)) drawSarrus(ctx, m, L, bg, hideCells);

  // row operations
  if (m.showOps && !hideCells) {
    ctx.textAlign = "left";
    ctx.font = fontString(fs * 0.7, true);
    ctx.fillStyle = colorOf("blue", bg);
    m.ops.forEach((o, i) => {
      if (o.trim()) ctx.fillText(formatCell(o), m.x + L.opsX, top + i * L.rowH + L.rowH / 2);
    });
  }
  ctx.textAlign = "left";
}

/**
 * Sarrus: on a 3×3 the first two columns are repeated (lighter) after the
 * matrix; "+" diagonals go down-right in blue, "−" diagonals go up-right in
 * pink. On a 2×2 only the two diagonals are drawn.
 */
function drawSarrus(ctx: CanvasRenderingContext2D, m: MatrixEl, L: MatrixLayout, bg: Background, hideCells: boolean) {
  const n = m.cells.length;
  const fs = m.fontSize;
  const cx = (j: number) => m.x + (j < n ? L.colX[j] + L.colW[j] / 2 : L.extX[j - n] + L.colW[j - n] / 2);
  const cy = (i: number) => m.y + i * L.rowH + L.rowH / 2;

  if (n === 3 && !hideCells) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = colorOf("ink", bg);
    ctx.font = fontString(fs);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 3; i++) for (const j of [0, 1]) ctx.fillText(formatCell(m.cells[i][j]), cx(3 + j), cy(i) + fs * 0.04);
    ctx.restore();
  }

  const over = L.rowH * 0.32;
  const line = (i1: number, j1: number, i2: number, j2: number, color: string, sign: string, signAtStart: boolean) => {
    const x1 = cx(j1), y1 = cy(i1), x2 = cx(j2), y2 = cy(i2);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    ctx.beginPath();
    ctx.moveTo(x1 - ux * over, y1 - uy * over);
    ctx.lineTo(x2 + ux * over, y2 + uy * over);
    ctx.stroke();
    // small sign at the outer end of the diagonal
    const sx = (signAtStart ? x1 - ux * over * 1.9 : x2 + ux * over * 1.9);
    const sy = (signAtStart ? y1 - uy * over * 1.9 : y2 + uy * over * 1.9);
    ctx.fillStyle = color;
    ctx.fillText(sign, sx, sy);
  };

  const mode = m.sarrus!;
  ctx.save();
  ctx.lineWidth = Math.max(1.2, fs * 0.045);
  ctx.lineCap = "round";
  // light enough to keep the numbers readable underneath
  ctx.globalAlpha = 0.7;
  ctx.font = fontString(fs * 0.55, true);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const plus = colorOf("blue", bg), minus = colorOf("pink", bg);
  const last = n - 1;
  if (mode === "plus" || mode === "both") {
    ctx.strokeStyle = plus;
    for (let k = 0; k < (n === 3 ? 3 : 1); k++) line(0, k, last, k + last, plus, "+", false);
  }
  if (mode === "minus" || mode === "both") {
    ctx.strokeStyle = minus;
    for (let k = 0; k < (n === 3 ? 3 : 1); k++) line(last, k, 0, k + last, minus, "−", false);
  }
  ctx.restore();
}

export function drawEl(ctx: CanvasRenderingContext2D, el: El, bg: Background, byId: Map<string, El>, hideCellsOf?: string) {
  switch (el.type) {
    case "stroke":
      ctx.save();
      ctx.fillStyle = colorOf(el.color, bg);
      if (el.highlighter) ctx.globalAlpha = bg === "dark" ? 0.4 : 0.35;
      ctx.fill(cachedStrokePath(el));
      ctx.restore();
      break;
    case "shape":
      drawShape(ctx, el, bg);
      break;
    case "matrix":
      drawMatrix(ctx, el, bg, byId, hideCellsOf === el.id);
      break;
    case "text":
      if (hideCellsOf !== el.id) drawText(ctx, el, bg);
      else if (el.system) drawSystemBrace(ctx, el, bg, el.text ? textLines(el.text).length : 3);
      break;
    case "image": {
      const img = imageFor(el);
      if (img) ctx.drawImage(img, el.x, el.y, el.w, el.h);
      else {
        ctx.fillStyle = "rgba(127,127,127,0.15)";
        ctx.fillRect(el.x, el.y, el.w, el.h);
      }
      break;
    }
  }
}

export interface SceneOptions {
  dpr: number;
  /** element whose text is being edited in an HTML overlay */
  editingId?: string;
  selection?: Set<string>;
}

export function drawScene(ctx: CanvasRenderingContext2D, page: Page, cam: Camera, vw: number, vh: number, opts: SceneOptions) {
  const { dpr } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(ctx, page.bg, cam, vw, vh);
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, -cam.x * cam.z * dpr, -cam.y * cam.z * dpr);
  const view = viewportBox(cam, vw, vh);
  const byId = new Map(page.elements.map((e) => [e.id, e]));
  // images first so ink is always drawn on top of a pasted exercise
  for (const pass of [0, 1]) {
    for (const el of page.elements) {
      if ((el.type === "image") !== (pass === 0)) continue;
      if (!intersects(elBox(el, measure), view)) continue;
      drawEl(ctx, el, page.bg, byId, opts.editingId);
    }
  }
  if (opts.selection?.size) {
    ctx.save();
    ctx.strokeStyle = "#D63384";
    ctx.lineWidth = 1.5 / cam.z;
    ctx.setLineDash([6 / cam.z, 4 / cam.z]);
    let all = emptyBox();
    for (const el of page.elements) {
      if (!opts.selection.has(el.id)) continue;
      const b = elBox(el, measure);
      all = union(all, b);
      ctx.strokeRect(b.minX - 4 / cam.z, b.minY - 4 / cam.z, b.maxX - b.minX + 8 / cam.z, b.maxY - b.minY + 8 / cam.z);
    }
    ctx.restore();
  }
}

/** Live (in-progress) stroke; recomputed every frame, not cached. */
export function drawLiveStroke(ctx: CanvasRenderingContext2D, s: Pick<StrokeEl, "points" | "size" | "highlighter" | "realPressure" | "color">, bg: Background) {
  ctx.save();
  ctx.fillStyle = colorOf(s.color, bg);
  if (s.highlighter) ctx.globalAlpha = bg === "dark" ? 0.4 : 0.35;
  ctx.fill(strokePath(s, false));
  ctx.restore();
}

// ---------- export ----------

export function contentBox(page: Page) {
  let b = emptyBox();
  for (const el of page.elements) b = union(b, elBox(el, measure));
  return b;
}

/** Renders a whole page (fitted to its content) into a new canvas. */
export function renderPageImage(page: Page, scale = 2, pad = 48): HTMLCanvasElement {
  let b = contentBox(page);
  if (!isFinite(b.minX)) b = { minX: 0, minY: 0, maxX: 800, maxY: 500 };
  const w = Math.ceil(b.maxX - b.minX + pad * 2);
  const h = Math.ceil(b.maxY - b.minY + pad * 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(8000, w * scale);
  canvas.height = Math.min(8000, h * scale);
  const s = Math.min(canvas.width / w, canvas.height / h);
  const ctx = canvas.getContext("2d")!;
  const cam: Camera = { x: b.minX - pad, y: b.minY - pad, z: 1 };
  drawScene(ctx, page, cam, w, h, { dpr: s });
  return canvas;
}
