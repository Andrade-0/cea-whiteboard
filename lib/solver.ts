// Step-by-step solving with "notebook-friendly" row operations (no AI: fixed
// algorithms on exact fractions). Used by the mentor-only "Verificar" panel.
import { determinant, Frac, gcd, parseNumber, type FracMatrix } from "./linalg";

const B0 = BigInt(0), B1 = BigInt(1);
const ZERO = Frac.of(0), ONE = Frac.of(1);

export type RowOp =
  | { kind: "swap"; i: number; j: number }
  /** Li → k·Li (k = 1/d is written "÷ d") */
  | { kind: "scale"; i: number; k: Frac }
  /** Li → a·Li + b·Lj */
  | { kind: "comb"; i: number; a: Frac; j: number; b: Frac };

export interface Step {
  ops: RowOp[];
  /** matrix after the step */
  m: FracMatrix;
}

const clone = (m: FracMatrix) => m.map((r) => r.slice());
const absBig = (x: bigint) => (x < B0 ? -x : x);

// ------------------------------------------------------------------ labels

function coef(k: Frac, first: boolean): string {
  if (k.eq(ONE)) return first ? "" : "+ ";
  if (k.eq(ONE.neg())) return first ? "-" : "- ";
  const s = k.abs().toString();
  if (first) return k.isNeg() ? `-${s}` : s;
  return k.isNeg() ? `- ${s}` : `+ ${s}`;
}

/** Plain-text label as typed on the board ("L2 -> L2 - 2L1"); the board prints it nicely. */
export function opLabel(op: RowOp): string {
  const L = (i: number) => `L${i + 1}`;
  if (op.kind === "swap") return `${L(op.i)} <-> ${L(op.j)}`;
  if (op.kind === "scale") {
    if (op.k.eq(ONE.neg())) return `${L(op.i)} -> -${L(op.i)}`;
    if (op.k.n === B1 && op.k.d > B1) return `${L(op.i)} -> ${L(op.i)} ÷ ${op.k.d}`;
    if (op.k.n === -B1 && op.k.d > B1) return `${L(op.i)} -> -${L(op.i)} ÷ ${op.k.d}`;
    return `${L(op.i)} -> ${coef(op.k, true)}${L(op.i)}`;
  }
  return `${L(op.i)} -> ${coef(op.a, true)}${L(op.i)} ${coef(op.b, false)}${L(op.j)}`;
}

/** Labels per row for one step (swaps are written on the first row involved). */
export function stepLabels(step: Step, rows: number): string[] {
  const out = Array.from({ length: rows }, () => "");
  for (const op of step.ops) out[op.i] = opLabel(op);
  return out;
}

// ------------------------------------------------------------------ applying

export function applyOps(m: FracMatrix, ops: RowOp[]): FracMatrix {
  const src = clone(m);
  const out = clone(m);
  for (const op of ops) {
    if (op.kind === "swap") {
      out[op.i] = src[op.j].slice();
      out[op.j] = src[op.i].slice();
    } else if (op.kind === "scale") {
      out[op.i] = src[op.i].map((v) => v.mul(op.k));
    } else {
      out[op.i] = src[op.i].map((v, c) => v.mul(op.a).add(src[op.j][c].mul(op.b)));
    }
  }
  return out;
}

// ------------------------------------------------------------------ elimination

/** Li → a·Li + b·Lr that zeroes column c, preferring integer coefficients. */
function combFor(i: number, r: number, q: Frac, p: Frac): RowOp {
  // both integers here (fractions are cleared first)
  if (q.isInt() && p.isInt() && q.n % p.n === B0) return { kind: "comb", i, a: ONE, j: r, b: new Frac(-(q.n / p.n)) };
  if (q.isInt() && p.isInt()) {
    const g = gcd(absBig(p.n), absBig(q.n));
    let a = new Frac(p.n / g), b = new Frac(-(q.n / g));
    if (a.isNeg()) {
      a = a.neg();
      b = b.neg();
    }
    return { kind: "comb", i, a, j: r, b };
  }
  return { kind: "comb", i, a: ONE, j: r, b: q.div(p).neg() };
}

