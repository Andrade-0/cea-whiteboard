"use client";

import { useMemo, useState } from "react";
import type { MatrixEl } from "@/lib/types";
import { determinant, inverse, parseMatrix, rank, type Frac, type FracMatrix } from "@/lib/linalg";
import { checkStep, eliminate, laplace, sarrus, solveSystem, stepLabels, varNames } from "@/lib/solver";
import { formatCell } from "@/lib/matrix";
import { writeSteps } from "@/lib/actions";
import { T } from "@/lib/strings";
import { IconClose } from "./icons";

const p = (v: Frac) => (v.isNeg() ? `(${v})` : v.toString());
const sub = (n: number) => String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]);

/**
 * "Verificar": exact results and suggested steps for the matrix the mentor is
 * working on. Shown only in this browser; nothing is drawn unless the mentor
 * presses "Escrever no quadro".
 */
export default function VerifyPanel({ m, prev, onClose }: { m: MatrixEl; prev?: MatrixEl; onClose: () => void }) {
  const [tab, setTab] = useState<"result" | "steps">("result");
  const cols = m.cells[0].length;
  const n = m.aug ?? cols; // coefficient columns
  const isAugIdentity = m.aug !== null && cols === 2 * n && m.cells.length === n;
  const [reduced, setReduced] = useState(isAugIdentity);

  const parsed = useMemo(() => parseMatrix(m.cells), [m.cells]);
  const full = parsed.m;

  // check of the step written next to the previous matrix
  const check = useMemo(() => {
    if (!prev || !prev.ops.some((o) => o.trim())) return null;
    return checkStep(prev.cells, prev.ops, m.cells);
  }, [prev, m.cells]);

  const elim = useMemo(() => (full ? eliminate(full, n, reduced) : null), [full, n, reduced]);

  let body: React.ReactNode;
  if (!full) {
    const [i, j] = parsed.bad[0];
    body = <p className="verify-note">{T.verify.notNumbers(i + 1, j + 1)}</p>;
  } else if (tab === "result") {
    body = <Result a={full.map((r) => r.slice(0, n))} b={m.aug !== null ? full.map((r) => r.slice(n)) : null} isAugIdentity={isAugIdentity} full={full} n={n} />;
  } else {
    body = (
      <>
        <div className="verify-toggle" role="radiogroup">
          <button className={!reduced ? "is-on" : ""} onClick={() => setReduced(false)}>
            {T.verify.echelon}
          </button>
          <button className={reduced ? "is-on" : ""} onClick={() => setReduced(true)}>
            {isAugIdentity ? T.verify.gaussJordan : T.verify.reduced}
          </button>
        </div>
        {elim && elim.steps.length === 0 ? (
          <p className="verify-note">{T.verify.alreadyDone}</p>
        ) : (
          <ol className="verify-steps">
            {elim?.steps.map((s, k) => (
              <li key={k}>
                <div className="vs-ops">
                  {stepLabels(s, s.m.length)
                    .filter(Boolean)
                    .map((l, q) => (
                      <span key={q}>{formatCell(l)}</span>
                    ))}
                </div>
                <Grid m={s.m} aug={m.aug} />
              </li>
            ))}
          </ol>
        )}
        {elim && elim.steps.length > 0 && (
          <button
            className="verify-write"
            onClick={() => {
              writeSteps(
                m.id,
                elim.steps.map((s) => ({ labels: stepLabels(s, s.m.length), cells: s.m.map((r) => r.map(String)) })),
              );
              onClose();
            }}
          >
            {T.verify.write(elim.steps.length)}
          </button>
        )}
      </>
    );
  }

  return (
    <div className="verify" role="dialog" aria-label={T.verify.title} onPointerDown={(e) => e.stopPropagation()}>
      <header>
        <b>{T.verify.title}</b>
        <button onClick={onClose} aria-label={T.cancel}>
          <IconClose width={16} height={16} />
        </button>
      </header>

      {check && <StepCheckBanner check={check} />}

      <div className="verify-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "result"} className={tab === "result" ? "is-on" : ""} onClick={() => setTab("result")}>
          {T.verify.tabResult}
        </button>
        <button role="tab" aria-selected={tab === "steps"} className={tab === "steps" ? "is-on" : ""} onClick={() => setTab("steps")}>
          {T.verify.tabSteps}
        </button>
      </div>

      <div className="verify-body">{body}</div>
      <p className="verify-private">{T.verify.private}</p>
    </div>
  );
}

function StepCheckBanner({ check }: { check: ReturnType<typeof checkStep> }) {
  if (check.ok) return <p className="verify-check is-ok">✓ {T.verify.stepOk}</p>;
  let text: string = T.verify.stepCantCheck;
  if (check.reason === "cell") text = T.verify.stepWrong(check.row + 1, check.col + 1, check.expected.toString(), check.got.toString());
  if (check.reason === "op") text = T.verify.stepBadOp(check.row + 1, check.label);
  return <p className={`verify-check${check.reason === "cell" ? " is-wrong" : ""}`}>{text}</p>;
}

