import { describe, expect, it } from "vitest";
import { parseMatrix, rank, type FracMatrix } from "../linalg";
import { checkStep, eliminate, laplace, opLabel, parseOp, sarrus, solveSystem, stepLabels } from "../solver";

const M = (cells: (string | number)[][]): FracMatrix => parseMatrix(cells.map((r) => r.map(String))).m!;
const show = (m: FracMatrix) => m.map((r) => r.map(String));
const isInt = (m: FracMatrix) => m.every((r) => r.every((v) => v.isInt()));

describe("eliminate (notebook-style steps)", () => {
  it("E3: first step is L2 → L2 − 2L1, L3 → L3 − L1, all integers", () => {
    const e = eliminate(M([[1, 1, 1, 6], [2, -1, 1, 3], [1, 2, -1, 2]]), 3, false);
    const labels = stepLabels(e.steps[0], 3);
    expect(labels).toEqual(["", "L2 -> L2 - 2L1", "L3 -> L3 - L1"]);
    expect(e.steps.every((s) => isInt(s.m))).toBe(true);
    expect(e.rank).toBe(3);
    // the last row is tidied to 0 0 1 | 3 (z = 3) in a single step
    const last = e.steps[e.steps.length - 1];
    expect(opLabel(last.ops[0])).toBe("L3 -> -L3 ÷ 7");
    expect(last.m[2].map(String)).toEqual(["0", "0", "1", "3"]);
  });

  it("uses cross-multiplication instead of fractions", () => {
    const e = eliminate(M([[2, 3], [3, 5]]), 2, false);
    // no pivot ±1 available: 3L2 − ... keeps integers
    expect(e.steps.flatMap((s) => s.ops).every((o) => o.kind !== "comb" || (o.a.isInt() && o.b.isInt()))).toBe(true);
    expect(e.steps.every((s) => isInt(s.m))).toBe(true);
  });

  it("prefers a pivot equal to 1 by swapping rows", () => {
    const e = eliminate(M([[3, 1], [1, 2]]), 2, false);
    expect(opLabel(e.steps[0].ops[0])).toBe("L1 <-> L2");
  });

  it("E2: rank 2 and the reduced form is unique", () => {
    const A = M([[1, 2, -1, 3], [2, 4, 1, 0], [3, 6, 0, 3]]);
    const e = eliminate(A, 4, true);
    expect(e.rank).toBe(rank(A));
    expect(show(e.final)).toEqual([
      ["1", "2", "0", "1"],
      ["0", "0", "1", "−2"],
      ["0", "0", "0", "0"],
    ]);
  });

  it("E5: Gauss-Jordan on [P | I] ends with [I | P⁻¹]", () => {
    const PI = M([[1, 0, 2, 1, 0, 0], [2, 1, 3, 0, 1, 0], [0, 1, 1, 0, 0, 1]]);
    const e = eliminate(PI, 3, true);
    expect(show(e.final.map((r) => r.slice(3)))).toEqual([
      ["−1", "1", "−1"],
      ["−1", "1/2", "1/2"],
      ["1", "−1/2", "1/2"],
    ]);
    expect(show(e.final.map((r) => r.slice(0, 3)))).toEqual([
      ["1", "0", "0"],
      ["0", "1", "0"],
      ["0", "0", "1"],
    ]);
  });

  it("clears fractions first", () => {
    const e = eliminate(M([["1/2", "1"], ["1/3", "2"]]), 2, false);
    expect(opLabel(e.steps[0].ops[0])).toBe("L1 -> 2L1");
    expect(isInt(e.steps[0].m)).toBe(true);
  });
});

describe("determinants explained", () => {
  it("Sarrus on E5", () => {
    const s = sarrus(M([[1, 0, 2], [2, 1, 3], [0, 1, 1]]));
    expect([String(s.posSum), String(s.negSum), String(s.det)]).toEqual(["5", "3", "2"]);
  });
  it("Laplace on E6 chooses the row with three zeros", () => {
    const l = laplace(M([[2, 0, 1, 0], [1, 3, 0, 2], [0, 0, 4, 0], [1, 1, 0, 1]]));
    expect(l.byRow).toBe(true);
    expect(l.index).toBe(2);
    expect(l.terms).toHaveLength(1);
    expect([l.terms[0].sign, String(l.terms[0].a), String(l.terms[0].minorDet), String(l.det)]).toEqual([1, "4", "2", "8"]);
  });
});

describe("systems", () => {
  it("SPD: E3 gives (1, 2, 3)", () => {
    const s = solveSystem(M([[1, 1, 1, 6], [2, -1, 1, 3], [1, 2, -1, 2]]), 3);
    expect(s.kind === "SPD" && s.values.map(String)).toEqual(["1", "2", "3"]);
  });
  it("SPI: general solution with a parameter", () => {
    const s = solveSystem(M([[1, 1, 1, 1], [2, 2, 2, 2], [1, -1, 0, 0]]), 3);
    expect(s.kind).toBe("SPI");
    if (s.kind === "SPI") {
      expect(s.degree).toBe(1);
      expect(s.exprs).toEqual(["1/2 − 1/2t", "1/2 − 1/2t", "t"]);
    }
  });
  it("SI", () => {
    expect(solveSystem(M([[1, 1, 1], [1, 1, 2]]), 2).kind).toBe("SI");
  });
});

describe("checking a written step", () => {
  const prev = [["1", "1", "1", "6"], ["2", "-1", "1", "3"], ["1", "2", "-1", "2"]];
  it("accepts a correct step with the usual notations", () => {
    expect(checkStep(prev, ["", "L2 → L2 − 2L1", "L₃ - L₁"], [["1", "1", "1", "6"], ["0", "-3", "-1", "-9"], ["0", "1", "-2", "-4"]])).toEqual({ ok: true });
  });
  it("points at the wrong cell", () => {
    const r = checkStep(prev, ["", "L2 - 2L1", "L3 - L1"], [["1", "1", "1", "6"], ["0", "-3", "1", "-9"], ["0", "1", "-2", "-4"]]);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "cell") expect([r.row, r.col, String(r.expected), String(r.got)]).toEqual([1, 2, "−1", "1"]);
  });
  it("understands swaps, scaling and cross-multiplication", () => {
    expect(parseOp("L1 <-> L3", 0)?.swap).toEqual([0, 2]);
    expect(String(parseOp("L2 ÷ 3", 1)?.combo.get(1))).toBe("1/3");
    expect(String(parseOp("L3 → −L3 ÷ 7", 2)?.combo.get(2))).toBe("−1/7");
    const c = parseOp("L2 -> 3L2 - 2L1", 1)!;
    expect([String(c.combo.get(1)), String(c.combo.get(0))]).toEqual(["3", "−2"]);
    expect(parseOp("qualquer coisa", 0)).toBeNull();
  });
});
