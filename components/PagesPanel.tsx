"use client";

import { memo, useEffect, useRef } from "react";
import { useBoard } from "@/lib/store";
import type { Page } from "@/lib/types";
import { contentBox, drawScene } from "@/lib/render";
import { fitBox } from "@/lib/camera";
import { T } from "@/lib/strings";
import { IconCopy, IconDown, IconPlus, IconTrash, IconUp } from "./icons";
import PageTitle from "./PageTitle";
import { isCompact } from "@/lib/useCompact";

const TW = 168, TH = 104;

const Thumb = memo(function Thumb({ page }: { page: Page }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    // thumbnails are not urgent: render when the browser is idle
    const id = setTimeout(() => {
      const c = ref.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = TW * dpr;
      c.height = TH * dpr;
      const b = contentBox(page);
      const cam = isFinite(b.minX) ? fitBox(b, TW, TH, 8) : { x: 0, y: 0, z: 0.2 };
      drawScene(c.getContext("2d")!, page, cam, TW, TH, { dpr });
    }, 250);
    return () => clearTimeout(id);
  }, [page.elements, page.bg, page]);
  return <canvas ref={ref} style={{ width: TW, height: TH }} />;
});

export default function PagesPanel() {
  const pages = useBoard((s) => s.pages);
  const current = useBoard((s) => s.current);
  const { goto, addPage, duplicatePage, deletePage, movePage } = useBoard.getState();

  return (
    <aside className="pages" aria-label={T.pages}>
      <div className="pages-head">
        <span>{T.pages}</span>
        <b>{pages.length}</b>
      </div>
      <ol className="pages-list">
        {pages.map((p, i) => (
          <li key={p.id} className={i === current ? "is-on" : ""}>
            <button
              className="page-thumb"
              onClick={() => {
                goto(i);
                if (isCompact()) useBoard.setState({ pagesOpen: false });
              }} aria-label={`${T.page} ${i + 1}${p.title ? ` · ${p.title}` : ""}`}>
              <span className="page-num">{String(i + 1).padStart(2, "0")}</span>
              <Thumb page={p} />
            </button>
            <PageTitle index={i} key={p.id + (p.title ?? "")} className="page-caption" />
            {i === current && (
              <div className="page-actions">
                <button onClick={() => movePage(i, i - 1)} disabled={i === 0} title={T.moveUp}>
                  <IconUp width={15} height={15} />
                </button>
                <button onClick={() => movePage(i, i + 1)} disabled={i === pages.length - 1} title={T.moveDown}>
                  <IconDown width={15} height={15} />
                </button>
                <button onClick={() => duplicatePage(i)} title={T.duplicatePage}>
                  <IconCopy width={15} height={15} />
                </button>
                <button
                  onClick={() => {
                    if (p.elements.length === 0 || window.confirm(`${T.deletePage} ${T.page.toLowerCase()} ${i + 1}?`)) deletePage(i);
                  }}
                  title={T.deletePage}
                >
                  <IconTrash width={15} height={15} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
      <button className="pages-add" onClick={addPage}>
        <IconPlus width={16} height={16} /> {T.addPage}
      </button>
    </aside>
  );
}
