"use client";

import { useEffect, useRef, useState } from "react";
import { useBoard } from "@/lib/store";
import type { ColorKey, Tool } from "@/lib/types";
import { loadBoard, saveBoard } from "@/lib/storage";
import { copySelection, deleteSelection, duplicateSelection, nextStep, pasteClipboard } from "@/lib/actions";
import { T } from "@/lib/strings";
import { installEditTracking } from "@/lib/editing";
import { startViewing } from "@/lib/share/session";
import ViewerBar from "./ViewerBar";
import VisitedDialog from "./VisitedDialog";
import { isCompact } from "@/lib/useCompact";
import Board, { isTyping } from "./Board";
import Toolbar from "./Toolbar";
import StylePanel from "./StylePanel";
import TopBar, { fitToContent, resetZoom } from "./TopBar";
import PagesPanel from "./PagesPanel";
import HelpDialog from "./HelpDialog";
import ContextBar from "./ContextBar";
import MatrixEditor from "./MatrixEditor";
import TextEditor from "./TextEditor";
import { IconClose, IconEraser, IconLaser, IconPen, IconRedo, IconSelect, IconUndo } from "./icons";

const KEY_TOOLS: Record<string, Tool> = { v: "select", h: "hand", p: "pen", k: "highlighter", e: "eraser", t: "text", s: "shape", m: "matrix", y: "system", l: "laser" };
const KEY_COLORS: ColorKey[] = ["ink", "pink", "blue", "green", "red"];
const SIZE_ORDER = ["fine", "medium", "bold"] as const;

export default function App() {
  const presentation = useBoard((s) => s.presentation);
  const pagesOpen = useBoard((s) => s.pagesOpen);
  const loaded = useBoard((s) => s.loaded);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(1000);

  useEffect(() => installEditTracking(), []);
  useEffect(() => {
    if (isCompact()) useBoard.setState({ pagesOpen: false });
  }, []);

  // a "?ver=<id>" link opens the read-only follower view of a shared board
  const [viewId] = useState(() => {
    const id = new URLSearchParams(window.location.search).get("ver");
    // switch to the follower layout before the first paint
    if (id) useBoard.setState({ viewer: true, loaded: true, tool: "hand", pagesOpen: false });
    return id;
  });
  const viewer = useBoard((s) => s.viewer);

  // ---------- load + autosave (or follow a shared board) ----------
  useEffect(() => {
    if (viewId) {
      let stop: (() => void) | undefined;
      let cancelled = false;
      startViewing(viewId).then((fn) => (cancelled ? fn() : (stop = fn)));
      return () => {
        cancelled = true;
        stop?.();
      };
    }
    loadBoard().then((data) => {
      if (data) useBoard.getState().load(data.pages, data.current);
      else useBoard.setState({ loaded: true });
    });
  }, [viewId]);

  useEffect(() => {
    if (!loaded || viewId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useBoard.subscribe((s, prev) => {
      if (s.pages === prev.pages && s.current === prev.current) return;
      setSaveState("saving");
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const st = useBoard.getState();
        setSaveState((await saveBoard(st.pages, st.current)) ? "saved" : "failed");
      }, 700);
    });
    const flush = () => {
      const st = useBoard.getState();
      void saveBoard(st.pages, st.current);
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      unsub();
      clearTimeout(timer);
      window.removeEventListener("beforeunload", flush);
    };
  }, [loaded, viewId]);

  useEffect(() => {
    const el = stageRef.current!;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const s = useBoard.getState();
      if (s.viewer) return; // followers cannot edit
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod) {
        if (k === "z" && !e.shiftKey) return e.preventDefault(), s.undo();
        if (k === "y" || (k === "z" && e.shiftKey)) return e.preventDefault(), s.redo();
        if (k === "d") return e.preventDefault(), duplicateSelection();
        if (k === "c") return void copySelection();
        if (k === "a") return e.preventDefault(), useBoard.setState({ tool: "select", selection: s.page().elements.map((x) => x.id) });
        if (k === "0") return e.preventDefault(), resetZoom();
        if (e.key === "ArrowRight") {
          const m = s.page().elements.find((x) => x.id === s.selection[0]);
          if (m?.type === "matrix") return e.preventDefault(), nextStep(m.id);
        }
        return;
      }
      if (e.altKey) return;

      if (e.key === "Escape") {
        if (s.helpOpen) return useBoard.setState({ helpOpen: false });
        if (s.presentation) return useBoard.setState({ presentation: false });
        return useBoard.setState({ selection: [], editing: null });
      }
      if (e.key === "Delete" || e.key === "Backspace") return e.preventDefault(), deleteSelection();
      if (e.key === "PageDown") return e.preventDefault(), s.goto(s.current + 1);
      if (e.key === "PageUp") return e.preventDefault(), s.goto(s.current - 1);
      if (e.key === "?" ) return useBoard.setState({ helpOpen: !s.helpOpen });
      if (e.key === "!" || (e.shiftKey && e.code === "Digit1")) return fitToContent();
      if (k === "f") return useBoard.setState({ presentation: !s.presentation });
      if (e.key === "Enter" && s.selection.length === 1) {
        const el = s.page().elements.find((x) => x.id === s.selection[0]);
        if (el?.type === "matrix") return e.preventDefault(), useBoard.setState({ editing: { id: el.id, cell: [0, 0] } });
        if (el?.type === "text") return e.preventDefault(), useBoard.setState({ editing: { id: el.id } });
      }
      if (k === "e" && e.shiftKey) return s.setTool("eraser"), useBoard.setState({ eraserMode: "partial" });
      if (k === "e") return s.setTool("eraser"), useBoard.setState({ eraserMode: "stroke" });
      if (KEY_TOOLS[k] && !e.shiftKey) return s.setTool(KEY_TOOLS[k]);
      if (/^[1-5]$/.test(e.key)) {
        const c = KEY_COLORS[Number(e.key) - 1];
        if (s.tool === "select" && s.selection.length) {
          const ids = new Set(s.selection);
          s.change((els) => els.map((x) => (ids.has(x.id) && "color" in x ? { ...x, color: c } : x)));
        }
        return useBoard.setState({ color: c });
      }
      if (e.key === "[" || e.key === "]") {
        const i = SIZE_ORDER.indexOf(s.size) + (e.key === "]" ? 1 : -1);
        if (i >= 0 && i < SIZE_ORDER.length) useBoard.setState({ size: SIZE_ORDER[i] });
      }
    };
    const onInternalPaste = () => pasteClipboard();
    window.addEventListener("keydown", onKey);
    window.addEventListener("board:paste-internal", onInternalPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("board:paste-internal", onInternalPaste);
    };
  }, []);

  if (viewer) {
    return (
      <div className="shell is-viewer">
        <ViewerBar />
        <main className="stage" ref={stageRef}>
          <Board />
        </main>
        <VisitedDialog currentId={viewId} />
      </div>
    );
  }

  return (
    <div className={`shell${presentation ? " is-presenting" : ""}${pagesOpen && !presentation ? " has-pages" : ""}`}>
      {!presentation && <TopBar saveState={saveState} />}
      {!presentation && <Toolbar />}
      <main className="stage" ref={stageRef}>
        <Board />
        <Overlays width={stageW} />
        {!presentation && <StylePanel />}
        {presentation && <PresentBar />}
        <EmptyHint />
      </main>
      {pagesOpen && !presentation && (
        <>
          <div className="pages-backdrop" onPointerDown={() => useBoard.setState({ pagesOpen: false })} />
          <PagesPanel />
        </>
      )}
      <HelpDialog />
      <VisitedDialog />
    </div>
  );
}