/**
 * Rows whose integer entries share a factor > 1 get divided by it (Li → Li ÷ g).
 * When dividing anyway, a negative leading entry is flipped too (Li → −Li ÷ g),
 * so 0 0 −7 | −21 becomes 0 0 1 | 3 in one step.
 */
function simplifyOps(m: FracMatrix, rows: number[]): RowOp[] {
  const ops: RowOp[] = [];
  for (const i of rows) {
    const row = m[i];
    if (!row.every((v) => v.isInt())) continue;
    let g = B0;
    for (const v of row) if (!v.isZero()) g = gcd(g, absBig(v.n));
    if (g <= B1) continue;
    const lead = row.find((v) => !v.isZero());
    ops.push({ kind: "scale", i, k: new Frac(lead?.isNeg() ? -B1 : B1, g) });
  }
  return ops;
}

/** Multiplies rows with fractions by the LCM of their denominators. */
function clearFractionOps(m: FracMatrix): RowOp[] {
  const ops: RowOp[] = [];
  m.forEach((row, i) => {
    let l = B1;
    for (const v of row) l = (l * v.d) / gcd(l, v.d);
    if (l > B1) ops.push({ kind: "scale", i, k: new Frac(l) });
  });
  return ops;
}

export interface Elimination {
  steps: Step[];
  final: FracMatrix;
  /** [row, col] of each pivot */
  pivots: [number, number][];
  rank: number;
}

/**
 * Gaussian (or Gauss-Jordan when `reduced`) elimination with notebook-style
 * steps: pivots ±1 first (swapping rows when it helps), cross-multiplication
 * instead of fractions (L2 → 3L2 − 2L1), and dividing a row only when exact.
 * Only the first `pivotCols` columns get pivots (coefficient part of [A|b] or [A|I]).
 */
export function eliminate(m0: FracMatrix, pivotCols: number, reduced: boolean): Elimination {
  let m = clone(m0);
  const rows = m.length;
  const steps: Step[] = [];
  const push = (ops: RowOp[]) => {
    if (!ops.length) return;
    m = applyOps(m, ops);
    steps.push({ ops, m });
  };

  push(clearFractionOps(m));
  push(simplifyOps(m, m.map((_, i) => i)));

  const pivots: [number, number][] = [];
  let r = 0;
  for (let c = 0; c < pivotCols && r < rows; c++) {
    const cand = [];
    for (let i = r; i < rows; i++) if (!m[i][c].isZero()) cand.push(i);
    if (!cand.length) continue;
    const score = (i: number) => {
      const v = m[i][c].abs();
      return (v.eq(ONE) ? 0 : 1e9) + Number(v.n) / Number(v.d) + i * 1e-6;
    };
    const best = cand.reduce((a, b) => (score(b) < score(a) ? b : a));
    if (best !== r) push([{ kind: "swap", i: r, j: best }]);
    const below: RowOp[] = [];
    for (let i = r + 1; i < rows; i++) if (!m[i][c].isZero()) below.push(combFor(i, r, m[i][c], m[r][c]));
    push(below);
    push(simplifyOps(m, below.map((o) => o.i)));
    pivots.push([r, c]);
    r++;
  }

  if (reduced) {
    for (let k = pivots.length - 1; k >= 0; k--) {
      const [pr, pc] = pivots[k];
      const above: RowOp[] = [];
      for (let i = 0; i < pr; i++) if (!m[i][pc].isZero()) above.push(combFor(i, pr, m[i][pc], m[pr][pc]));
      push(above);
      push(simplifyOps(m, above.map((o) => o.i)));
    }
    // finally make every pivot 1 (the only place where fractions may appear)
    push(pivots.filter(([pr, pc]) => !m[pr][pc].eq(ONE)).map(([pr, pc]) => ({ kind: "scale" as const, i: pr, k: ONE.div(m[pr][pc]) })));
  }
  return { steps, final: m, pivots, rank: r };
}

// ------------------------------------------------------------------ determinants explained

export interface SarrusExplained {
  pos: Frac[][];
  neg: Frac[][];
  posSum: Frac;
  negSum: Frac;
  det: Frac;
}

