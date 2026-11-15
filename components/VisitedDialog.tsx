"use client";

import { useEffect } from "react";
import { forgetVisit, loadVisited, useVisited, visitedLink } from "@/lib/share/history";
import { T } from "@/lib/strings";
import { IconClose, IconTrash } from "./icons";

function when(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `${T.visited.today}, ${time}` : `${d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })}, ${time}`;
}

/** List of shared boards this browser has followed. */
export default function VisitedDialog({ currentId }: { currentId?: string | null }) {
  const open = useVisited((s) => s.open);
  const items = useVisited((s) => s.items);

  useEffect(() => {
    if (open) void loadVisited();
  }, [open]);

  if (!open) return null;
  const close = () => useVisited.setState({ open: false });

  return (
    <div className="help-backdrop" onPointerDown={close}>
      <section className="help import-dialog visited" role="dialog" aria-label={T.visited.title} onPointerDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{T.visited.title}</h2>
          <button onClick={close} aria-label={T.cancel}>
            <IconClose width={18} height={18} />
          </button>
        </header>
        {items.length === 0 ? (
          <p>{T.visited.empty}</p>
        ) : (
          <>
            <p>{T.visited.intro}</p>
            <ul className="visited-list">
              {items.map((v) => (
                <li key={v.id} className={v.id === currentId ? "is-current" : ""}>
                  <a href={visitedLink(v)} className="visited-open">
                    <b>{v.title}</b>
                    <span>
                      {T.visited.pages(v.pages)} · {when(v.lastVisit)}
                      {v.id === currentId ? ` · ${T.visited.here}` : ""}
                    </span>
                  </a>
                  <button className="visited-forget" onClick={() => void forgetVisit(v.id)} title={T.visited.forget} aria-label={T.visited.forget}>
                    <IconTrash width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
