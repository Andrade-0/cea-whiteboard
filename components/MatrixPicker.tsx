"use client";

import { useState } from "react";
import { useBoard } from "@/lib/store";
import { T } from "@/lib/strings";

const MAX_R = 6, MAX_C = 8;

/** Word-style size grid shown next to the matrix tool. */
export default function MatrixPicker() {
  const [rows, cols] = useBoard((s) => s.matrixSize);
  const aug = useBoard((s) => s.matrixAug);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const shown = hover ?? [rows, cols];

  return (
    <div className="picker" onPointerDown={(e) => e.stopPropagation()}>
      <div className="picker-head">
        <span>{T.matrix.size}</span>
        <b>
          {shown[0]} × {shown[1]}
        </b>
      </div>
      <div className="picker-grid" style={{ gridTemplateColumns: `repeat(${MAX_C}, 1fr)` }} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: MAX_R * MAX_C }, (_, k) => {
          const r = Math.floor(k / MAX_C) + 1, c = (k % MAX_C) + 1;
          const on = r <= shown[0] && c <= shown[1];
          const isAugCol = aug && c === shown[1] && on;
          return (
            <button
              key={k}
              className={`picker-cell${on ? " is-on" : ""}${isAugCol ? " is-aug" : ""}`}
              onMouseEnter={() => setHover([r, c])}
              onClick={() => useBoard.setState({ matrixSize: [r, c] })}
              aria-label={`${r} × ${c}`}
            />
          );
        })}
      </div>
      <label className="picker-check">
        <input type="checkbox" checked={aug} onChange={(e) => useBoard.setState({ matrixAug: e.target.checked })} />
        {T.matrix.augmented}
      </label>
      <p className="picker-hint">{T.matrix.pick}</p>
    </div>
  );
}
