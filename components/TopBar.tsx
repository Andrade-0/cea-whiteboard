"use client";

import { useEffect, useRef, useState } from "react";
import { useBoard } from "@/lib/store";
import type { Background } from "@/lib/types";
import { T } from "@/lib/strings";
import { exportJson, exportPagePng, exportPdf } from "@/lib/export";
import { parseBoardFile } from "@/lib/storage";
import { contentBox } from "@/lib/render";
import { fitBox } from "@/lib/camera";
import { IconPages, IconPresent, IconRedo, IconUndo } from "./icons";
import PageTitle from "./PageTitle";
import SharePanel from "./SharePanel";

const BGS: Background[] = ["plain", "grid", "lines", "dark"];

export function fitToContent() {
  const s = useBoard.getState();
  const b = contentBox(s.page());
  const host = document.querySelector(".board-wrap") as HTMLElement | null;
  if (!host) return;
  if (!isFinite(b.minX)) return s.setCamera({ x: 0, y: 0, z: 1 });
  s.setCamera(fitBox(b, host.clientWidth, host.clientHeight));
}

export function resetZoom() {
  const s = useBoard.getState();
  const host = document.querySelector(".board-wrap") as HTMLElement | null;
  const cam = s.page().camera;
  if (!host) return;
  const cx = cam.x + host.clientWidth / 2 / cam.z, cy = cam.y + host.clientHeight / 2 / cam.z;
  s.setCamera({ z: 1, x: cx - host.clientWidth / 2, y: cy - host.clientHeight / 2 });
}

export default function TopBar({ saveState }: { saveState: "idle" | "saving" | "saved" | "failed" }) {
  const current = useBoard((s) => s.current);
  const total = useBoard((s) => s.pages.length);
  const bg = useBoard((s) => s.page().bg);
  const zoom = useBoard((s) => s.page().camera.z);
  const pageId = useBoard((s) => s.page().id);
  const canUndo = useBoard((s) => (s.history[pageId]?.past.length ?? 0) > 0);
  const canRedo = useBoard((s) => (s.history[pageId]?.future.length ?? 0) > 0);
  const pagesOpen = useBoard((s) => s.pagesOpen);
  const [menu, setMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  const s = useBoard.getState;

  return (
    <header className="topbar" onPointerDown={(e) => e.stopPropagation()}>
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="isaf.png" alt="ISAF" />
        <span className="brand-name">{T.appName}</span>
      </div>

      <div className="topbar-group">
        <button className="tb-icon" onClick={() => s().undo()} disabled={!canUndo} title={`${T.undo} (Ctrl+Z)`}>
          <IconUndo />
        </button>
        <button className="tb-icon" onClick={() => s().redo()} disabled={!canRedo} title={`${T.redo} (Ctrl+Y)`}>
          <IconRedo />
        </button>
      </div>

      <div className="topbar-group bg-switch" role="radiogroup" aria-label="Fundo">
        {BGS.map((b) => (
          <button key={b} role="radio" aria-checked={bg === b} className={`bg-opt bg-${b}${bg === b ? " is-on" : ""}`} onClick={() => s().setBackground(b)} title={T.backgrounds[b]}>
            <i />
          </button>
        ))}
      </div>

      <div className="topbar-group zoom">
        <button className="tb-text" onClick={resetZoom} title={`${T.zoomReset} (Ctrl+0)`}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="tb-text" onClick={fitToContent} title={`${T.fit} (Shift+1)`}>
          {T.fit}
        </button>
      </div>

      <div className="topbar-spacer" />

      <span className={`save-state is-${saveState}`}>
        {saveState === "saving" ? T.saving : saveState === "failed" ? T.saveFailed : saveState === "saved" ? T.saved : ""}
      </span>

      <SharePanel />

      <div className="topbar-group" ref={menuRef}>
        <button className="tb-text" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
          {T.file}
        </button>
        {menu && (
          <div className="menu" role="menu">
            <button role="menuitem" onClick={() => (exportPagePng(s().page(), s().current), setMenu(false))}>
              {T.exportPng}
            </button>
            <button role="menuitem" onClick={() => (exportPdf(s().pages), setMenu(false))}>
              {T.exportPdf}
            </button>
            <hr />
            <button role="menuitem" onClick={() => (exportJson(s().pages, s().current), setMenu(false))}>
              {T.exportJson}
            </button>
            <button role="menuitem" onClick={() => fileRef.current?.click()}>
              {T.importJson}
            </button>
            <hr />
            <button
              role="menuitem"
              className="is-danger"
              onClick={() => {
                if (window.confirm(T.clearConfirm)) s().change(() => []);
                setMenu(false);
              }}
            >
              {T.clearPage}
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            setMenu(false);
            if (!f) return;
            const data = parseBoardFile(await f.text());
            if (!data) return window.alert(T.importFailed);
            s().load(data.pages, data.current);
          }}
        />
      </div>

      <div className="topbar-group">
        <span className="page-indicator">
          {T.page} <b>{current + 1}</b>/{total}
        </span>
        <PageTitle index={current} key={pageId + current} className="tb-title" />
        <button className={`tb-icon${pagesOpen ? " is-on" : ""}`} onClick={() => useBoard.setState({ pagesOpen: !pagesOpen })} title={T.pages}>
          <IconPages />
        </button>
        <button className="tb-icon" onClick={() => useBoard.setState({ presentation: true })} title={`${T.present} (F)`}>
          <IconPresent />
        </button>
        <button className="tb-text tb-help" onClick={() => useBoard.setState({ helpOpen: true })} title={`${T.help} (?)`}>
          ?
        </button>
      </div>
    </header>
  );
}
