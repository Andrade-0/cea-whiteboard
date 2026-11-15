"use client";

import { useEffect, useRef, useState } from "react";
import { exportPagePng, exportPdf } from "@/lib/export";
import { useBoard } from "@/lib/store";
import { useShare } from "@/lib/share/session";
import { T } from "@/lib/strings";

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
        <span className="viewer-page">
          {title ? <b>{title}</b> : null}
          <span className="page-indicator">
            {T.page} <b>{current + 1}</b>/{total}
          </span>
        </span>
      )}
      {status === "live" && (
        <div className="topbar-group" ref={menuRef}>
          <button className="tb-text" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
            {T.viewer.export}
          </button>
          {menu && (
            <div className="menu" role="menu">
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
      <button className={`tb-text follow-btn${follow ? " is-on" : ""}`} onClick={() => useShare.setState({ follow: !follow })} aria-pressed={follow}>
        {follow ? T.viewer.following : T.viewer.follow}
      </button>
    </header>
  );
}
