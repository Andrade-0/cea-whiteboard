import { describe, expect, it } from "vitest";
import { determinant, inverse, parseMatrix, parseNumber, rank, solve } from "../linalg";

const M = (cells: (string | number)[][]) => parseMatrix(cells.map((r) => r.map(String))).m!;
const show = (m: { toString(): string }[][]) => m.map((r) => r.map(String));

describe("parseNumber", () => {
  it("reads what people type", () => {
    expect(String(parseNumber("−1/2"))).toBe("−1/2");
    expect(String(parseNumber("0,5"))).toBe("1/2");
    expect(String(parseNumber("2.25"))).toBe("9/4");
    expect(String(parseNumber("(-3)"))).toBe("−3");
    expect(String(parseNumber("4/6"))).toBe("2/3");
    expect(String(parseNumber(""))).toBe("0");
  });
  it("refuses parameters and junk", () => {
    expect(parseNumber("k")).toBeNull();
    expect(parseNumber("1-k")).toBeNull();
    expect(parseNumber("1/0")).toBeNull();
    expect(parseMatrix([["1", "k"]]).bad).toEqual([[0, 1]]);
  });
});

describe("study programme exercises (solutions checked by hand)", () => {
  it("E5: det P = 2 and P⁻¹", () => {
    const P = M([[1, 0, 2], [2, 1, 3], [0, 1, 1]]);
    expect(String(determinant(P))).toBe("2");
    expect(show(inverse(P)!)).toEqual([
      ["−1", "1", "−1"],
      ["−1", "1/2", "1/2"],
      ["1", "−1/2", "1/2"],
    ]);
  });
  it("E6: det Q = 8 (4×4, Laplace by row 3)", () => {
    expect(String(determinant(M([[2, 0, 1, 0], [1, 3, 0, 2], [0, 0, 4, 0], [1, 1, 0, 1]])))).toBe("8");
  });
  it("E8: Cramer system has Δ = −9 and solution (1, 1, 2)", () => {
    const A = M([[2, 1, -1], [1, -1, 1], [3, 2, 1]]);
    expect(String(determinant(A))).toBe("−9");
    expect(solve(A, M([[1, 2, 7]])[0])!.map(String)).toEqual(["1", "1", "2"]);
  });
  it("E2: car(M) = 2", () => {
    expect(rank(M([[1, 2, -1, 3], [2, 4, 1, 0], [3, 6, 0, 3]]))).toBe(2);
  });
  it("singular matrices have no inverse and det 0", () => {
    const S = M([[1, 2], [2, 4]]);
    expect(String(determinant(S))).toBe("0");
    expect(inverse(S)).toBeNull();
  });
  it("row swaps flip the sign of the determinant", () => {
    expect(String(determinant(M([[0, 1], [1, 0]])))).toBe("−1");
  });
});
