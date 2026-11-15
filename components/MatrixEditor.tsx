"use client";

import { useLayoutEffect, useRef } from "react";
import { useBoard } from "@/lib/store";
import type { MatrixEl } from "@/lib/types";
import { matrixLayout } from "@/lib/matrix";
import { fontString, measure } from "@/lib/render";
import { updateMatrix, nextStep } from "@/lib/actions";
import { colorOf } from "@/lib/theme";
import { T } from "@/lib/strings";

/**
 * HTML inputs laid exactly over the canvas-rendered matrix while it is being
 * edited. Layout comes from the same `matrixLayout` used by the renderer.
 */
export default function MatrixEditor({ m }: { m: MatrixEl }) {
  const cam = useBoard((s) => s.page().camera);
  const bg = useBoard((s) => s.page().bg);
  const editing = useBoard((s) => s.editing);
  const refs = useRef(new Map<string, HTMLInputElement>());

  const cell = editing?.cell ?? [0, 0];
  const focusKey = cell[1] === -1 ? `op-${cell[0]}` : cell[1] === -2 ? "label" : `${cell[0]},${cell[1]}`;
  useLayoutEffect(() => {
    const focus = () => {
      const el = refs.current.get(focusKey);
      if (el && document.activeElement !== el) {
        el.focus({ preventScroll: true });
        el.select();
      }
    };
    focus();
    // again after the click that opened the editor has been fully handled
    const raf = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(raf);
  }, [focusKey]);

  // keep the focused cell on screen by moving the board camera (never the page)
  useLayoutEffect(() => {
    const el = refs.current.get(focusKey);
    const host = document.querySelector(".board-wrap") as HTMLElement | null;
    if (!el || !host) return;
    const r = el.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    const margin = 60;
    let dx = 0, dy = 0;
    if (r.right > h.right - margin) dx = r.right - (h.right - margin);
    else if (r.left < h.left + margin) dx = r.left - (h.left + margin);
    if (r.bottom > h.bottom - margin) dy = r.bottom - (h.bottom - margin);
    else if (r.top < h.top + margin) dy = r.top - (h.top + margin);
    if (dx || dy) {
      const s = useBoard.getState();
      const c = s.page().camera;
      s.setCamera({ ...c, x: c.x + dx / c.z, y: c.y + dy / c.z });
    }
  }, [focusKey, m.id]);

  const L = matrixLayout(m, measure);
  const z = cam.z;
  const sx = (wx: number) => (wx - cam.x) * z;
  const sy = (wy: number) => (wy - cam.y) * z;
  const fs = m.fontSize * z;
  const rows = m.cells.length;
  const cols = m.cells[0].length;

  const go = (i: number, j: number) => useBoard.setState({ editing: { id: m.id, cell: [i, j] } });

  const setCell = (i: number, j: number, v: string) =>
    updateMatrix(m.id, (cur) => ({ cells: cur.cells.map((r, a) => (a === i ? r.map((c, b) => (b === j ? v : c)) : r)) }), false);
  const setOp = (i: number, v: string) => updateMatrix(m.id, (cur) => ({ ops: cur.ops.map((o, a) => (a === i ? v : o)) }), false);

  const finish = () => useBoard.setState({ editing: null });

  const onCellKey = (e: React.KeyboardEvent<HTMLInputElement>, i: number, j: number) => {
    const input = e.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length;
    if (e.key === "Escape") return finish();
    if ((e.ctrlKey || e.metaKey) && e.key === "ArrowRight") {
      e.preventDefault();
      return nextStep(m.id);
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const idx = i * cols + j + (e.shiftKey ? -1 : 1);
      if (idx < 0) return;
      if (idx >= rows * cols) return m.showOps ? go(0, -1) : finish();
      return go(Math.floor(idx / cols), idx % cols);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      return i + 1 < rows ? go(i + 1, j) : finish();
    }
    if (e.key === "ArrowDown" && i + 1 < rows) return (e.preventDefault(), go(i + 1, j));
    if (e.key === "ArrowUp" && i > 0) return (e.preventDefault(), go(i - 1, j));
    if (e.key === "ArrowRight" && atEnd && j + 1 < cols) return (e.preventDefault(), go(i, j + 1));
    if (e.key === "ArrowLeft" && atStart && j > 0) return (e.preventDefault(), go(i, j - 1));
  };

  const onOpKey = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Escape") return finish();
    if (e.key === "Tab" || e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const back = e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey);
      const ni = i + (back ? -1 : 1);
      if (ni >= 0 && ni < rows) return go(ni, -1);
      if (!back) {
        // after the last operation, continue in the next step's matrix
        const next = useBoard.getState().page().elements.find((x) => x.type === "matrix" && x.prevId === m.id);
        if (next) return useBoard.setState({ selection: [next.id], editing: { id: next.id, cell: [0, 0] } });
        return finish();
      }
    }
  };

  const ink = colorOf("ink", bg);
  const common = (w: number, h: number, x: number, y: number): React.CSSProperties => ({
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    font: fontString(fs, true),
    color: ink,
  });

  return (
    <div className="matrix-editor" onPointerDown={(e) => e.stopPropagation()}>
      {/* label */}
      <input
        ref={(el) => {
          if (el) refs.current.set("label", el);
        }}
        className="cell-input label-input"
        style={{ ...common(Math.max(L.labelW, fs * 2.4), L.rowH * z * 0.9, sx(m.x) - (L.labelW ? 0 : fs * 2.6), sy(m.y + L.height / 2) - (L.rowH * z * 0.45)), textAlign: "right", font: fontString(fs) }}
        value={m.label}
        placeholder={T.matrix.labelPlaceholder}
        onFocus={() => editing?.cell?.[1] !== -2 && go(0, -2)}
        onChange={(e) => updateMatrix(m.id, { label: e.target.value }, false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") finish();
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            go(0, 0);
          }
        }}
      />
      {m.cells.map((row, i) =>
        row.map((v, j) => {
          const key = `${i},${j}`;
          return (
            <input
              key={key}
              ref={(el) => {
                if (el) refs.current.set(key, el);
                else refs.current.delete(key);
              }}
              className={`cell-input${focusKey === key ? " is-focused" : ""}`}
              style={common(L.colW[j] * z, L.rowH * z, sx(m.x + L.colX[j]), sy(m.y + i * L.rowH))}
              value={v}
              inputMode="text"
              spellCheck={false}
              autoComplete="off"
              onFocus={() => (cell[0] !== i || cell[1] !== j) && go(i, j)}
              onChange={(e) => setCell(i, j, e.target.value)}
              onKeyDown={(e) => onCellKey(e, i, j)}
            />
          );
        }),
      )}
      {m.showOps &&
        m.ops.map((o, i) => {
          const key = `op-${i}`;
          return (
            <input
              key={key}
              ref={(el) => {
                if (el) refs.current.set(key, el);
                else refs.current.delete(key);
              }}
              className={`cell-input op-input${focusKey === key ? " is-focused" : ""}`}
              style={{ ...common(Math.max(L.opsW, m.fontSize * 5) * z, L.rowH * z, sx(m.x + L.opsX), sy(m.y + i * L.rowH)), font: fontString(fs * 0.7, true), textAlign: "left", color: colorOf("blue", bg) }}
              value={o}
              placeholder={i === cell[0] && cell[1] === -1 ? T.matrix.opPlaceholder : ""}
              spellCheck={false}
              onFocus={() => (cell[0] !== i || cell[1] !== -1) && go(i, -1)}
              onChange={(e) => setOp(i, e.target.value)}
              onKeyDown={(e) => onOpKey(e, i)}
            />
          );
        })}
    </div>
  );
}
