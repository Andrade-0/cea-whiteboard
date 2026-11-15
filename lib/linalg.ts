// Exact linear algebra on the matrix cells the mentor typed (used only by "Verificar").

// BigInt() calls instead of B0 literals: the project targets ES2017 syntax.
const B0 = BigInt(0), B1 = BigInt(1), B10 = BigInt(10);

/** Exact rational number n/d with d > 0, kept in lowest terms. */
export class Frac {
  readonly n: bigint;
  readonly d: bigint;
  constructor(n: bigint, d: bigint = B1) {
    if (d === B0) throw new Error("division by zero");
    if (d < B0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n < B0 ? -n : n, d);
    this.n = g ? n / g : n;
    this.d = g ? d / g : d;
  }
  static of(v: number | bigint) {
    return new Frac(BigInt(v));
  }
  add(o: Frac) {
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Frac) {
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Frac) {
    return new Frac(this.n * o.n, this.d * o.d);
  }
  div(o: Frac) {
    return new Frac(this.n * o.d, this.d * o.n);
  }
  neg() {
    return new Frac(-this.n, this.d);
  }
  isZero() {
    return this.n === B0;
  }
  /** "−3", "1/2", "−7/4" (with a real minus sign) */
  toString() {
    const sign = this.n < B0 ? "−" : "";
    const a = this.n < B0 ? -this.n : this.n;
    return this.d === B1 ? `${sign}${a}` : `${sign}${a}/${this.d}`;
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a;
}

const ZERO = Frac.of(0);
const ONE = Frac.of(1);

/**
 * Parses what people type in a cell: "3", "-2", "−1/2", "0,5", "2.25", "(3)", "".
 * Returns null for anything with letters (parameters like k) or other symbols.
 */
export function parseNumber(raw: string): Frac | null {
  let s = raw.trim().replace(/−/g, "-").replace(/\s+/g, "").replace(/,/g, ".");
  while (/^\(.*\)$/.test(s)) s = s.slice(1, -1);
  if (s === "" || s === "-") return s === "" ? ZERO : null;
  const frac = s.match(/^([+-]?)(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/);
  if (!frac) return null;
  const [, sign, a, b] = frac;
  let v = decimal(a);
  if (b !== undefined) {
    const den = decimal(b);
    if (den.isZero()) return null;
    v = v.div(den);
  }
  return sign === "-" ? v.neg() : v;
}

function decimal(s: string): Frac {
  const [int, dec = ""] = s.split(".");
  return new Frac(BigInt(int + dec), B10 ** BigInt(dec.length));
}

export type FracMatrix = Frac[][];

/** Parses all cells; returns the cell positions that are not plain numbers. */
export function parseMatrix(cells: string[][]): { m: FracMatrix | null; bad: [number, number][] } {
  const bad: [number, number][] = [];
  const m = cells.map((row, i) =>
    row.map((c, j) => {
      const f = parseNumber(c);
      if (!f) bad.push([i, j]);
      return f ?? ZERO;
    }),
  );
  return { m: bad.length ? null : m, bad };
}

const clone = (m: FracMatrix) => m.map((r) => r.slice());

/** Determinant by exact Gaussian elimination. */
export function determinant(a: FracMatrix): Frac {
  const n = a.length;
  if (!n || a.some((r) => r.length !== n)) throw new Error("not square");
  const m = clone(a);
  let det = ONE;
  for (let c = 0; c < n; c++) {
    let p = c;
    while (p < n && m[p][c].isZero()) p++;
    if (p === n) return ZERO;
    if (p !== c) {
      [m[p], m[c]] = [m[c], m[p]];
      det = det.neg();
    }
    det = det.mul(m[c][c]);
    for (let r = c + 1; r < n; r++) {
      if (m[r][c].isZero()) continue;
      const f = m[r][c].div(m[c][c]);
      for (let k = c; k < n; k++) m[r][k] = m[r][k].sub(f.mul(m[c][k]));
    }
  }
  return det;
}

/** Rank (característica) by exact row reduction. */
export function rank(a: FracMatrix): number {
  const m = clone(a);
  const rows = m.length, cols = m[0]?.length ?? 0;
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let p = r;
    while (p < rows && m[p][c].isZero()) p++;
    if (p === rows) continue;
    [m[p], m[r]] = [m[r], m[p]];
    for (let i = r + 1; i < rows; i++) {
      if (m[i][c].isZero()) continue;
      const f = m[i][c].div(m[r][c]);
      for (let k = c; k < cols; k++) m[i][k] = m[i][k].sub(f.mul(m[r][k]));
    }
    r++;
  }
  return r;
}

/** Inverse by exact Gauss-Jordan on [A | I]; null when det A = 0. */
export function inverse(a: FracMatrix): FracMatrix | null {
  const n = a.length;
  if (!n || a.some((r) => r.length !== n)) throw new Error("not square");
  const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? ONE : ZERO))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    while (p < n && m[p][c].isZero()) p++;
    if (p === n) return null;
    [m[p], m[c]] = [m[c], m[p]];
    const piv = m[c][c];
    for (let k = 0; k < 2 * n; k++) m[c][k] = m[c][k].div(piv);
    for (let r = 0; r < n; r++) {
      if (r === c || m[r][c].isZero()) continue;
      const f = m[r][c];
      for (let k = 0; k < 2 * n; k++) m[r][k] = m[r][k].sub(f.mul(m[c][k]));
    }
  }
  return m.map((row) => row.slice(n));
}

/** Solution of [A | b] when the system has exactly one solution (square, det ≠ 0). */
export function solve(a: FracMatrix, b: Frac[]): Frac[] | null {
  const inv = inverse(a);
  if (!inv) return null;
  return inv.map((row) => row.reduce((acc, v, j) => acc.add(v.mul(b[j])), ZERO));
}
