import type { Background, ColorKey, HighlightColor } from "./types";

// CEA identity: pink #D63384 · light blue #7FD8E8 · ink #2B2F3A
export const PALETTE: Record<"light" | "dark", Record<ColorKey, string>> = {
  light: {
    ink: "#2B2F3A",
    pink: "#D63384",
    blue: "#1F7A8C",
    green: "#1E8E5A",
    red: "#D9381E",
    yellow: "#F2C230",
  },
  dark: {
    ink: "#F4F1EA",
    pink: "#FF7AB8",
    blue: "#7FD8E8",
    green: "#7EE0A8",
    red: "#FF8A70",
    yellow: "#FFE066",
  },
};

export const HIGHLIGHT_FILL: Record<"light" | "dark", Record<HighlightColor, string>> = {
  light: { pink: "rgba(214,51,132,0.13)", blue: "rgba(127,216,232,0.35)", green: "rgba(30,142,90,0.14)" },
  dark: { pink: "rgba(255,122,184,0.22)", blue: "rgba(127,216,232,0.22)", green: "rgba(126,224,168,0.2)" },
};

export const BOARD_BG: Record<Background, string> = {
  plain: "#FFFFFF",
  grid: "#FFFFFF",
  lines: "#FFFFFF",
  dark: "#1F2A2E",
};

export const modeOf = (bg: Background): "light" | "dark" => (bg === "dark" ? "dark" : "light");

export function colorOf(key: ColorKey, bg: Background): string {
  return PALETTE[modeOf(bg)][key];
}

/** Fonts are provided by next/font as CSS variables on <body>. */
const familyCache = new Map<string, string>();
export function fontFamily(kind: "math" | "hand" = "math"): string {
  if (typeof window === "undefined") return "sans-serif";
  let v = familyCache.get(kind);
  if (!v) {
    v = getComputedStyle(document.body).getPropertyValue(kind === "math" ? "--font-math" : "--font-ui").trim() || "Segoe UI, sans-serif";
    familyCache.set(kind, v);
  }
  return v;
}
