"use client";

import type { MatrixEl } from "@/lib/types";
import { determinant, inverse, parseMatrix, rank, solve, type Frac } from "@/lib/linalg";
import { T } from "@/lib/strings";
import { IconClose } from "./icons";

/**
 * "Verificar": exact result of the matrix the mentor is working on, shown only
 * in this browser (never drawn on the board, so followers don't see it).
 */
export default function VerifyPanel({ m, onClose }: { m: MatrixEl; onClose: () => void }) {
  const n = m.aug ?? m.cells[0].length;
  const A = m.cells.map((r) => r.slice(0, n));
  const b = m.aug !== null ? m.cells.map((r) => r.slice(n)) : null;
  const parsedA = parseMatrix(A);
  const parsedB = b ? parseMatrix(b) : null;
  const bad = [...parsedA.bad, ...(parsedB?.bad.map(([i, j]) => [i, j + n] as [number, number]) ?? [])];

  let body: React.ReactNode;
  if (bad.length) {
    const [i, j] = bad[0];
    body = <p className="verify-note">{T.verify.notNumbers(i + 1, j + 1)}</p>;
  } else {
    const a = parsedA.m!;
    const square = a.length === n;
    const rows: React.ReactNode[] = [];
    if (square) {
      const det = determinant(a);
      rows.push(<Line key="det" label={b ? "det A" : "det"} value={det.toString()} strong />);
      if (!b) {
        const inv = det.isZero() ? null : inverse(a);
        rows.push(
          inv ? (
            <div key="inv" className="verify-inv">
              <span className="verify-label">{T.verify.inverse}</span>
              <Grid m={inv} />
            </div>
          ) : (
            <p key="noinv" className="verify-note">{T.verify.noInverse}</p>
          ),
        );
      }
    }
    const rA = rank(a);
    rows.push(<Line key="rank" label={b ? "car(A)" : T.verify.rank} value={String(rA)} />);
    if (b && parsedB?.m) {
      const full = a.map((r, i) => [...r, ...parsedB.m![i]]);
      const rAb = rank(full);
      rows.push(<Line key="rankAb" label="car(A|b)" value={String(rAb)} />);
      const unknowns = n;
      const kind = rA < rAb ? T.verify.si : rA === unknowns ? T.verify.spd : T.verify.spi(unknowns - rA);
      rows.push(<Line key="kind" label={T.verify.system} value={kind} strong />);
      if (square && rA === unknowns && parsedB.m[0].length === 1) {
        const x = solve(a, parsedB.m.map((r) => r[0]));
        if (x) rows.push(<Line key="sol" label={T.verify.solution} value={`(${x.map(String).join(", ")})`} strong />);
      }
    }
    body = <>{rows}</>;
  }

  return (
    <div className="verify" role="dialog" aria-label={T.verify.title} onPointerDown={(e) => e.stopPropagation()}>
      <header>
        <b>{T.verify.title}</b>
        <button onClick={onClose} aria-label={T.cancel}>
          <IconClose width={16} height={16} />
        </button>
      </header>
      {body}
      <p className="verify-private">{T.verify.private}</p>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="verify-line">
      <span className="verify-label">{label}</span>
      {strong ? <b>{value}</b> : <span>{value}</span>}
    </div>
  );
}

function Grid({ m }: { m: Frac[][] }) {
  return (
    <div className="verify-grid" style={{ gridTemplateColumns: `repeat(${m[0].length}, auto)` }}>
      {m.flat().map((v, k) => (
        <span key={k}>{v.toString()}</span>
      ))}
    </div>
  );
}
