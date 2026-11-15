import type { El, MatrixEl, Page, ShapeEl, TextEl } from "./types";
import { newId, newPage, useBoard } from "./store";
import { emptyCells, matrixLayout, systemToAugmented } from "./matrix";
import { measure } from "./render";
import { elBox, translateEl } from "./geometry";

export const DEFAULT_MATRIX_FONT = 30;

export function makeMatrixFromPreset(x: number, y: number): MatrixEl {
  const s = useBoard.getState();
  const [rows, cols] = s.matrixSize;
  const m = makeMatrix(x, y, rows, cols, s.matrixAug);
  if (s.matrixFill === "identity") {
    const n = Math.min(rows, cols);
    m.cells = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? "1" : "0")));
    m.ops = m.cells.map(() => "");
    m.aug = null;
  }
  m.label = s.matrixLabel;
  if (/^det\b|^Δ/.test(s.matrixLabel)) m.delim = "bar";
  return m;
}

export function makeMatrix(x: number, y: number, rows: number, cols: number, aug: boolean): MatrixEl {
  return {
    id: newId(),
    type: "matrix",
    x,
    y,
    fontSize: DEFAULT_MATRIX_FONT,
    cells: emptyCells(rows, cols),
    delim: "bracket",
    aug: aug && cols > 1 ? cols - 1 : null,
    label: "",
    ops: Array.from({ length: rows }, () => ""),
    showOps: false,
    rowHl: {},
    colHl: {},
    cellHl: {},
  };
}

export function updateMatrix(id: string, patch: Partial<MatrixEl> | ((m: MatrixEl) => Partial<MatrixEl>), record = true) {
  const fn = (els: El[]) =>
    els.map((e) => (e.id === id && e.type === "matrix" ? { ...e, ...(typeof patch === "function" ? patch(e) : patch) } : e));
  const s = useBoard.getState();
  if (record) s.change(fn);
  else s.changeTransient(fn);
}

/** Square matrices only: its order, ignoring any augmented part. */
export function squareOrder(m: MatrixEl): number | null {
  const cols = m.aug ?? m.cells[0].length;
  return m.cells.length === cols ? cols : null;
}

/** [A] → [A | I]: appends the identity matrix with the augmented bar. */
export function appendIdentity(id: string) {
  updateMatrix(id, (m) => {
    const n = squareOrder(m);
    if (!n) return {};
    const cells = m.cells.map((row, i) => [...row.slice(0, n), ...Array.from({ length: n }, (_, j) => (i === j ? "1" : "0"))]);
    return { cells, aug: n, ops: m.cells.map((_, i) => m.ops[i] ?? "") };
  });
}

/**
 * Laplace: creates the minor of cell (i, j) as a determinant, labelled with
 * the cofactor sign and the element, e.g. "− 3 ·". Minors of the same matrix
 * line up below it, left to right.
 */
export function createMinor(id: string, i: number, j: number) {
  const s = useBoard.getState();
  const src = s.page().elements.find((e) => e.id === id);
  if (!src || src.type !== "matrix") return;
  const n = squareOrder(src);
  if (!n || n < 2) return;
  const cells = minorCells(src.cells, n, i, j);
  const raw = (src.cells[i][j] ?? "").trim() || "0";
  const element = /^[-−]/.test(raw) || /[+\-−]/.test(raw.slice(1)) ? `(${raw})` : raw;
  const sign = (i + j) % 2 === 0 ? "+" : "−";
  const fs = src.fontSize;
  const srcBox = elBox(src, measure);
  const siblings = s.page().elements.filter((e): e is MatrixEl => e.type === "matrix" && e.minorOf === src.id);
  const minor: MatrixEl = {
    ...makeMatrix(src.x, srcBox.maxY + fs * 1.4, n - 1, n - 1, false),
    cells,
    delim: "bar",
    label: `${sign} ${element} ·`,
    fontSize: fs,
    minorOf: src.id,
  };
  if (siblings.length) {
    const last = siblings.reduce((a, b) => (elBox(a, measure).maxX > elBox(b, measure).maxX ? a : b));
    const lb = elBox(last, measure);
    minor.x = lb.maxX + fs * 0.8;
    minor.y = last.y;
  }
  s.change((els) => [
    ...els.map((e) => (e.id === src.id && e.type === "matrix" ? { ...e, cellHl: { [`${i},${j}`]: "pink" as const }, rowHl: { [i]: "blue" as const }, colHl: { [j]: "blue" as const } } : e)),
    minor,
  ]);
  useBoard.setState({ selection: [src.id], editing: null });
}

