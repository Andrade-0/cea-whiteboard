"use client";

import { useState } from "react";
import { useBoard } from "@/lib/store";
import { T } from "@/lib/strings";

/** Page title that turns into an input on double-click (or when `editing` is forced). */
export default function PageTitle({ index, className, readOnly }: { index: number; className?: string; readOnly?: boolean }) {
  const title = useBoard((s) => s.pages[index]?.title ?? "");
  const [draft, setDraft] = useState<string | null>(null);

  if (draft !== null && !readOnly) {
    const commit = () => {
      useBoard.getState().renamePage(index, draft);
      setDraft(null);
    };
    return (
      <input
        className={`page-title-input ${className ?? ""}`}
        autoFocus
        value={draft}
        maxLength={60}
        placeholder={T.pageTitlePlaceholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(null);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={`page-title ${title ? "" : "is-empty"} ${className ?? ""}`}
      title={readOnly ? title : T.renameHint}
      onDoubleClick={readOnly ? undefined : () => setDraft(title)}
    >
      {title || (readOnly ? "" : T.untitled)}
    </span>
  );
}
