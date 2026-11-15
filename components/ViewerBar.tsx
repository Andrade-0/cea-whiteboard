"use client";

import { useEffect, useRef, useState } from "react";
import { exportPagePng, exportPdf } from "@/lib/export";
import { useBoard } from "@/lib/store";
import { browsePage, useShare } from "@/lib/share/session";
import { T } from "@/lib/strings";
import { useCompact } from "@/lib/useCompact";
import { IconClose, IconMenu } from "./icons";

/** Top bar for people following a shared board (read-only). */
export default function ViewerBar() {
  const status = useShare((s) => s.status);
  const error = useShare((s) => s.error);
  const follow = useShare((s) => s.follow);
  const lastSeen = useShare((s) => s.lastSeen);
  const title = useBoard((s) => s.page()?.title);
  const current = useBoard((s) => s.current);
  const total = useBoard((s) => s.pages.length);
  const [now, setNow] = useState(() => Date.now());
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pagesMenu, setPagesMenu] = useState(false);
  const pagesRef = useRef<HTMLDivElement>(null);
  const hostPage = useShare((s) => s.hostPage);
  const compact = useCompact();
  const pages = useBoard((s) => s.pages);

  useEffect(() => {
    if (!pagesMenu) return;
    const close = (e: PointerEvent) => {
      if (!pagesRef.current?.contains(e.target as Node)) setPagesMenu(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [pagesMenu]);

  // keyboard: PgUp/PgDn and the left/right arrows browse pages
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const cur = useBoard.getState().current;
      if (e.key === "PageDown" || e.key === "ArrowRight") {
        e.preventDefault();
        browsePage(cur + 1);
      }
      if (e.key === "PageUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        browsePage(cur - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const label =
    status === "unconfigured"
      ? T.viewer.unconfigured
      : status === "error"
        ? error === "not-found"
          ? T.viewer.notFound
          : T.viewer.offline
        : status === "connecting"
          ? T.viewer.waiting
          : T.viewer.live;
  const quiet = status === "live" && now - lastSeen > 5 * 60_000;

  return (
    <header className="topbar viewer-bar">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="isaf.png" alt="ISAF" />
        <span className="brand-name">{T.appName}</span>
      </div>
      <span className={`viewer-status is-${status}${quiet ? " is-quiet" : ""}`}>
        {status === "live" && <i className="live-dot" aria-hidden />}
        {label}
      </span>
      <div className="topbar-spacer" />
      {status === "live" && (
        <div className="viewer-page" ref={pagesRef}>
          {title && !compact ? <b className="viewer-title">{title}</b> : null}
          <div className="page-nav">
            <button className="tb-icon" onClick={() => browsePage(current - 1)} disabled={current === 0} aria-label={T.viewer.prevPage} title={`${T.viewer.prevPage} (PgUp)`}>
              ‹
            </button>
            <button className="tb-text page-indicator page-picker" onClick={() => setPagesMenu((v) => !v)} aria-expanded={pagesMenu} title={T.viewer.allPages}>
              {compact ? null : `${T.page} `}
              <b>{current + 1}</b>/{total}
            </button>
            <button className="tb-icon" onClick={() => browsePage(current + 1)} disabled={current === total - 1} aria-label={T.viewer.nextPage} title={`${T.viewer.nextPage} (PgDn)`}>
              ›
            </button>
          </div>
          {pagesMenu && (
            <div className="menu pages-menu" role="menu">
              {pages.map((p, i) => (
                <button
                  key={p.id}
                  role="menuitem"
                  className={i === current ? "is-current" : ""}
                  onClick={() => {
                    browsePage(i);
                    setPagesMenu(false);
                  }}
                >
                  <span className="pm-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="pm-title">{p.title || T.untitled}</span>
                  {i === hostPage && <span className="pm-host">{T.viewer.mentorHere}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {status === "live" && (
        <div className="topbar-group" ref={menuRef}>
          <button
            className={compact ? `tb-icon hamburger${menu ? " is-on" : ""}` : "tb-text"}
            onClick={() => setMenu((v) => !v)}
            aria-expanded={menu}
            aria-label={compact ? T.menu : undefined}
          >
            {compact ? menu ? <IconClose /> : <IconMenu /> : T.viewer.export}
          </button>
          {menu && (
            <div className={`menu${compact ? " mobile-menu" : ""}`} role="menu">
              {compact && title && <p className="mm-title">{title}</p>}
              {compact && (
                <button
                  role="menuitem"
                  className={follow ? "is-current" : ""}
                  onClick={() => {
                    useShare.setState({ follow: !follow });
                    setMenu(false);
                  }}
                >
                  {follow ? T.viewer.following : `${T.viewer.backToMentor} · ${T.page.toLowerCase()} ${hostPage + 1}`}
                </button>
              )}
              {compact && <hr />}
              <button
                role="menuitem"
                onClick={() => {
                  const s = useBoard.getState();
                  exportPagePng(s.page(), s.current);
                  setMenu(false);
                }}
              >
                {T.exportPng}
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  void exportPdf(useBoard.getState().pages);
                  setMenu(false);
                }}
              >
                {T.exportPdf}
              </button>
            </div>
          )}
        </div>
      )}
      {!compact && <button className={`tb-text follow-btn${follow ? " is-on" : ""}`} onClick={() => useShare.setState({ follow: !follow })} aria-pressed={follow}>
        {follow ? T.viewer.following : `${T.viewer.backToMentor} · ${T.page.toLowerCase()} ${hostPage + 1}`}
      </button>}
    </header>
  );
}
