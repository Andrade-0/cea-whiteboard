// Hand-tuned icon set for the board (24×24, 1.75 stroke, square ends).
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Svg(props: P) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="square" strokeLinejoin="miter" aria-hidden {...props} />
  );
}

export const IconSelect = (p: P) => (
  <Svg {...p}>
    <path d="M5 3.5 L5 18 L9 14.2 L11.8 20.3 L14.3 19.2 L11.6 13.2 L17 13.2 Z" />
  </Svg>
);
export const IconHand = (p: P) => (
  <Svg {...p}>
    <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 6.5-6 6.5-2.6 0-4-1.2-5.4-3.4L3.8 14a1.4 1.4 0 0 1 2.3-1.6L8 14.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
export const IconPen = (p: P) => (
  <Svg {...p}>
    <path d="M4 20 L5.2 15.4 L15.8 4.8 L19.2 8.2 L8.6 18.8 Z" />
    <path d="M13.6 7 L17 10.4" />
  </Svg>
);
export const IconHighlighter = (p: P) => (
  <Svg {...p}>
    <path d="M9 14 L16.5 4.5 L20 8 L10.5 15.5 Z" />
    <path d="M9 14 L7 16 L8.5 17.5 L10.5 15.5" />
    <path d="M3 20.5 H12" strokeWidth={3} />
  </Svg>
);
export const IconEraser = (p: P) => (
  <Svg {...p}>
    <path d="M8.5 19.5 L3.8 14.8 L13.6 5 L19.5 10.9 L10.9 19.5 Z" />
    <path d="M8.7 9.9 L14.6 15.8" />
    <path d="M10.9 19.5 H20" />
  </Svg>
);
export const IconText = (p: P) => (
  <Svg {...p}>
    <path d="M5 6.5 V4.5 H19 V6.5" />
    <path d="M12 4.5 V19.5" />
    <path d="M9 19.5 H15" />
  </Svg>
);
export const IconShape = (p: P) => (
  <Svg {...p}>
    <path d="M4 20 L13 11" />
    <path d="M8.5 11 H13 V15.5" />
    <rect x="14" y="3.5" width="6.5" height="6.5" />
  </Svg>
);
export const IconMatrix = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 4 H4 V20 H6.5" />
    <path d="M17.5 4 H20 V20 H17.5" />
    <circle cx="9" cy="9" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="15" cy="9" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="9" cy="15" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="15" cy="15" r="0.9" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconSystem = (p: P) => (
  <Svg {...p}>
    <path d="M7 4 C5 4 5.5 7.5 5.5 9 C5.5 11 4.5 12 3.5 12 C4.5 12 5.5 13 5.5 15 C5.5 16.5 5 20 7 20" strokeLinecap="round" />
    <path d="M10 7.5 H20 M10 12 H18 M10 16.5 H19" />
  </Svg>
);
export const IconLaser = (p: P) => (
  <Svg {...p}>
    <circle cx="16.5" cy="7.5" r="2.6" fill="currentColor" stroke="none" />
    <path d="M3.5 20.5 C7 18 9 14 13.6 10.2" strokeDasharray="2 2.6" strokeLinecap="round" />
  </Svg>
);
export const IconUndo = (p: P) => (
  <Svg {...p}>
    <path d="M8 5 L4 9 L8 13" />
    <path d="M4 9 H14.5 A5.5 5.5 0 0 1 14.5 20 H9" />
  </Svg>
);
export const IconRedo = (p: P) => (
  <Svg {...p}>
    <path d="M16 5 L20 9 L16 13" />
    <path d="M20 9 H9.5 A5.5 5.5 0 0 0 9.5 20 H15" />
  </Svg>
);
export const IconPresent = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="12" />
    <path d="M12 16.5 V20 M8 20 H16" />
  </Svg>
);
export const IconPages = (p: P) => (
  <Svg {...p}>
    <rect x="6.5" y="3.5" width="12" height="15" />
    <path d="M3.5 7 V20.5 H15" />
  </Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M4 12 H19 M14 7 L19 12 L14 17" />
  </Svg>
);
export const IconShare = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="2.4" />
    <circle cx="17.5" cy="5.5" r="2.4" />
    <circle cx="17.5" cy="18.5" r="2.4" />
    <path d="M8.1 10.8 L15.4 6.7 M8.1 13.2 L15.4 17.3" />
  </Svg>
);
export const IconMenu = (p: P) => (
  <Svg {...p}>
    <path d="M4 7 H20 M4 12 H20 M4 17 H20" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5 V19 M5 12 H19" />
  </Svg>
);
export const IconMinus = (p: P) => (
  <Svg {...p}>
    <path d="M5 12 H19" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 7 H20 M9 7 V4 H15 V7 M6.5 7 L7.5 20 H16.5 L17.5 7" />
  </Svg>
);
export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="8" y="8" width="12" height="12" />
    <path d="M16 8 V4 H4 V16 H8" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6 L18 18 M18 6 L6 18" />
  </Svg>
);
export const IconUp = (p: P) => (
  <Svg {...p}>
    <path d="M6 14 L12 8 L18 14" />
  </Svg>
);
export const IconDown = (p: P) => (
  <Svg {...p}>
    <path d="M6 10 L12 16 L18 10" />
  </Svg>
);

export const ShapeGlyph = ({ kind, ...p }: P & { kind: "line" | "arrow" | "rect" | "ellipse" }) => (
  <Svg {...p}>
    {kind === "line" && <path d="M4 19 L20 5" />}
    {kind === "arrow" && <path d="M4 19 L19 5 M12 5 H19 V12" />}
    {kind === "rect" && <rect x="4" y="6" width="16" height="12" />}
    {kind === "ellipse" && <ellipse cx="12" cy="12" rx="8.5" ry="6" />}
  </Svg>
);
