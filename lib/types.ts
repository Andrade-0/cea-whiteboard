// Core data model for the whiteboard. All coordinates are in world units.

export type ColorKey = "ink" | "pink" | "blue" | "green" | "red" | "yellow";

/** x, y, pressure */
export type InkPoint = [number, number, number];

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface BaseEl {
  id: string;
}

export interface StrokeEl extends BaseEl {
  type: "stroke";
  points: InkPoint[];
  color: ColorKey;
  size: number;
  /** highlighter strokes are translucent and drawn wide */
  highlighter?: boolean;
  /** true when pressure came from a real pen */
  realPressure?: boolean;
}

export type ShapeKind = "line" | "arrow" | "rect" | "ellipse";

export interface ShapeEl extends BaseEl {
  type: "shape";
  kind: ShapeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: ColorKey;
  size: number;
}

export type Delimiter = "bracket" | "paren" | "bar" | "none";
export type HighlightColor = "pink" | "blue" | "green";

export interface MatrixEl extends BaseEl {
  type: "matrix";
  x: number;
  y: number;
  fontSize: number;
  cells: string[][];
  delim: Delimiter;
  /** number of coefficient columns before the augmented bar, or null */
  aug: number | null;
  label: string;
  /** row operation labels, shown to the right when showOps is true */
  ops: string[];
  showOps: boolean;
  rowHl: Record<number, HighlightColor>;
  colHl: Record<number, HighlightColor>;
  cellHl: Record<string, HighlightColor>;
  /** previous step: cells that differ from it are highlighted automatically */
  prevId?: string;
}

export interface TextEl extends BaseEl {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: ColorKey;
  fontSize: number;
  /** a linear system written as text; can be turned into an augmented matrix */
  system?: boolean;
}

export interface ImageEl extends BaseEl {
  type: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
}

export type El = StrokeEl | ShapeEl | MatrixEl | TextEl | ImageEl;

export type Background = "plain" | "grid" | "lines" | "dark";

export interface Camera {
  x: number;
  y: number;
  z: number;
}

export interface Page {
  id: string;
  /** optional heading shown in the pages panel, top bar and exports */
  title?: string;
  elements: El[];
  bg: Background;
  camera: Camera;
}

export type Tool =
  | "select"
  | "hand"
  | "pen"
  | "highlighter"
  | "eraser"
  | "text"
  | "shape"
  | "matrix"
  | "system"
  | "laser";

export type EraserMode = "stroke" | "partial";
