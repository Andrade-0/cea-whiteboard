"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useBoard } from "@/lib/store";
import type { Delimiter, El, HighlightColor, MatrixEl, TextEl } from "@/lib/types";
import { elBox } from "@/lib/geometry";
import { measure } from "@/lib/render";
import { resize } from "@/lib/matrix";
import { appendIdentity, createMinor, deleteSelection, duplicateSelection, nextStep, squareOrder, systemToMatrix, updateMatrix } from "@/lib/actions";
import VerifyPanel from "./VerifyPanel";
import { T } from "@/lib/strings";
import { IconArrowRight, IconCopy, IconMinus, IconPlus, IconTrash } from "./icons";

/** Floating bar above the selection: matrix options, system → matrix, delete/duplicate. */
export default function ContextBar({ width }: { width: number }) {
  const selection = useBoard((s) => s.selection);
  const elements = useBoard((s) => s.page().elements);
  const cam = useBoard((s) => s.page().camera);
  const editing = useBoard((s) => s.editing);
  const tool = useBoard((s) => s.tool);
  const [error, setError] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [barW, setBarW] = useState(0);
  const [barH, setBarH] = useState(40);
  // re-measure after every render: the bar's content changes with the selection
  // (the guard stops the update loop once the width is stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const w = barRef.current?.offsetWidth ?? 0;
    if (w !== barW) setBarW(w);
    const h = barRef.current?.offsetHeight ?? 40;
    if (h !== barH) setBarH(h);
  });

  if (!selection.length || tool !== "select") return null;
  const picked = elements.filter((e) => selection.includes(e.id));
  if (!picked.length) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity;
  for (const e of picked) {
    const b = elBox(e, measure);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
  }
  const cx = (((minX + maxX) / 2 - cam.x) * cam.z);
  // sit just above the selection, however many lines the bar wraps to
  const top = Math.max(8, (minY - cam.y) * cam.z - barH - 22);
  const single = picked.length === 1 ? picked[0] : null;

  return (
    <div
      ref={barRef}
      className="context-bar"
      style={{ left: barW >= width - 16 ? width / 2 : Math.min(Math.max(8 + barW / 2, cx), width - 8 - barW / 2), top }}
      onPointerDown={(e) => {
        e.stopPropagation();
        // keep focus in the cell being edited
        if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
      }}
    >
      {single?.type === "matrix" ? (
        <MatrixControls m={single} cell={editing?.id === single.id ? editing.cell : undefined} />
      ) : single?.type === "text" && single.system ? (
        <SystemControls el={single} onError={setError} />
      ) : (
        <span className="ctx-count">{T.selection.items(picked.length)}</span>
      )}
      <span className="ctx-sep" />
      <button className="ctx-btn" title={T.selection.duplicate} onClick={duplicateSelection}>
        <IconCopy width={18} height={18} />
      </button>
      <button className="ctx-btn" title={T.selection.delete} onClick={deleteSelection}>
        <IconTrash width={18} height={18} />
      </button>
      {error && <div className="ctx-error">{error}</div>}
    </div>
  );
}

function SystemControls({ el, onError }: { el: TextEl; onError: (m: string | null) => void }) {
  return (
    <button
      className="ctx-btn ctx-text is-accent"
      onClick={() => {
        const ok = systemToMatrix(el.id);
        onError(ok ? null : T.system.unreadable);
        if (!ok) setTimeout(() => onError(null), 4000);
      }}
    >
      {T.system.toMatrix} <IconArrowRight width={16} height={16} />
    </button>
  );
}

const DELIMS: { key: Delimiter; glyph: string }[] = [
  { key: "bracket", glyph: "[ ]" },
  { key: "paren", glyph: "( )" },
  { key: "bar", glyph: "| |" },
  { key: "none", glyph: "—" },
];
const HL: HighlightColor[] = ["pink", "blue", "green"];

