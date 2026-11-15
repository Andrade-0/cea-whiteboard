"use client";

import { useEffect, useRef, useState } from "react";
import { startSharing, stopSharing, useShare } from "@/lib/share/session";
import { T } from "@/lib/strings";
import { IconShare } from "./icons";

/** "Partilhar" button and its panel in the top bar. */
export default function SharePanel() {
  const status = useShare((s) => s.status);
  const link = useShare((s) => s.link);
  const viewers = useShare((s) => s.viewers);
  const error = useShare((s) => s.error);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const isLive = status === "live";
  const isLocal = !!link && link.includes("t=local");

  return (
    <div className="topbar-group share" ref={ref}>
      <button className={`tb-text share-btn${isLive ? " is-live" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {isLive ? <i className="live-dot" aria-hidden /> : <IconShare width={16} height={16} />}
        {T.share.button}
        {isLive && viewers > 0 && <b className="share-count">{viewers}</b>}
      </button>
      {open && (
        <div className="menu share-panel" role="dialog" aria-label={T.share.title}>
          <h3>{T.share.title}</h3>
          <p className="share-intro">{T.share.intro}</p>

          {status === "unconfigured" && <p className="share-note is-warn">{T.share.unconfigured}</p>}
          {status === "error" && (
            <p className="share-note is-warn">
              {T.share.error}
              {error ? `: ${error}` : ""}
            </p>
          )}

          {isLive && link ? (
            <>
              <div className="share-link">
                <input readOnly value={link} onFocus={(e) => e.target.select()} />
                <button
                  className="share-copy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                    } catch {
                      /* clipboard blocked: the input stays selectable */
                    }
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? T.share.copied : T.share.copy}
                </button>
              </div>
              <p className="share-status">
                <i className="live-dot" aria-hidden /> {T.share.live} · {T.share.viewers(viewers)}
              </p>
              <p className="share-note">{isLocal ? T.share.localNote : T.share.keepOpen}</p>
              <button className="share-action is-stop" onClick={stopSharing}>
                {T.share.stop}
              </button>
            </>
          ) : (
            <button className="share-action" disabled={status === "connecting"} onClick={() => void startSharing()}>
              {status === "connecting" ? T.share.connecting : T.share.start}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
