"use client";

import { useLayoutEffect, useRef } from "react";
import { useBoard } from "@/lib/store";
import type { TextEl } from "@/lib/types";
import { fontString } from "@/lib/render";
import { colorOf } from "@/lib/theme";
import { T } from "@/lib/strings";

export default function TextEditor({ el }: { el: TextEl }) {
  const cam = useBoard((s) => s.page().camera);
  const bg = useBoard((s) => s.page().bg);
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    // focus after the pointer sequence that opened the editor has finished,
    // otherwise the browser's own mouse handling can take the focus back
    ref.current?.focus({ preventScroll: true });
    const raf = requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [el.id]);

  const lines = el.text.split("\n");
  const fs = el.fontSize * cam.z;
  const longest = Math.max(4, ...lines.map((l) => l.length));

  return (
    <textarea
      ref={ref}
      className={`text-input${el.system ? " is-system" : ""}`}
      style={{
        left: (el.x - cam.x) * cam.z,
        top: (el.y - cam.y) * cam.z,
        font: fontString(fs),
        lineHeight: 1.3,
        color: colorOf(el.color, bg),
        width: `calc(${longest + 2}ch + 24px)`,
        height: Math.max(1, lines.length) * fs * 1.3 + fs * 0.4,
      }}
      value={el.text}
      placeholder={el.system ? T.system.placeholder : ""}
      spellCheck={false}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        const text = e.target.value;
        useBoard.getState().changeTransient((els) => els.map((x) => (x.id === el.id ? { ...x, text } : x)));
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) {
          e.preventDefault();
          useBoard.setState({ editing: null });
        }
      }}
    />
  );
}