/** Minor of cell (i, j): the matrix without row i and column j. */
export function minorCells(cells: string[][], n: number, i: number, j: number): string[][] {
  return cells.filter((_, r) => r !== i).map((row) => row.slice(0, n).filter((_, c) => c !== j));
}

/**
 * Structure of the cofactor matrix: "Cof(A) =" and a big bracket holding,
 * at each position (i, j), the sign + / − followed by the minor of a_ij as a
 * determinant filled with the matrix's numbers. Nothing is calculated.
 * Every piece is an ordinary element (the minors can get diagonals, etc.);
 * they come out selected together so they can be moved as one.
 */
export function createCofactorMatrix(id: string) {
  const s = useBoard.getState();
  const src = s.page().elements.find((e) => e.id === id);
  if (!src || src.type !== "matrix" || src.aug !== null) return;
  const n = squareOrder(src);
  if (!n || n < 2 || n > 4) return;
  const fs = Math.round(src.fontSize * (n === 4 ? 0.65 : n === 3 ? 0.8 : 1));

  const minors: MatrixEl[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => ({
      ...makeMatrix(0, 0, n - 1, n - 1, false),
      cells: minorCells(src.cells, n, i, j),
      delim: "bar" as const,
      label: (i + j) % 2 === 0 ? "+" : "−",
      fontSize: fs,
    })),
  );
  // room for Sarrus on 3×3 minors, so turning it on overlaps nothing
  const widthOf = (m: MatrixEl) => matrixLayout({ ...m, sarrus: n === 4 ? "both" : undefined }, measure).width;
  const colW = Array.from({ length: n }, (_, j) => Math.max(...minors.map((row) => widthOf(row[j]))));
  const rowH = matrixLayout(minors[0][0], measure).height;
  const gapX = fs * 1.1, gapY = fs * 0.9, pad = fs * 0.5;
  const gridW = colW.reduce((a, b) => a + b, 0) + gapX * (n - 1);
  const gridH = rowH * n + gapY * (n - 1);

  const letter = src.label.match(/\p{Lu}/u)?.[0] ?? "A";
  const labelText = `Cof(${letter}) =`;
  const top = elBox(src, measure).maxY + src.fontSize * 1.8;
  const labelFs = src.fontSize;
  const label: TextEl = { id: newId(), type: "text", x: src.x, y: top + pad + gridH / 2 - labelFs * 0.65, text: labelText, color: "ink", fontSize: labelFs };

  const left = src.x + measure(labelText, labelFs) + labelFs * 0.5; // big bracket
  const x0 = left + pad * 1.6;
  const y0 = top + pad;
  let x = x0;
  colW.forEach((w, j) => {
    for (let i = 0; i < n; i++) {
      minors[i][j].x = x;
      minors[i][j].y = y0 + i * (rowH + gapY);
    }
    x += w + gapX;
  });
  const right = x0 + gridW + pad * 1.6;
  const y1 = top, y2 = top + gridH + pad * 2;
  const serif = Math.max(8, src.fontSize * 0.35);
  const size = Math.max(2, src.fontSize * 0.07);
  const line = (x1: number, ya: number, x2: number, yb: number): ShapeEl => ({ id: newId(), type: "shape", kind: "line", x1, y1: ya, x2, y2: yb, color: "ink", size });
  const bracket = [
    line(left, y1, left, y2),
    line(left, y1, left + serif, y1),
    line(left, y2, left + serif, y2),
    line(right, y1, right, y2),
    line(right - serif, y1, right, y1),
    line(right - serif, y2, right, y2),
  ];

  const added: El[] = [label, ...bracket, ...minors.flat()];
  s.change((els) => [...els, ...added]);
  useBoard.setState({ selection: added.map((e) => e.id), editing: null });
}