function Overlays({ width }: { width: number }) {
  const editing = useBoard((s) => s.editing);
  const el = useBoard((s) => (s.editing ? s.page().elements.find((x) => x.id === s.editing!.id) : undefined));
  return (
    <div className="overlays">
      {editing && el?.type === "matrix" && <MatrixEditor key={el.id} m={el} />}
      {editing && el?.type === "text" && <TextEditor key={el.id} el={el} />}
      <ContextBar width={width} />
    </div>
  );
}

function EmptyHint() {
  const empty = useBoard((s) => s.page().elements.length === 0);
  const loaded = useBoard((s) => s.loaded);
  if (!empty || !loaded) return null;
  return <p className="empty-hint">{T.emptyHint}</p>;
}

/** Minimal floating bar while presenting (screen sharing in Teams). */
function PresentBar() {
  const tool = useBoard((s) => s.tool);
  const current = useBoard((s) => s.current);
  const total = useBoard((s) => s.pages.length);
  const s = useBoard.getState;
  const items: [Tool, React.ReactElement][] = [
    ["select", <IconSelect key="s" />],
    ["pen", <IconPen key="p" />],
    ["eraser", <IconEraser key="e" />],
    ["laser", <IconLaser key="l" />],
  ];
  return (
    <div className="present-bar" onPointerDown={(e) => e.stopPropagation()}>
      {items.map(([t, icon]) => (
        <button key={t} className={tool === t ? "is-on" : ""} onClick={() => s().setTool(t)} title={T.tools[t]}>
          {icon}
        </button>
      ))}
      <span className="pb-sep" />
      <button onClick={() => s().undo()} title={T.undo}>
        <IconUndo />
      </button>
      <button onClick={() => s().redo()} title={T.redo}>
        <IconRedo />
      </button>
      <span className="pb-sep" />
      <button onClick={() => s().goto(current - 1)} disabled={current === 0} className="pb-text">
        ‹
      </button>
      <span className="pb-page">
        {current + 1}/{total}
      </span>
      <button onClick={() => s().goto(current + 1)} disabled={current === total - 1} className="pb-text">
        ›
      </button>
      <span className="pb-sep" />
      <button onClick={() => useBoard.setState({ presentation: false })} title={T.exitPresent}>
        <IconClose />
      </button>
    </div>
  );
}
