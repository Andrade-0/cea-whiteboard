import { describe, expect, it } from "vitest";
import { changedCells, formatCell, formatText, matrixLayout, resize, systemToAugmented } from "../matrix";
import type { MatrixEl } from "../types";

const base = (cells: string[][], extra: Partial<MatrixEl> = {}): MatrixEl => ({
  id: "m",
  type: "matrix",
  x: 0,
  y: 0,
  fontSize: 30,
  cells,
  delim: "bracket",
  aug: null,
  label: "",
  ops: cells.map(() => ""),
  showOps: false,
  rowHl: {},
  colHl: {},
  cellHl: {},
  ...extra,
});

describe("formatCell", () => {
  it("prints real minus, powers and products", () => {
    expect(formatCell("-3")).toBe("−3");
    expect(formatCell("1-k^2")).toBe("1−k²");
    expect(formatCell("(1-k)(2+k)")).toBe("(1−k)(2+k)");
    expect(formatCell("2*x")).toBe("2·x");
    expect(formatCell(" 1 / 2 ")).toBe("1/2");
    expect(formatCell("A^-1")).toBe("A⁻¹");
  });
  it("writes indices as subscripts", () => {
    expect(formatCell("3X1+X2")).toBe("3X₁+X₂");
    expect(formatCell("2x1 - x_2 + x_{10} = 4")).toBe("2x₁ − x₂ + x₁₀ = 4");
    expect(formatCell("L2 - 2L1")).toBe("L₂ − 2L₁");
    // plain numbers and powers are left alone
    expect(formatCell("12")).toBe("12");
    expect(formatCell("x^2 + 3")).toBe("x² + 3");
    expect(formatCell("det2")).toBe("det2");
    expect(formatCell("L2 -> L2 - 2L1")).toBe("L₂ → L₂ − 2L₁");
  });
  it("formats the Text tool lightly", () => {
    expect(formatText("L2 <- L2 - 2L1")).toBe("L₂ ← L₂ - 2L₁");
    expect(formatText("Troca L1 com L3, depois x1 = 2")).toBe("Troca L₁ com L₃, depois x₁ = 2");
    // ordinary writing is left alone
    expect(formatText("Sábado às 18h30, matriz 3x3, pré-requisito, Exercício 12")).toBe("Sábado às 18h30, matriz 3x3, pré-requisito, Exercício 12");
    expect(formatText("E3 e A^-1")).toBe("E₃ e A⁻¹");
  });
});

describe("changedCells", () => {
  it("marks only cells whose value changed", () => {
    const prev = [["1", "1", "1", "6"], ["2", "-1", "1", "3"]];
    const next = [["1", "1", "1", "6"], ["0", "−1", "-1", "-9"]];
    // "−1" (typed with a real minus) equals "-1"
    expect([...changedCells(prev, next)].sort()).toEqual(["1,0", "1,2", "1,3"]);
  });
  it("treats new rows/columns as changed", () => {
    expect(changedCells([["1"]], [["1", "2"]]).has("0,1")).toBe(true);
  });
});

describe("resize", () => {
  it("keeps existing values and clamps the augmented bar", () => {
    const m = base([["1", "2", "3"], ["4", "5", "6"]], { aug: 2 });
    const r = resize(m, 3, 2);
    expect(r.cells).toEqual([["1", "2"], ["4", "5"], ["", ""]]);
    expect(r.ops).toHaveLength(3);
    expect(r.aug).toBe(1);
    expect(resize(m, 2, 1).aug).toBeNull();
  });
});

describe("matrixLayout", () => {
  const measure = (t: string, fs: number) => t.length * fs * 0.5;
  it("widens columns to fit their widest cell", () => {
    const L = matrixLayout(base([["1", "(1−k)(2+k)"], ["2", "3"]]), measure);
    expect(L.colW[1]).toBeGreaterThan(L.colW[0]);
    expect(L.height).toBeCloseTo(2 * 30 * 1.55);
  });
  it("Sarrus on a 3×3 repeats two columns after the matrix (not on 2×2 or [A|b])", () => {
    const m3 = base([["1", "0", "2"], ["2", "1", "3"], ["0", "1", "1"]], { delim: "bar" });
    const off = matrixLayout(m3, measure);
    const on = matrixLayout({ ...m3, sarrus: "both" }, measure);
    expect(on.extX).toHaveLength(2);
    expect(on.width).toBeGreaterThan(off.width + on.colW[0] + on.colW[1] - 1);
    expect(matrixLayout(base([["1", "2"], ["3", "4"]], { sarrus: "plus" }), measure).extX).toHaveLength(0);
    expect(matrixLayout({ ...m3, sarrus: "both", aug: 2 }, measure).extX).toHaveLength(0);
  });
  it("reserves room for the label and the operations", () => {
    const plain = matrixLayout(base([["1"]]), measure);
    const full = matrixLayout(base([["1"]], { label: "A =", showOps: true, ops: ["L2 − 2L1"] }), measure);
    expect(full.left).toBeGreaterThan(0);
    expect(full.width).toBeGreaterThan(plain.width + 100);
  });
});

describe("systemToAugmented", () => {
  it("reads the E8 system from the study programme", () => {
    const r = systemToAugmented("2x + y - z = 1\nx - y + z = 2\n3x + 2y + z = 7");
    expect(r?.vars).toEqual(["x", "y", "z"]);
    expect(r?.cells).toEqual([
      ["2", "1", "-1", "1"],
      ["1", "-1", "1", "2"],
      ["3", "2", "1", "7"],
    ]);
  });
  it("supports parameters, missing variables and indexed unknowns", () => {
    expect(systemToAugmented("x + y + kz = 1\nkx + y = 1")?.cells).toEqual([
      ["1", "1", "k", "1"],
      ["k", "1", "0", "1"],
    ]);
    expect(systemToAugmented("x1 - 3x2 = 0\n2x2 + x3 = 4")?.vars).toEqual(["x1", "x2", "x3"]);
    expect(systemToAugmented("1/2x − y = 3")?.cells).toEqual([["1/2", "-1", "3"]]);
  });
  it("rejects lines without an equation", () => {
    expect(systemToAugmented("2x + y")).toBeNull();
  });
});