/**
 * "Próximo passo": shows the row-operation column on the source matrix, draws
 * an arrow and places a copy to the right. The copy remembers its source so
 * that changed cells are highlighted automatically.
 */
export function nextStep(id: string) {
  const s = useBoard.getState();
  const src = s.page().elements.find((e) => e.id === id);
  if (!src || src.type !== "matrix") return;
  const withOps: MatrixEl = { ...src, showOps: true, ops: src.cells.map((_, i) => src.ops[i] ?? "") };
  const L = matrixLayout(withOps, measure);
  const fs = src.fontSize;
  const cy = src.y + L.height / 2;
  const ax1 = src.x + L.width + fs * 0.3;
  const ax2 = ax1 + fs * 1.5;
  const arrow: ShapeEl = { id: newId(), type: "shape", kind: "arrow", x1: ax1, y1: cy, x2: ax2, y2: cy, color: "pink", size: Math.max(2.5, fs * 0.09) };
  const copy: MatrixEl = {
    ...src,
    id: newId(),
    x: ax2 + fs * 0.6,
    label: "",
    ops: src.cells.map(() => ""),
    showOps: false,
    rowHl: {},
    colHl: {},
    cellHl: {},
    prevId: src.id,
    sarrus: undefined,
    cells: src.cells.map((r) => r.slice()),
  };
  s.change((els) => [...els.map((e) => (e.id === id ? withOps : e)), arrow, copy]);
  // start by writing the operation of the 2nd row (the 1st is usually the pivot row)
  const opRow = src.cells.length > 1 ? 1 : 0;
  useBoard.setState({ selection: [src.id], editing: { id: src.id, cell: [opRow, -1] } });
}

/**
 * Writes a whole solution on the board as a chain of "Próximo passo"
 * matrices: the operations go next to each matrix and an arrow leads to the
 * result. Three matrices per line, then the chain continues below.
 * Everything is one undo step.
 */
export function writeSteps(id: string, steps: { labels: string[]; cells: string[][] }[]) {
  const s = useBoard.getState();
  const origin = s.page().elements.find((e) => e.id === id);
  if (!origin || origin.type !== "matrix" || !steps.length) return;
  const fs = origin.fontSize;
  const added: El[] = [];
  const replaced = new Map<string, MatrixEl>();
  let cur: MatrixEl = origin;
  let inRow = 1;
  let rowBottom = elBox(origin, measure).maxY;
  for (const step of steps) {
    const withOps: MatrixEl = { ...cur, showOps: true, ops: cur.cells.map((_, i) => step.labels[i] ?? "") };
    if (cur.id === origin.id) replaced.set(cur.id, withOps);
    else added[added.length - 1] = withOps;
    const L = matrixLayout(withOps, measure);
    const next: MatrixEl = {
      ...origin,
      id: newId(),
      label: "",
      ops: step.cells.map(() => ""),
      showOps: false,
      rowHl: {},
      colHl: {},
      cellHl: {},
      minorOf: undefined,
      sarrus: undefined,
      prevId: cur.id,
      cells: step.cells,
      x: 0,
      y: cur.y,
    };
    const NL = matrixLayout(next, measure);
    let arrow: ShapeEl;
    if (inRow < 3) {
      const cy = cur.y + L.height / 2;
      const ax1 = cur.x + L.width + fs * 0.3, ax2 = ax1 + fs * 1.5;
      arrow = { id: newId(), type: "shape", kind: "arrow", x1: ax1, y1: cy, x2: ax2, y2: cy, color: "pink", size: Math.max(2.5, fs * 0.09) };
      next.x = ax2 + fs * 0.6;
      next.y = cy - NL.height / 2;
      inRow++;
    } else {
      // continue on a new line, starting under the first matrix
      const y = rowBottom + fs * 1.6;
      const ax1 = origin.x, ax2 = origin.x + fs * 1.5;
      arrow = { id: newId(), type: "shape", kind: "arrow", x1: ax1, y1: y + NL.height / 2, x2: ax2, y2: y + NL.height / 2, color: "pink", size: Math.max(2.5, fs * 0.09) };
      next.x = ax2 + fs * 0.6;
      next.y = y;
      inRow = 1;
    }
    rowBottom = Math.max(rowBottom, next.y + NL.height);
    added.push(arrow, next);
    cur = next;
  }
  s.change((els) => [...els.map((e) => replaced.get(e.id) ?? e), ...added]);
  useBoard.setState({ selection: [cur.id], editing: null });
}

