import type { Background, Box, El, Page } from "../types";
import type { Updates } from "./transport";

/** Shared document as stored remotely. Elements are JSON strings (no undefined/array quirks). */
export interface RemoteDoc {
  meta?: { pageId: string; view?: Box; updatedAt?: number };
  pages?: Record<string, { i: number; title?: string | null; bg: Background }>;
  els?: Record<string, Record<string, { o: number; d: string }>>;
}

const pageMeta = (p: Page, i: number) => ({ i, title: p.title ?? null, bg: p.bg });

/** Full document for the first publish. */
export function fullDoc(pages: Page[]): RemoteDoc {
  return {
    pages: Object.fromEntries(pages.map((p, i) => [p.id, pageMeta(p, i)])),
    els: Object.fromEntries(pages.map((p) => [p.id, Object.fromEntries(p.elements.map((e, o) => [e.id, { o, d: JSON.stringify(e) }]))])),
  };
}

/**
 * Multi-path updates turning `prev` into `next`. Elements are compared by
 * object identity (the store never mutates), so unchanged ink is not resent.
 */
export function diffDoc(prev: Page[], next: Page[]): Updates {
  const u: Updates = {};
  const prevById = new Map(prev.map((p, i) => [p.id, { p, i }]));
  const nextIds = new Set(next.map((p) => p.id));

  for (const old of prev) {
    if (!nextIds.has(old.id)) {
      u[`doc/pages/${old.id}`] = null;
      u[`doc/els/${old.id}`] = null;
    }
  }

  next.forEach((page, i) => {
    const before = prevById.get(page.id);
    if (!before || before.i !== i || before.p.title !== page.title || before.p.bg !== page.bg) {
      u[`doc/pages/${page.id}`] = pageMeta(page, i);
    }
    if (before && before.p.elements === page.elements) return;
    const oldEls = new Map((before?.p.elements ?? []).map((e, o) => [e.id, { e, o }]));
    const newIds = new Set<string>();
    page.elements.forEach((e, o) => {
      newIds.add(e.id);
      const old = oldEls.get(e.id);
      if (!old || old.e !== e) u[`doc/els/${page.id}/${e.id}`] = { o, d: JSON.stringify(e) };
      else if (old.o !== o) u[`doc/els/${page.id}/${e.id}/o`] = o;
    });
    for (const id of oldEls.keys()) if (!newIds.has(id)) u[`doc/els/${page.id}/${id}`] = null;
  });
  return u;
}

/**
 * Rebuilds pages from a remote document. Parsed elements are cached by their
 * JSON string so unchanged elements keep their identity (and render caches).
 */
export function buildPages(doc: RemoteDoc | null, cache: Map<string, El>): Page[] {
  if (!doc?.pages) return [];
  const used = new Set<string>();
  const pages = Object.entries(doc.pages)
    .sort((a, b) => a[1].i - b[1].i)
    .map(([id, meta]) => {
      const raw = doc.els?.[id] ?? {};
      const elements = Object.values(raw)
        .sort((a, b) => a.o - b.o)
        .map(({ d }) => {
          used.add(d);
          let el = cache.get(d);
          if (!el) {
            el = JSON.parse(d) as El;
            cache.set(d, el);
          }
          return el;
        });
      const page: Page = { id, title: meta.title ?? undefined, bg: meta.bg ?? "grid", elements, camera: { x: 0, y: 0, z: 1 } };
      return page;
    });
  for (const k of cache.keys()) if (!used.has(k)) cache.delete(k);
  return pages;
}
