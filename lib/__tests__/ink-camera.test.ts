import { describe, expect, it } from "vitest";
import { Stabilizer, catchUp, snapAngle, straighten } from "../ink";
import { fitBox, toScreen, toWorld, zoomAt } from "../camera";

describe("Stabilizer", () => {
  it("ignores jitter inside the rope radius", () => {
    const s = new Stabilizer(6);
    s.reset(0, 0);
    expect(s.update(3, -2)).toBeNull();
    expect(s.update(-4, 1)).toBeNull();
  });
  it("trails the pointer by exactly the radius once pulled", () => {
    const s = new Stabilizer(6);
    s.reset(0, 0);
    const p = s.update(20, 0)!;
    expect(p[0]).toBeCloseTo(14);
    expect(p[1]).toBeCloseTo(0);
  });
  it("catchUp fills the gap to the release point", () => {
    const pts = catchUp([14, 0], [20, 0], 2);
    expect(pts[pts.length - 1]).toEqual([20, 0]);
    expect(pts.length).toBe(3);
  });
});

describe("straight lines", () => {
  it("straighten keeps both ends", () => {
    const out = straighten([[0, 0, 0.5], [5, 9, 0.5], [40, 0, 0.5]]);
    expect(out[0].slice(0, 2)).toEqual([0, 0]);
    expect(out[out.length - 1].slice(0, 2)).toEqual([40, 0]);
    expect(out.every((p) => p[1] === 0)).toBe(true);
  });
  it("snapAngle snaps to 15° steps", () => {
    const [x, y] = snapAngle(0, 0, 100, 4);
    expect(y).toBeCloseTo(0);
    expect(x).toBeCloseTo(Math.hypot(100, 4));
  });
});

describe("camera", () => {
  it("round-trips world ↔ screen", () => {
    const cam = { x: 120, y: -40, z: 1.7 };
    const [sx, sy] = toScreen(cam, 300, 200);
    const [wx, wy] = toWorld(cam, sx, sy);
    expect(wx).toBeCloseTo(300);
    expect(wy).toBeCloseTo(200);
  });
  it("zoomAt keeps the point under the cursor fixed", () => {
    const cam = { x: 10, y: 20, z: 1 };
    const before = toWorld(cam, 400, 300);
    const after = toWorld(zoomAt(cam, 400, 300, 2.5), 400, 300);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });
  it("fitBox shows the whole box", () => {
    const cam = fitBox({ minX: 0, minY: 0, maxX: 1000, maxY: 400 }, 800, 600, 50);
    const [x1, y1] = toScreen(cam, 0, 0);
    const [x2, y2] = toScreen(cam, 1000, 400);
    expect(x1).toBeGreaterThanOrEqual(49);
    expect(x2).toBeLessThanOrEqual(751);
    expect(y1).toBeGreaterThanOrEqual(0);
    expect(y2).toBeLessThanOrEqual(600);
  });
});