export function sarrus(a: FracMatrix): SarrusExplained {
  const t = (i: number, j: number, k: number, l: number, p: number, q: number) => [a[i][j], a[k][l], a[p][q]];
  const pos = [t(0, 0, 1, 1, 2, 2), t(0, 1, 1, 2, 2, 0), t(0, 2, 1, 0, 2, 1)];
  const neg = [t(0, 2, 1, 1, 2, 0), t(0, 0, 1, 2, 2, 1), t(0, 1, 1, 0, 2, 2)];
  const prod = (xs: Frac[]) => xs.reduce((x, y) => x.mul(y), ONE);
  const posSum = pos.map(prod).reduce((x, y) => x.add(y), ZERO);
  const negSum = neg.map(prod).reduce((x, y) => x.add(y), ZERO);
  return { pos, neg, posSum, negSum, det: posSum.sub(negSum) };
}

export interface LaplaceTerm {
  i: number;
  j: number;
  sign: 1 | -1;
  a: Frac;
  minor: FracMatrix;
  minorDet: Frac;
}

/** Expansion along the row or column with the most zeros. */
export function laplace(a: FracMatrix): { byRow: boolean; index: number; terms: LaplaceTerm[]; det: Frac } {
  const n = a.length;
  let best = { byRow: true, index: 0, zeros: -1 };
  for (let k = 0; k < n; k++) {
    const rz = a[k].filter((v) => v.isZero()).length;
    const cz = a.filter((row) => row[k].isZero()).length;
    if (rz > best.zeros) best = { byRow: true, index: k, zeros: rz };
    if (cz > best.zeros) best = { byRow: false, index: k, zeros: cz };
  }
  const terms: LaplaceTerm[] = [];
  for (let k = 0; k < n; k++) {
    const i = best.byRow ? best.index : k;
    const j = best.byRow ? k : best.index;
    if (a[i][j].isZero()) continue;
    const minor = a.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== j));
    terms.push({ i, j, sign: (i + j) % 2 === 0 ? 1 : -1, a: a[i][j], minor, minorDet: minor.length ? determinant(minor) : ONE });
  }
  const det = terms.reduce((s, t) => s.add(t.a.mul(t.minorDet).mul(Frac.of(t.sign))), ZERO);
  return { byRow: best.byRow, index: best.index, terms, det };
}

// ------------------------------------------------------------------ systems

export const varNames = (n: number) => (n <= 4 ? ["x", "y", "z", "w"].slice(0, n) : Array.from({ length: n }, (_, k) => `x${k + 1}`));
const PARAMS = ["t", "s", "u", "v", "p", "q"];

export type Solution =
  | { kind: "SI" }
  | { kind: "SPD"; vars: string[]; values: Frac[] }
  | { kind: "SPI"; vars: string[]; exprs: string[]; params: string[]; degree: number };

/** Solution of [A | b] read from its reduced row echelon form. */
export function solveSystem(aug: FracMatrix, n: number): Solution {
  const { final, pivots } = eliminate(aug, n, true);
  const vars = varNames(n);
  if (final.some((row) => row.slice(0, n).every((v) => v.isZero()) && !row[n].isZero())) return { kind: "SI" };
  const pivotOf = new Map(pivots.map(([r, c]) => [c, r]));
  const free = vars.map((_, c) => c).filter((c) => !pivotOf.has(c));
  if (!free.length) return { kind: "SPD", vars, values: vars.map((_, c) => final[pivotOf.get(c)!][n]) };
  const params = free.map((_, k) => PARAMS[k] ?? `t${k + 1}`);
  const exprs = vars.map((_, c) => {
    const fi = free.indexOf(c);
    if (fi >= 0) return params[fi];
    const row = final[pivotOf.get(c)!];
    let out = row[n].isZero() ? "" : row[n].toString();
    free.forEach((fc, k) => {
      const kf = row[fc].neg(); // x_pivot = b − Σ a·t
      if (kf.isZero()) return;
      const mag = kf.abs().eq(ONE) ? "" : kf.abs().toString();
      const term = `${mag}${params[k]}`;
      out = out ? `${out} ${kf.isNeg() ? "−" : "+"} ${term}` : `${kf.isNeg() ? "−" : ""}${term}`;
    });
    return out || "0";
  });
  return { kind: "SPI", vars, exprs, params, degree: free.length };
}