function MatrixControls({ m, cell }: { m: MatrixEl; cell?: [number, number] }) {
  const [hl, setHl] = useState<HighlightColor>("pink");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const rows = m.cells.length, cols = m.cells[0].length;
  const order = squareOrder(m);
  const square = order !== null;
  const ci = cell && cell[1] >= 0 ? cell : null;

  const toggle = (map: Record<string, HighlightColor>, key: string) => {
    const next = { ...map };
    if (next[key] === hl) delete next[key];
    else next[key] = hl;
    return next;
  };

  return (
    <>
      <div className="ctx-group" role="group" aria-label={T.matrix.delimiters}>
        {DELIMS.map((d) => (
          <button key={d.key} className={`ctx-btn ctx-glyph${m.delim === d.key ? " is-on" : ""}`} onClick={() => updateMatrix(m.id, { delim: d.key })}>
            {d.glyph}
          </button>
        ))}
      </div>
      <span className="ctx-sep" />
      <button
        className={`ctx-btn ctx-text${m.aug !== null ? " is-on" : ""}`}
        title={T.matrix.augmented}
        onClick={() => updateMatrix(m.id, { aug: m.aug === null ? (cols > 1 ? cols - 1 : null) : m.aug - 1 >= 1 ? m.aug - 1 : null })}
      >
        A|b
      </button>
      <span className="ctx-sep" />
      <Stepper label={T.matrix.rows} value={rows} onChange={(r) => updateMatrix(m.id, (cur) => resize(cur, r, cols))} />
      <Stepper label={T.matrix.cols} value={cols} onChange={(c) => updateMatrix(m.id, (cur) => resize(cur, rows, c))} />
      <span className="ctx-sep" />
      <div className="ctx-group" aria-label={T.matrix.highlight}>
        {HL.map((c) => (
          <button key={c} className={`ctx-swatch hl-${c}${hl === c ? " is-on" : ""}`} title={T.colors[c]} onClick={() => setHl(c)} />
        ))}
        <button className="ctx-btn ctx-text" disabled={!ci} title={T.matrix.highlight + " " + T.matrix.row} onClick={() => ci && updateMatrix(m.id, (cur) => ({ rowHl: toggle(cur.rowHl, String(ci[0])) }))}>
          {T.matrix.row}
        </button>
        <button className="ctx-btn ctx-text" disabled={!ci} title={T.matrix.highlight + " " + T.matrix.col} onClick={() => ci && updateMatrix(m.id, (cur) => ({ colHl: toggle(cur.colHl, String(ci[1])) }))}>
          {T.matrix.col}
        </button>
        <button className="ctx-btn ctx-text" disabled={!ci} title={T.matrix.highlight + " " + T.matrix.cell} onClick={() => ci && updateMatrix(m.id, (cur) => ({ cellHl: toggle(cur.cellHl, `${ci[0]},${ci[1]}`) }))}>
          {T.matrix.cell}
        </button>
        {(Object.keys(m.rowHl).length > 0 || Object.keys(m.colHl).length > 0 || Object.keys(m.cellHl).length > 0) && (
          <button className="ctx-btn ctx-text" onClick={() => updateMatrix(m.id, { rowHl: {}, colHl: {}, cellHl: {} })}>
            {T.matrix.clearHl}
          </button>
        )}
      </div>
      <span className="ctx-sep" />
      <button className={`ctx-btn ctx-text${m.showOps ? " is-on" : ""}`} onClick={() => updateMatrix(m.id, { showOps: !m.showOps, ops: m.cells.map((_, i) => m.ops[i] ?? "") })}>
        {T.matrix.ops}
      </button>
      <span className="ctx-sep" />
      <button className="ctx-btn ctx-text" disabled={!square || m.aug !== null} title={T.matrix.identityHint} onClick={() => appendIdentity(m.id)}>
        {T.matrix.identity}
      </button>
      <button className="ctx-btn ctx-text" disabled={!square || order! < 2 || !ci || ci[1] >= order!} title={T.matrix.minorHint} onClick={() => ci && createMinor(m.id, ci[0], ci[1])}>
        {T.matrix.minor}
        {ci && square && ci[1] < order! ? ` a${toSub(ci[0] + 1)}${toSub(ci[1] + 1)}` : ""}
      </button>
      <button className={`ctx-btn ctx-text${verifyOpen ? " is-on" : ""}`} title={T.matrix.verifyHint} onClick={() => setVerifyOpen((v) => !v)}>
        {T.matrix.verify}
      </button>
      <button className="ctx-btn ctx-text is-accent" title={T.matrix.nextStepHint + " (Ctrl+→)"} onClick={() => nextStep(m.id)}>
        {T.matrix.nextStep} <IconArrowRight width={16} height={16} />
      </button>
      {verifyOpen && <VerifyPanel m={m} onClose={() => setVerifyOpen(false)} />}
    </>
  );
}

const SUBS = "₀₁₂₃₄₅₆₇₈₉";
const toSub = (n: number) => String(n).replace(/\d/g, (d) => SUBS[Number(d)]);

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="ctx-stepper" title={label}>
      <button className="ctx-btn" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={`${label} −`}>
        <IconMinus width={14} height={14} />
      </button>
      <span>
        <b>{value}</b> {label.toLowerCase()}
      </span>
      <button className="ctx-btn" onClick={() => onChange(value + 1)} disabled={value >= 12} aria-label={`${label} +`}>
        <IconPlus width={14} height={14} />
      </button>
    </div>
  );
}

export type { El };