function Result({ a, b, isAugIdentity, full, n }: { a: FracMatrix; b: FracMatrix | null; isAugIdentity: boolean; full: FracMatrix; n: number }) {
  const square = a.length === n;
  const out: React.ReactNode[] = [];

  if (square) {
    const det = determinant(a);
    out.push(<Line key="det" label={b ? "det A" : "det"} value={det.toString()} strong />);
    if (n === 3) {
      const s = sarrus(a);
      const prod = (xs: Frac[]) => xs.map(p).join("·");
      out.push(
        <Explain key="sarrus" title="Sarrus">
          ({s.pos.map(prod).join(" + ")}) − ({s.neg.map(prod).join(" + ")})
          <br />= {s.posSum.toString()} − {p(s.negSum)} = <b>{s.det.toString()}</b>
        </Explain>,
      );
    }
    if (n >= 2) {
      const l = laplace(a);
      const where = l.byRow ? T.verify.byRow(l.index + 1) : T.verify.byCol(l.index + 1);
      out.push(
        <Explain key="laplace" title={`Laplace · ${where}`}>
          {l.terms.length === 0
            ? "0"
            : l.terms.map((t, k) => (
                <span key={k}>
                  {k === 0 ? (t.sign < 0 ? "− " : "") : t.sign < 0 ? " − " : " + "}
                  {p(t.a)}·M{sub(t.i + 1)}{sub(t.j + 1)}
                </span>
              ))}
          <br />
          {l.terms.length > 0 && (
            <>
              ={" "}
              {l.terms.map((t, k) => (
                <span key={k}>
                  {k === 0 ? (t.sign < 0 ? "− " : "") : t.sign < 0 ? " − " : " + "}
                  {p(t.a)}·{p(t.minorDet)}
                </span>
              ))}{" "}
              = <b>{l.det.toString()}</b>
            </>
          )}
        </Explain>,
      );
    }
    if (!b) {
      const inv = det.isZero() ? null : inverse(a);
      out.push(
        inv ? (
          <div key="inv" className="verify-inv">
            <span className="verify-label">A⁻¹</span>
            <Grid m={inv} aug={null} />
          </div>
        ) : (
          <p key="noinv" className="verify-note">{T.verify.noInverse}</p>
        ),
      );
    }
  }

  if (isAugIdentity) {
    const done = eliminate(full, n, true).final;
    const left = done.map((r) => r.slice(0, n));
    const ok = left.every((r, i) => r.every((v, j) => v.toString() === (i === j ? "1" : "0")));
    out.push(
      ok ? (
        <div key="inv2" className="verify-inv">
          <span className="verify-label">A⁻¹</span>
          <Grid m={done.map((r) => r.slice(n))} aug={null} />
        </div>
      ) : (
        <p key="noinv2" className="verify-note">{T.verify.noInverse}</p>
      ),
    );
  } else if (b) {
    const rA = rank(a), rAb = rank(full);
    out.push(<Line key="rank" label="car(A) · car(A|b)" value={`${rA} · ${rAb}`} />);
    if (b[0].length === 1) {
      const s = solveSystem(full, n);
      if (s.kind === "SI") out.push(<Line key="kind" label={T.verify.system} value={T.verify.si} strong />);
      else if (s.kind === "SPD") {
        out.push(<Line key="kind" label={T.verify.system} value={T.verify.spd} strong />);
        out.push(
          <Explain key="sol" title={T.verify.solution}>
            {s.vars.map((v, k) => (
              <span key={v}>
                {formatCell(v)} = <b>{s.values[k].toString()}</b>
                {k < s.vars.length - 1 ? ",  " : ""}
              </span>
            ))}
          </Explain>,
        );
      } else {
        out.push(<Line key="kind" label={T.verify.system} value={T.verify.spi(s.degree)} strong />);
        out.push(
          <Explain key="sol" title={`${T.verify.general} (${s.params.join(", ")} ∈ ℝ)`}>
            {s.vars.map((v, k) => (
              <span key={v} className="verify-eq">
                {formatCell(v)} = {s.exprs[k]}
              </span>
            ))}
          </Explain>,
        );
      }
    }
  } else if (!square) {
    out.push(<Line key="rank" label={T.verify.rank} value={String(rank(a))} />);
  }

  // the unknowns' names are only a convention: say which ones we used
  if (b && b[0].length === 1 && !isAugIdentity) out.push(<p key="vars" className="verify-private">{T.verify.varsNote(varNames(n).map(formatCell).join(", "))}</p>);
  return <>{out}</>;
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="verify-line">
      <span className="verify-label">{label}</span>
      {strong ? <b>{value}</b> : <span>{value}</span>}
    </div>
  );
}

function Explain({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="verify-explain">
      <span className="verify-label">{title}</span>
      <div>{children}</div>
    </div>
  );
}

function Grid({ m, aug }: { m: FracMatrix; aug: number | null }) {
  const cols = m[0]?.length ?? 0;
  return (
    <div className="verify-grid" style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}>
      {m.flat().map((v, k) => (
        <span key={k} className={aug !== null && k % cols === aug ? "is-aug" : ""}>
          {v.toString()}
        </span>
      ))}
    </div>
  );
}
