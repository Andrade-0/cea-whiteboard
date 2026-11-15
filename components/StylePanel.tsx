"use client";

import { useBoard, type SizeKey } from "@/lib/store";
import type { ColorKey, ShapeKind } from "@/lib/types";
import { PALETTE } from "@/lib/theme";
import { T } from "@/lib/strings";
import { ShapeGlyph } from "./icons";

const INK_COLORS: ColorKey[] = ["ink", "pink", "blue", "green", "red"];
const HL_COLORS: ColorKey[] = ["yellow", "pink", "blue", "green"];
const SIZES: SizeKey[] = ["fine", "medium", "bold"];
const SHAPES: ShapeKind[] = ["line", "arrow", "rect", "ellipse"];

/** Bottom dock: colour, thickness and per-tool options. */
export default function StylePanel() {
  const tool = useBoard((s) => s.tool);
  const color = useBoard((s) => s.color);
  const hlColor = useBoard((s) => s.highlighterColor);
  const size = useBoard((s) => s.size);
  const shapeKind = useBoard((s) => s.shapeKind);
  const eraserMode = useBoard((s) => s.eraserMode);
  const stabilizer = useBoard((s) => s.stabilizer);
  const selection = useBoard((s) => s.selection);
  const set = useBoard((s) => s.set);
  const change = useBoard((s) => s.change);

  const isHl = tool === "highlighter";
  const colors = isHl ? HL_COLORS : INK_COLORS;
  const active = isHl ? hlColor : color;
  const showInk = ["pen", "highlighter", "text", "shape", "select", "system"].includes(tool);

  const pickColor = (c: ColorKey) => {
    if (isHl) set({ highlighterColor: c });
    else set({ color: c });
    // recolour the current selection too
    if (tool === "select" && selection.length) {
      const ids = new Set(selection);
      change((els) => els.map((e) => (ids.has(e.id) && "color" in e ? { ...e, color: c } : e)));
    }
  };

  if (tool === "laser" || tool === "hand" || tool === "matrix") return null;

  return (
    <div className="dock" onPointerDown={(e) => e.stopPropagation()}>
      {showInk && (
        <div className="dock-group" aria-label="Cor">
          {colors.map((c, i) => (
            <button
              key={c}
              className={`ink-drop${active === c ? " is-on" : ""}`}
              style={{ ["--c" as string]: PALETTE.light[c] }}
              onClick={() => pickColor(c)}
              title={`${T.colors[c]}${isHl ? "" : ` (${i + 1})`}`}
            />
          ))}
        </div>
      )}
      {(tool === "pen" || tool === "highlighter" || tool === "shape") && (
        <div className="dock-group" aria-label="Espessura">
          {SIZES.map((k, i) => (
            <button key={k} className={`size-dot${size === k ? " is-on" : ""}`} onClick={() => set({ size: k })} title={T.sizes[k]}>
              <i style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
            </button>
          ))}
        </div>
      )}
      {tool === "shape" && (
        <div className="dock-group">
          {SHAPES.map((k) => (
            <button key={k} className={`dock-icon${shapeKind === k ? " is-on" : ""}`} onClick={() => set({ shapeKind: k })} title={T.shapes[k]}>
              <ShapeGlyph kind={k} width={18} height={18} />
            </button>
          ))}
        </div>
      )}
      {tool === "eraser" && (
        <div className="dock-group">
          {(["stroke", "partial"] as const).map((k) => (
            <button key={k} className={`dock-text${eraserMode === k ? " is-on" : ""}`} onClick={() => set({ eraserMode: k })}>
              {T.eraser[k]}
            </button>
          ))}
        </div>
      )}
      {(tool === "pen" || tool === "highlighter") && (
        <label className="dock-group dock-slider" title={T.stabilizerHint}>
          <span>{T.stabilizer}</span>
          <input type="range" min={0} max={14} step={1} value={stabilizer} onChange={(e) => set({ stabilizer: Number(e.target.value) })} />
          <b>{stabilizer}</b>
        </label>
      )}
    </div>
  );
}
