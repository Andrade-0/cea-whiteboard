import { beforeEach, describe, expect, it } from "vitest";
import { appendPages, newBoard } from "../actions";
import { newPage, useBoard } from "../store";
import type { MatrixEl, Page } from "../types";

const matrix = (id: string, prevId?: string): MatrixEl => ({
  id, type: "matrix", x: 0, y: 0, fontSize: 30, cells: [["1"]], delim: "bracket", aug: null,
  label: "", ops: [""], showOps: false, rowHl: {}, colHl: {}, cellHl: {}, prevId,
});

describe("importing a saved board", () => {
  beforeEach(() => {
    const p = newPage();
    p.elements = [matrix("own")];
    useBoard.getState().load([p], 0);
  });

  it("appends pages after the current ones and opens the first imported page", () => {
    const saved: Page[] = [
      { id: "a", title: "Gauss", bg: "grid", camera: { x: 0, y: 0, z: 1 }, elements: [matrix("m1"), matrix("m2", "m1")] },
      { id: "b", title: "Inversa", bg: "plain", camera: { x: 0, y: 0, z: 1 }, elements: [] },
    ];
    appendPages(saved);
    const s = useBoard.getState();
    expect(s.pages.map((p) => p.title)).toEqual([undefined, "Gauss", "Inversa"]);
    expect(s.current).toBe(1);
    expect(s.pages[0].elements[0].id).toBe("own"); // nothing lost
    const [m1, m2] = s.pages[1].elements as MatrixEl[];
    expect(m1.id).not.toBe("m1"); // fresh ids, so the same file can be imported twice
    expect(m2.prevId).toBe(m1.id); // "próximo passo" links survive
    expect(s.pages[1].id).not.toBe("a");
  });

  it("can import the same file twice without id clashes", () => {
    const saved: Page[] = [{ id: "a", bg: "grid", camera: { x: 0, y: 0, z: 1 }, elements: [matrix("m1")] }];
    appendPages(saved);
    appendPages(saved);
    const ids = useBoard.getState().pages.flatMap((p) => [p.id, ...p.elements.map((e) => e.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("new board leaves a single empty page", () => {
    newBoard();
    const s = useBoard.getState();
    expect(s.pages).toHaveLength(1);
    expect(s.pages[0].elements).toHaveLength(0);
  });
});
