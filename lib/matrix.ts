import type { MatrixEl } from "./types";

const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", n: "ⁿ" };

/**
 * Typing-friendly input → printed math:
 * "1-k^2" → "1−k²", "2*x" → "2·x", "3x1 + x_2" → "3x₁ + x₂", "L2 - 2L1" → "L₂ − 2L₁".
 */
export function formatCell(raw: string): string {
  return indices(arrows(raw.trim()))
    .replace(/\*/g, "·")
    .replace(/-/g, "−")
    .replace(/\s*\/\s*/g, "/");
}

const powers = (s: string) => s.replace(/\^\(?(-?[0-9n]+)\)?/g, (_, e: string) => [...e].map((c) => SUP[c] ?? c).join(""));
const arrows = (s: string) => s.replace(/<->/g, "↔").replace(/->/g, "→").replace(/<-/g, "←");

/**
 * Powers, then indices: a single letter (not part of a word) followed by
 * digits is an index — x1, X12, x_3, x_{10}, 2L1 — while "det2" stays as is.
 */
function indices(s: string): string {
  return powers(s).replace(/(?<!\p{L})(\p{L})_?\{?(\d+)\}?/gu, (_, l: string, d: string) => l + [...d].map((c) => SUB[c]).join(""));
}

/**
 * Light formatting for the Text tool: indices, powers and arrows only, so that
 * ordinary writing (hyphens, times like 18h30, sizes like 3x3) is untouched.
 */
export function formatText(raw: string): string {
  return raw
    .split(/(\s+)/)
    .map((tok) => {
      const bare = tok.replace(/[.,;:!?)]+$/, "");
      if (/^\d{1,2}h\d{2}$/i.test(bare) || /^\d+[xX×]\d+$/.test(bare)) return tok;
      return indices(arrows(tok));
    })
    .join("");
}

/** Normalised value used to compare steps ("−1/2" and "-1 / 2" are equal). */
export function cellKey(raw: string): string {
  return formatCell(raw).replace(/\s+/g, "");
}

/** Cells of `next` that differ from `prev` (by row/column position). */
export function changedCells(prev: string[][], next: string[][]): Set<string> {
  const out = new Set<string>();
  next.forEach((row, i) =>
    row.forEach((v, j) => {
      const p = prev[i]?.[j];
      if (p === undefined || cellKey(p) !== cellKey(v)) out.add(`${i},${j}`);
    }),
  );
  return out;
}

export function emptyCells(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

export function resize(m: MatrixEl, rows: number, cols: number): Pick<MatrixEl, "cells" | "ops" | "aug"> {
  rows = Math.max(1, Math.min(12, rows));
  cols = Math.max(1, Math.min(12, cols));
  const cells = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => m.cells[i]?.[j] ?? ""));
  const ops = Array.from({ length: rows }, (_, i) => m.ops[i] ?? "");
  const aug = m.aug === null ? null : Math.min(m.aug, cols - 1) >= 1 ? Math.min(m.aug, cols - 1) : null;
  return { cells, ops, aug };
}

// ---------- layout (shared by the canvas renderer and the HTML editor) ----------

export interface MatrixLayout {
  labelW: number;
  /** x offsets (relative to el.x) */
  left: number; // left delimiter x
  cellsX: number; // first cell x
  colW: number[];
  colX: number[];
  rowH: number;
  right: number; // right delimiter x
  /** Sarrus (3×3): x of the two repeated columns drawn after the matrix */
  extX: number[];
  opsX: number;
  opsW: number;
  width: number;
  height: number;
  pad: number;
}

export type Measure = (text: string, fontSize: number, bold?: boolean) => number;

export function matrixLayout(m: MatrixEl, measure: Measure): MatrixLayout {
  const fs = m.fontSize;
  const rowH = fs * 1.55;
  const pad = fs * 0.45;
  const minCol = fs * 0.9;
  const cols = m.cells[0]?.length ?? 0;
  const colW = Array.from({ length: cols }, (_, j) => {
    let w = minCol;
    for (const row of m.cells) w = Math.max(w, measure(formatCell(row[j] ?? ""), fs, true));
    return w + fs * 0.75;
  });
  const labelText = m.label.trim();
  const labelW = labelText ? measure(formatCell(labelText), fs) + fs * 0.45 : 0;
  const left = labelW;
  const cellsX = left + pad;
  const colX: number[] = [];
  let x = cellsX;
  colW.forEach((w) => {
    colX.push(x);
    x += w;
  });
  const right = x + pad;
  // Sarrus on a 3×3: the first two columns are written again on the right
  const extX: number[] = [];
  let end = right;
  if (sarrusApplies(m) && m.cells.length === 3) {
    let ex = right + pad;
    for (const j of [0, 1]) {
      extX.push(ex);
      ex += colW[j];
    }
    end = ex;
  }
  const opsX = end + fs * 0.5;
  let opsW = 0;
  if (m.showOps) {
    opsW = fs * 4.2;
    for (const o of m.ops) opsW = Math.max(opsW, measure(formatCell(o), fs * 0.7, true) + fs * 0.4);
  }
  const width = m.showOps ? opsX + opsW : end;
  return { labelW, left, cellsX, colW, colX, rowH, right, extX, opsX, opsW, width, height: rowH * m.cells.length, pad };
}

/** Sarrus lines make sense on square 2×2 and 3×3 matrices without an augmented part. */
export function sarrusApplies(m: Pick<MatrixEl, "cells" | "aug" | "sarrus">): boolean {
  const n = m.cells.length;
  return !!m.sarrus && m.aug === null && (n === 2 || n === 3) && m.cells.every((r) => r.length === n);
}

// ---------- linear system → augmented matrix ----------

const VAR_ORDER = ["x", "y", "z", "w", "t", "u", "v"];

/**
 * Reads lines like "2x + y - z = 1" or "x1 - 3x2 = 0" and returns the
 * coefficient cells of [A | b]. Coefficients may be numbers, fractions or
 * parameters ("kx" → k). Returns null when a line cannot be read.
 */
export function systemToAugmented(text: string): { cells: string[][]; vars: string[] } | null {
  const lines = text
    .split(/\n|;/)
    .map((l) => l.replace(/−/g, "-").replace(/·/g, "*").trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const rows: { coef: Map<string, string>; rhs: string }[] = [];
  const vars = new Set<string>();
  for (const line of lines) {
    const parts = line.split("=");
    if (parts.length !== 2) return null;
    const lhs = parts[0].replace(/\s+/g, "");
    const rhs = parts[1].replace(/\s+/g, "") || "0";
    const terms = lhs.match(/[+-]?[^+-]+/g);
    if (!terms) return null;
    const coef = new Map<string, string>();
    for (const term of terms) {
      const m = term.match(/^([+-]?)(.*?)\*?([a-z](?:_?\d+)?)$/i);
      if (!m) return null;
      const [, sign, rawC, v] = m;
      const c = rawC === "" ? "1" : rawC.replace(/^\((.*)\)$/, "$1");
      vars.add(v);
      const prev = coef.get(v);
      const value = (sign === "-" ? "-" : "") + (sign === "-" && /[+-]/.test(c) ? `(${c})` : c);
      coef.set(v, prev ? `${prev}+${value}` : value);
    }
    rows.push({ coef, rhs });
  }
  const ordered = [...vars].sort((a, b) => {
    const ia = VAR_ORDER.indexOf(a), ib = VAR_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b, undefined, { numeric: true });
  });
  const cells = rows.map((r) => [...ordered.map((v) => r.coef.get(v) ?? "0"), r.rhs]);
  return { cells, vars: ordered };
}
