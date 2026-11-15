import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Background, Camera, ColorKey, El, EraserMode, Page, ShapeKind, Tool } from "./types";
import { T } from "./strings";

export const newId = () => nanoid(10);

export const newPage = (bg: Background = "grid"): Page => ({ id: newId(), elements: [], bg, camera: { x: 0, y: 0, z: 1 } });

export type SizeKey = "fine" | "medium" | "bold";
export const PEN_SIZES: Record<SizeKey, number> = { fine: 2.6, medium: 4.2, bold: 7.5 };
export const HIGHLIGHTER_SIZES: Record<SizeKey, number> = { fine: 14, medium: 22, bold: 34 };

export interface Editing {
  id: string;
  /** focused cell for matrices: [row, col]; col === -1 means the row operation field */
  cell?: [number, number];
}

interface History {
  past: El[][];
  future: El[][];
}

const HISTORY_LIMIT = 200;

interface State {
  pages: Page[];
  current: number;
  tool: Tool;
  color: ColorKey;
  highlighterColor: ColorKey;
  size: SizeKey;
  shapeKind: ShapeKind;
  eraserMode: EraserMode;
  /** stabilizer rope radius in screen pixels (0 = off) */
  stabilizer: number;
  matrixSize: [number, number];
  matrixAug: boolean;
  selection: string[];
  editing: Editing | null;
  presentation: boolean;
  helpOpen: boolean;
  pagesOpen: boolean;
  history: Record<string, History>;
  loaded: boolean;
  /** read-only follower of a shared board */
  viewer: boolean;

  page: () => Page;
  setTool: (t: Tool) => void;
  set: (p: Partial<State>) => void;
  setCamera: (cam: Camera) => void;
  /** Applies a change to the current page's elements and records it for undo. */
  change: (fn: (els: El[]) => El[]) => void;
  /** Applies a change without recording it (used while dragging). */
  changeTransient: (fn: (els: El[]) => El[]) => void;
  /** Records `before` as the undo point for transient changes made since. */
  commitFrom: (before: El[]) => void;
  undo: () => void;
  redo: () => void;
  setBackground: (bg: Background) => void;
  addPage: () => void;
  duplicatePage: (i: number) => void;
  deletePage: (i: number) => void;
  movePage: (from: number, to: number) => void;
  renamePage: (i: number, title: string) => void;
  goto: (i: number) => void;
  load: (pages: Page[], current: number) => void;
}

function withPage(s: State, fn: (p: Page) => Page): Pick<State, "pages"> {
  const pages = s.pages.slice();
  pages[s.current] = fn(pages[s.current]);
  return { pages };
}

function pushPast(s: State, pageId: string, before: El[]): Record<string, History> {
  const h = s.history[pageId] ?? { past: [], future: [] };
  const past = [...h.past, before].slice(-HISTORY_LIMIT);
  return { ...s.history, [pageId]: { past, future: [] } };
}

export const useBoard = create<State>((set, get) => ({
  pages: [newPage()],
  current: 0,
  tool: "pen",
  color: "ink",
  highlighterColor: "yellow",
  size: "medium",
  shapeKind: "arrow",
  eraserMode: "stroke",
  stabilizer: 6,
  matrixSize: [3, 3],
  matrixAug: false,
  selection: [],
  editing: null,
  presentation: false,
  helpOpen: false,
  pagesOpen: true,
  history: {},
  loaded: false,
  viewer: false,

  page: () => get().pages[get().current],
  setTool: (tool) => set({ tool, selection: tool === "select" ? get().selection : [], editing: null }),
  set: (p) => set(p),
  setCamera: (camera) => set((s) => withPage(s, (p) => ({ ...p, camera }))),

  change: (fn) =>
    set((s) => {
      const page = s.pages[s.current];
      const next = fn(page.elements);
      if (next === page.elements) return {};
      return { ...withPage(s, (p) => ({ ...p, elements: next })), history: pushPast(s, page.id, page.elements) };
    }),
  changeTransient: (fn) => set((s) => withPage(s, (p) => ({ ...p, elements: fn(p.elements) }))),
  commitFrom: (before) =>
    set((s) => {
      const page = s.pages[s.current];
      if (page.elements === before) return {};
      return { history: pushPast(s, page.id, before) };
    }),

  undo: () =>
    set((s) => {
      const page = s.pages[s.current];
      const h = s.history[page.id];
      if (!h?.past.length) return {};
      const prev = h.past[h.past.length - 1];
      return {
        ...withPage(s, (p) => ({ ...p, elements: prev })),
        history: { ...s.history, [page.id]: { past: h.past.slice(0, -1), future: [page.elements, ...h.future] } },
        selection: [],
        editing: null,
      };
    }),
  redo: () =>
    set((s) => {
      const page = s.pages[s.current];
      const h = s.history[page.id];
      if (!h?.future.length) return {};
      const [next, ...rest] = h.future;
      return {
        ...withPage(s, (p) => ({ ...p, elements: next })),
        history: { ...s.history, [page.id]: { past: [...h.past, page.elements], future: rest } },
        selection: [],
        editing: null,
      };
    }),

  setBackground: (bg) => set((s) => withPage(s, (p) => ({ ...p, bg }))),

  addPage: () =>
    set((s) => {
      const pages = s.pages.slice();
      pages.splice(s.current + 1, 0, newPage(s.pages[s.current]?.bg ?? "grid"));
      return { pages, current: s.current + 1, selection: [], editing: null };
    }),
  duplicatePage: (i) =>
    set((s) => {
      const src = s.pages[i];
      const pages = s.pages.slice();
      pages.splice(i + 1, 0, {
        ...src,
        id: newId(),
        title: src.title ? `${src.title} ${T.copySuffix}` : undefined,
        elements: src.elements.map((e) => ({ ...e, id: newId() })),
      });
      return { pages, current: i + 1, selection: [], editing: null };
    }),
  deletePage: (i) =>
    set((s) => {
      if (s.pages.length === 1) return { pages: [newPage(s.pages[0].bg)], current: 0, selection: [], editing: null };
      const pages = s.pages.filter((_, k) => k !== i);
      return { pages, current: Math.min(s.current > i ? s.current - 1 : s.current, pages.length - 1), selection: [], editing: null };
    }),
  movePage: (from, to) =>
    set((s) => {
      if (to < 0 || to >= s.pages.length) return {};
      const pages = s.pages.slice();
      const [p] = pages.splice(from, 1);
      pages.splice(to, 0, p);
      const cur = s.pages[s.current].id;
      return { pages, current: pages.findIndex((x) => x.id === cur) };
    }),
  renamePage: (i, title) =>
    set((s) => {
      if (!s.pages[i]) return {};
      const pages = s.pages.slice();
      pages[i] = { ...pages[i], title: title.trim() || undefined };
      return { pages };
    }),
  goto: (i) => set((s) => (i >= 0 && i < s.pages.length ? { current: i, selection: [], editing: null } : {})),
  load: (pages, current) => set({ pages: pages.length ? pages : [newPage()], current: Math.min(current, Math.max(0, pages.length - 1)), loaded: true, history: {} }),
}));

// Dev-only handle used by the browser test script.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __board: typeof useBoard }).__board = useBoard;
}
