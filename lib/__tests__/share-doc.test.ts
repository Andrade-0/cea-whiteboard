import { describe, expect, it } from "vitest";
import { buildPages, diffDoc, fullDoc, type RemoteDoc } from "../share/doc";
import { packPoints, unpackPoints } from "../share/live";
import type { El, Page, StrokeEl, TextEl } from "../types";

const stroke = (id: string, x = 0): StrokeEl => ({ id, type: "stroke", points: [[x, 0, 0.5], [x + 10, 5, 0.5]], color: "ink", size: 4 });
const text = (id: string, t: string): TextEl => ({ id, type: "text", x: 0, y: 0, text: t, color: "pink", fontSize: 26 });
const page = (id: string, elements: El[], title?: string): Page => ({ id, title, elements, bg: "grid", camera: { x: 0, y: 0, z: 1 } });

/** Applies multi-path updates to a plain object, like Firebase update() does. */
function apply(tree: Record<string, unknown>, updates: Record<string, unknown>) {
  for (const [path, value] of Object.entries(updates)) {
    const parts = path.split("/");
    let node = tree;
    for (const k of parts.slice(0, -1)) node = (node[k] ??= {}) as Record<string, unknown>;
    const last = parts[parts.length - 1];
    if (value === null) delete node[last];
    else node[last] = value;
  }
  return tree;
}

describe("diffDoc", () => {
  const a = stroke("a"), b = stroke("b", 20), c = text("c", "x = 1");
  const prev = [page("p1", [a, b]), page("p2", [c], "Sistemas")];

  it("sends nothing when nothing changed", () => {
    expect(diffDoc(prev, prev)).toEqual({});
  });

  it("only resends new or changed elements", () => {
    const b2 = { ...b, color: "pink" as const };
    const d = stroke("d", 40);
    const next = [page("p1", [a, b2, d]), prev[1]];
    next[1] = prev[1];
    const u = diffDoc(prev, next);
    expect(Object.keys(u).sort()).toEqual(["doc/els/p1/b", "doc/els/p1/d"]);
    expect(JSON.parse((u["doc/els/p1/d"] as { d: string }).d).id).toBe("d");
  });

  it("deletes removed elements and pages, and reorders cheaply", () => {
    const next = [page("p1", [b, a])];
    const u = diffDoc(prev, next);
    expect(u["doc/pages/p2"]).toBeNull();
    expect(u["doc/els/p2"]).toBeNull();
    expect(u["doc/els/p1/a/o"]).toBe(1);
    expect(u["doc/els/p1/b/o"]).toBe(0);
  });

  it("publishes title changes", () => {
    const next = [prev[0], { ...prev[1], title: "Determinantes" }];
    expect(diffDoc(prev, next)["doc/pages/p2"]).toEqual({ i: 1, title: "Determinantes", bg: "grid" });
  });

  it("round-trips through the remote document", () => {
    const next = [page("p1", [b, stroke("e", 60)]), page("p3", [text("f", "det A = 2")], "Inversa")];
    const tree = apply({ doc: fullDoc(prev) } as Record<string, unknown>, diffDoc(prev, next));
    const cache = new Map<string, El>();
    const rebuilt = buildPages(tree.doc as RemoteDoc, cache);
    expect(rebuilt.map((p) => [p.id, p.title, p.elements.map((e) => e.id)])).toEqual([
      ["p1", undefined, ["b", "e"]],
      ["p3", "Inversa", ["f"]],
    ]);
    // unchanged elements keep their identity between rebuilds
    const again = buildPages(tree.doc as RemoteDoc, cache);
    expect(again[0].elements[0]).toBe(rebuilt[0].elements[0]);
  });
});

describe("live packing", () => {
  it("rounds and restores points", () => {
    expect(unpackPoints(packPoints([[1.234, 5.678, 0.4567]]))).toEqual([[1.2, 5.7, 0.46]]);
  });
});
