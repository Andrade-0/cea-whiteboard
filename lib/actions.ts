import type { El, MatrixEl, Page, ShapeEl, TextEl } from "./types";
import { newId, newPage, useBoard } from "./store";
import { emptyCells, matrixLayout, systemToAugmented } from "./matrix";
import { measure } from "./render";
import { elBox, translateEl } from "./geometry";

export const DEFAULT_MATRIX_FONT = 30;

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
    cells: src.cells.map((r) => r.slice()),
  };
  s.change((els) => [...els.map((e) => (e.id === id ? withOps : e)), arrow, copy]);
  // start by writing the operation of the 2nd row (the 1st is usually the pivot row)
  const opRow = src.cells.length > 1 ? 1 : 0;
  useBoard.setState({ selection: [src.id], editing: { id: src.id, cell: [opRow, -1] } });
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
