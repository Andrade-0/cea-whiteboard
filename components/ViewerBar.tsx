"use client";

import { useEffect, useState } from "react";
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
      <button className={`tb-text follow-btn${follow ? " is-on" : ""}`} onClick={() => useShare.setState({ follow: !follow })} aria-pressed={follow}>
        {follow ? T.viewer.following : T.viewer.follow}
      </button>
    </header>
  );
}