export function systemToMatrix(textId: string): boolean {
  const s = useBoard.getState();
  const el = s.page().elements.find((e) => e.id === textId) as TextEl | undefined;
  if (!el || el.type !== "text") return false;
  const parsed = systemToAugmented(el.text);
  if (!parsed) return false;
  const b = elBox(el, measure);
  const m = makeMatrix(b.maxX + el.fontSize * 2.2, el.y, parsed.cells.length, parsed.cells[0].length, true);
  m.cells = parsed.cells;
  m.label = "[A | b] =";
  m.fontSize = Math.max(22, el.fontSize);
  const L = matrixLayout(m, measure);
  m.y = (b.minY + b.maxY) / 2 - L.height / 2;
  s.change((els) => [...els, m]);
  useBoard.setState({ selection: [m.id], tool: "select" });
  return true;
}

export function deleteSelection() {
  const s = useBoard.getState();
  if (!s.selection.length) return;
  const ids = new Set(s.selection);
  s.change((els) => els.filter((e) => !ids.has(e.id)));
  useBoard.setState({ selection: [], editing: null });
}

export function cloneEls(els: El[], dx: number, dy: number): El[] {
  const idMap = new Map<string, string>();
  const out = els.map((e) => {
    const id = newId();
    idMap.set(e.id, id);
    return { ...translateEl(e, dx, dy), id };
  });
  // keep step links inside the copied group
  return out.map((e) => (e.type === "matrix" && e.prevId ? { ...e, prevId: idMap.get(e.prevId) } : e));
}

/**
 * Adds pages from a saved board after the existing ones (ids are renewed so
 * the same file can be imported twice) and opens the first imported page.
 */
export function appendPages(pages: Page[]) {
  if (!pages.length) return;
  const fresh = pages.map((p) => ({ ...p, id: newId(), elements: cloneEls(p.elements, 0, 0) }));
  useBoard.setState((s) => ({ pages: [...s.pages, ...fresh], current: s.pages.length, selection: [], editing: null }));
}

/** Replaces everything with a single empty page (same background as now). */
export function newBoard() {
  const s = useBoard.getState();
  s.load([newPage(s.page().bg)], 0);
}

export function duplicateSelection() {
  const s = useBoard.getState();
  const ids = new Set(s.selection);
  const picked = s.page().elements.filter((e) => ids.has(e.id));
  if (!picked.length) return;
  const copies = cloneEls(picked, 24, 24);
  s.change((els) => [...els, ...copies]);
  useBoard.setState({ selection: copies.map((e) => e.id) });
}

// in-app clipboard (ink and matrices cannot go through the system clipboard)
let clipboard: El[] = [];
export function copySelection() {
  const s = useBoard.getState();
  const ids = new Set(s.selection);
  clipboard = s.page().elements.filter((e) => ids.has(e.id));
  return clipboard.length > 0;
}
export function pasteClipboard(): boolean {
  if (!clipboard.length) return false;
  const copies = cloneEls(clipboard, 32, 32);
  clipboard = copies;
  useBoard.getState().change((els) => [...els, ...copies]);
  useBoard.setState({ selection: copies.map((e) => e.id), tool: "select" });
  return true;
}
