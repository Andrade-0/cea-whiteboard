"use client";

import { useBoard } from "@/lib/store";
import type { Tool } from "@/lib/types";
import { T } from "@/lib/strings";
import {
  IconEraser, IconHand, IconHighlighter, IconLaser, IconMatrix, IconPen, IconSelect, IconShape, IconSystem, IconText,
} from "./icons";
import MatrixPicker from "./MatrixPicker";

const TOOLS: { tool: Tool; key: string; Icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement }[] = [
  { tool: "select", key: "V", Icon: IconSelect },
  { tool: "hand", key: "H", Icon: IconHand },
  { tool: "pen", key: "P", Icon: IconPen },
  { tool: "highlighter", key: "K", Icon: IconHighlighter },
  { tool: "eraser", key: "E", Icon: IconEraser },
  { tool: "text", key: "T", Icon: IconText },
  { tool: "shape", key: "S", Icon: IconShape },
  { tool: "matrix", key: "M", Icon: IconMatrix },
  { tool: "system", key: "Y", Icon: IconSystem },
  { tool: "laser", key: "L", Icon: IconLaser },
];

const GROUP_BREAK_AFTER: Tool[] = ["hand", "eraser", "shape", "system"];

/** Vertical tool rail on the left. */
export default function Toolbar() {
  const tool = useBoard((s) => s.tool);
  const setTool = useBoard((s) => s.setTool);

  return (
    <nav className="rail" aria-label="Ferramentas">
      {TOOLS.map(({ tool: t, key, Icon }) => (
        <div key={t} className="rail-slot">
          <button className={`rail-btn${tool === t ? " is-on" : ""}`} onClick={() => setTool(t)} title={`${T.tools[t]} (${key})`} aria-pressed={tool === t}>
            <Icon />
            <kbd>{key}</kbd>
          </button>
          {t === "matrix" && tool === "matrix" && <MatrixPicker />}
          {GROUP_BREAK_AFTER.includes(t) && <hr className="rail-rule" />}
        </div>
      ))}
    </nav>
  );
}
