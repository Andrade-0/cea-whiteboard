import type { ColorKey } from "../types";

/** What is happening right now on the host's board (not yet committed). */
export interface LiveState {
  pageId: string;
  stroke?: { p: number[]; c: ColorKey; s: number; h?: boolean; r?: boolean } | null;
  /** laser trail: flat [x, y, ageMs, x, y, ageMs, ...] */
  laser?: number[] | null;
}

type Listener = (s: LiveState) => void;

// host side: the board publishes its in-progress state here
const outListeners = new Set<Listener>();
export function emitLive(s: LiveState) {
  for (const l of outListeners) l(s);
}
export function onLiveOut(l: Listener) {
  outListeners.add(l);
  return () => void outListeners.delete(l);
}

// viewer side: last state received from the host, drawn by the board
let remote: { state: LiveState; at: number } | null = null;
const inListeners = new Set<() => void>();
export function setRemoteLive(s: LiveState | null) {
  remote = s ? { state: s, at: performance.now() } : null;
  for (const l of inListeners) l();
}
export function getRemoteLive() {
  return remote;
}
export function onRemoteLive(l: () => void) {
  inListeners.add(l);
  return () => void inListeners.delete(l);
}

/** Rounds coordinates to 0.1 to keep messages small. */
export function packPoints(points: [number, number, number][]): number[] {
  const out: number[] = [];
  for (const [x, y, p] of points) out.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(p * 100) / 100);
  return out;
}
export function unpackPoints(flat: number[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i + 2 < flat.length; i += 3) out.push([flat[i], flat[i + 1], flat[i + 2]]);
  return out;
}
