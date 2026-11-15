"use client";

import { useEffect, useRef, useState } from "react";
import { useBoard } from "@/lib/store";
import type { Background } from "@/lib/types";
import { T } from "@/lib/strings";
import { exportJson, exportPagePng, exportPdf } from "@/lib/export";
import { parseBoardFile, type SavedBoard } from "@/lib/storage";
import { appendPages, newBoard } from "@/lib/actions";
import { useVisited } from "@/lib/share/history";
import { contentBox } from "@/lib/render";
import { fitBox } from "@/lib/camera";
import { useCompact } from "@/lib/useCompact";
import { IconClose, IconMenu, IconPages, IconPresent, IconRedo, IconUndo } from "./icons";
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

/** Closes a popover when the user presses anywhere outside `ref`. */
function useOutsideClose(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open, ref, close]);
}

const s = useBoard.getState;

function UndoRedo() {
  const pageId = useBoard((st) => st.page().id);
  const canUndo = useBoard((st) => (st.history[pageId]?.past.length ?? 0) > 0);
  const canRedo = useBoard((st) => (st.history[pageId]?.future.length ?? 0) > 0);
  return (
    <div className="topbar-group">
      <button className="tb-icon" onClick={() => s().undo()} disabled={!canUndo} title={`${T.undo} (Ctrl+Z)`} aria-label={T.undo}>
        <IconUndo />
      </button>
      <button className="tb-icon" onClick={() => s().redo()} disabled={!canRedo} title={`${T.redo} (Ctrl+Y)`} aria-label={T.redo}>
        <IconRedo />
      </button>
    </div>
  );
}

function BackgroundSwitch() {
  const bg = useBoard((st) => st.page().bg);
  return (
    <div className="topbar-group bg-switch" role="radiogroup" aria-label="Fundo">
      {BGS.map((b) => (
        <button key={b} role="radio" aria-checked={bg === b} className={`bg-opt bg-${b}${bg === b ? " is-on" : ""}`} onClick={() => s().setBackground(b)} title={T.backgrounds[b]}>
          <i />
        </button>
      ))}
    </div>
  );
}

function ZoomControls() {
  const zoom = useBoard((st) => st.page().camera.z);
  return (
    <div className="topbar-group zoom">
      <button className="tb-text" onClick={resetZoom} title={`${T.zoomReset} (Ctrl+0)`}>
        {Math.round(zoom * 100)}%
      </button>
      <button className="tb-text" onClick={fitToContent} title={`${T.fit} (Shift+1)`}>
        {T.fit}
      </button>
    </div>
  );
}

/** Export / save / open / clear actions (shared by the file menu and the mobile menu). */
function FileActions({ done, openFile }: { done: () => void; openFile: () => void }) {
  return (
    <>
      <button
        role="menuitem"
        onClick={() => {
          if (window.confirm(T.newBoardConfirm)) newBoard();
          done();
        }}
      >
        {T.newBoard}
      </button>
      <hr />
      <button role="menuitem" onClick={() => (exportPagePng(s().page(), s().current), done())}>
        {T.exportPng}
      </button>
      <button role="menuitem" onClick={() => (void exportPdf(s().pages), done())}>
        {T.exportPdf}
      </button>
      <hr />
      <button role="menuitem" onClick={() => (exportJson(s().pages, s().current), done())}>
        {T.exportJson}
      </button>
      <button role="menuitem" onClick={openFile}>
        {T.importJson}
      </button>
      <button role="menuitem" onClick={() => (useVisited.setState({ open: true }), done())}>
        {T.visited.menu}
      </button>
      <hr />
      <button
        role="menuitem"
        className="is-danger"
        onClick={() => {
          if (window.confirm(T.clearConfirm)) s().change(() => []);
          done();
        }}
      >
        {T.clearPage}
      </button>
    </>
  );
}