// ------------------------------------------------------------------ checking a written step

const SUBDIGITS: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };

/** Parses one row-operation label into "new row = Σ coef·Lj" (or a swap). */
export function parseOp(raw: string, row: number): { swap?: [number, number]; target: number; combo: Map<number, Frac> } | null {
  let s = raw.replace(/[₀-₉]/g, (d) => SUBDIGITS[d]).replace(/−/g, "-").replace(/[·*×]/g, "").replace(/\s+/g, "");
  s = s.replace(/↔/g, "<->").replace(/⇄/g, "<->").replace(/→|⟶|=>/g, "->").replace(/←|<-(?!>)/g, "->");
  if (!s) return null;
  const sw = s.match(/^L(\d+)<->L(\d+)$/i);
  if (sw) return { swap: [Number(sw[1]) - 1, Number(sw[2]) - 1], target: row, combo: new Map() };
  let target = row;
  const pre = s.match(/^L(\d+)(?:->|=)(.*)$/i);
  if (pre) {
    target = Number(pre[1]) - 1;
    s = pre[2];
  }
  // a trailing divisor applies to the whole expression: "L2/3", "(L2 - L1)÷2"
  let div = ONE;
  const dm = s.match(/^(.*?)(?:÷|\/)(\d+(?:[.,]\d+)?)$/);
  if (dm && /(L\d+|\))$/i.test(dm[1])) {
    s = dm[1];
    div = parseNumber(dm[2]) ?? ONE;
  }
  s = s.replace(/^\((.*)\)$/, "$1");
  const combo = new Map<number, Frac>();
  let rest = s;
  const term = /^([+-]?)(\d+(?:[.,]\d+)?(?:\/\d+)?)?L(\d+)/i;
  while (rest) {
    const m = rest.match(term);
    if (!m) return null;
    let k = m[2] ? parseNumber(m[2]) : ONE;
    if (!k) return null;
    if (m[1] === "-") k = k.neg();
    const j = Number(m[3]) - 1;
    combo.set(j, (combo.get(j) ?? ZERO).add(k.div(div)));
    rest = rest.slice(m[0].length);
  }
  return combo.size ? { target, combo } : null;
}

export type StepCheck =
  | { ok: true }
  | { ok: false; reason: "op"; row: number; label: string }
  | { ok: false; reason: "cell"; row: number; col: number; expected: Frac; got: Frac }
  | { ok: false; reason: "numbers" }
  | { ok: false; reason: "shape" };

/** Checks that `next` is `prev` after the operations written next to `prev`. */
export function checkStep(prev: string[][], ops: string[], next: string[][]): StepCheck {
  if (prev.length !== next.length || prev[0]?.length !== next[0]?.length) return { ok: false, reason: "shape" };
  const P: FracMatrix = [];
  const N: FracMatrix = [];
  for (let i = 0; i < prev.length; i++) {
    const pr = prev[i].map(parseNumber), nr = next[i].map(parseNumber);
    if (pr.some((v) => !v) || nr.some((v) => !v)) return { ok: false, reason: "numbers" };
    P.push(pr as Frac[]);
    N.push(nr as Frac[]);
  }
  const expected = clone(P);
  for (let i = 0; i < ops.length; i++) {
    const label = (ops[i] ?? "").trim();
    if (!label) continue;
    const op = parseOp(label, i);
    if (!op) return { ok: false, reason: "op", row: i, label };
    if (op.swap) {
      const [a, b] = op.swap;
      if (!P[a] || !P[b]) return { ok: false, reason: "op", row: i, label };
      expected[a] = P[b].slice();
      expected[b] = P[a].slice();
      continue;
    }
    if (!P[op.target] || [...op.combo.keys()].some((j) => !P[j])) return { ok: false, reason: "op", row: i, label };
    expected[op.target] = P[0].map((_, c) => [...op.combo].reduce((s, [j, k]) => s.add(P[j][c].mul(k)), ZERO));
  }
  for (let i = 0; i < N.length; i++)
    for (let c = 0; c < N[i].length; c++)
      if (!N[i][c].eq(expected[i][c])) return { ok: false, reason: "cell", row: i, col: c, expected: expected[i][c], got: N[i][c] };
  return { ok: true };
}