export default function TopBar({ saveState }: { saveState: "idle" | "saving" | "saved" | "failed" }) {
  const current = useBoard((st) => st.current);
  const total = useBoard((st) => st.pages.length);
  const pageId = useBoard((st) => st.page().id);
  const pagesOpen = useBoard((st) => st.pagesOpen);
  const compact = useCompact();
  const [fileMenu, setFileMenu] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ name: string; data: SavedBoard } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  useOutsideClose(fileMenu, fileMenuRef, () => setFileMenu(false));
  useOutsideClose(mobileMenu, mobileRef, () => setMobileMenu(false));

  const closeAll = () => {
    setFileMenu(false);
    setMobileMenu(false);
  };

  const saveLabel = saveState === "saving" ? T.saving : saveState === "failed" ? T.saveFailed : saveState === "saved" ? T.saved : "";

  const importDialog = pendingImport && (
    <div className="help-backdrop" onPointerDown={() => setPendingImport(null)}>
      <section className="help import-dialog" role="dialog" aria-label={T.importTitle} onPointerDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{T.importTitle}</h2>
          <button onClick={() => setPendingImport(null)} aria-label={T.cancel}>
            <IconClose width={18} height={18} />
          </button>
        </header>
        <p>{T.importInfo(pendingImport.name, pendingImport.data.pages.length)}</p>
        <button
          className="import-choice is-primary"
          onClick={() => {
            appendPages(pendingImport.data.pages);
            setPendingImport(null);
          }}
        >
          <b>{T.importAppend}</b>
          <span>{T.importAppendHint}</span>
        </button>
        <button
          className="import-choice"
          onClick={() => {
            s().load(pendingImport.data.pages, pendingImport.data.current);
            setPendingImport(null);
          }}
        >
          <b>{T.importReplace}</b>
          <span>{T.importReplaceHint}</span>
        </button>
      </section>
    </div>
  );

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept=".json,application/json"
      hidden
      onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        closeAll();
        if (!f) return;
        const data = parseBoardFile(await f.text());
        if (!data) return window.alert(T.importFailed);
        // an empty board is simply replaced; otherwise ask what to do
        const empty = s().pages.every((p) => p.elements.length === 0);
        if (empty) s().load(data.pages, data.current);
        else setPendingImport({ name: f.name, data });
      }}
    />
  );

  const brand = (
    <div className="brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-logo" src="isaf.png" alt="ISAF" />
      <span className="brand-name">{T.appName}</span>
    </div>
  );

  if (compact) {
    return (
      <header className="topbar is-compact" onPointerDown={(e) => e.stopPropagation()}>
        {brand}
        <div className="topbar-spacer" />
        <span className="page-indicator">
          <b>{current + 1}</b>/{total}
        </span>
        <SharePanel />
        <div className="topbar-group" ref={mobileRef}>
          <button className={`tb-icon hamburger${mobileMenu ? " is-on" : ""}`} onClick={() => setMobileMenu((v) => !v)} aria-expanded={mobileMenu} aria-label={T.menu}>
            {mobileMenu ? <IconClose /> : <IconMenu />}
          </button>
          {mobileMenu && (
            <div className="menu mobile-menu" role="menu">
              <div className="mm-row">
                <UndoRedo />
                <span className={`save-state is-${saveState}`}>{saveLabel}</span>
              </div>
              <div className="mm-section">
                <span className="mm-label">{T.page}</span>
                <PageTitle index={current} key={pageId + current} className="tb-title" />
              </div>
              <div className="mm-row">
                <BackgroundSwitch />
                <ZoomControls />
              </div>
              <hr />
              <button role="menuitem" onClick={() => (useBoard.setState({ pagesOpen: !pagesOpen }), setMobileMenu(false))}>
                <IconPages width={18} height={18} /> {T.pages}
              </button>
              <button role="menuitem" onClick={() => (useBoard.setState({ presentation: true }), setMobileMenu(false))}>
                <IconPresent width={18} height={18} /> {T.present}
              </button>
              <button role="menuitem" onClick={() => (useBoard.setState({ helpOpen: true }), setMobileMenu(false))}>
                <span className="mm-q">?</span> {T.help}
              </button>
              <hr />
              <span className="mm-label">{T.file}</span>
              <FileActions done={closeAll} openFile={() => fileRef.current?.click()} />
            </div>
          )}
          {fileInput}
          {importDialog}
        </div>
      </header>
    );
  }

  return (
    <header className="topbar" onPointerDown={(e) => e.stopPropagation()}>
      {brand}
      <UndoRedo />
      <BackgroundSwitch />
      <ZoomControls />

      <div className="topbar-spacer" />

      <span className={`save-state is-${saveState}`}>{saveLabel}</span>

      <SharePanel />

      <div className="topbar-group" ref={fileMenuRef}>
        <button className="tb-text" onClick={() => setFileMenu((v) => !v)} aria-expanded={fileMenu}>
          {T.file}
        </button>
        {fileMenu && (
          <div className="menu" role="menu">
            <FileActions done={closeAll} openFile={() => fileRef.current?.click()} />
          </div>
        )}
        {fileInput}
        {importDialog}
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
