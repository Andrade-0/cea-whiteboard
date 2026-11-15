import { get, set } from "idb-keyval";
import { create } from "zustand";

/** A shared board this browser has followed. Stored only on this device. */
export interface VisitedBoard {
  id: string;
  local: boolean;
  title: string;
  pages: number;
  lastVisit: number;
}

const KEY = "quadro-cea:visited";
const MAX = 30;

interface VisitedState {
  items: VisitedBoard[];
  open: boolean;
  loaded: boolean;
}

export const useVisited = create<VisitedState>(() => ({ items: [], open: false, loaded: false }));

export async function loadVisited() {
  try {
    const items = ((await get<VisitedBoard[]>(KEY)) ?? []).filter((v) => v && typeof v.id === "string");
    useVisited.setState({ items, loaded: true });
  } catch {
    useVisited.setState({ loaded: true });
  }
}

async function persist(items: VisitedBoard[]) {
  useVisited.setState({ items });
  try {
    await set(KEY, items);
  } catch {
    /* storage blocked (private window): the list just won't survive a reload */
  }
}

/** Adds or refreshes a board at the top of the list. */
export async function recordVisit(entry: Omit<VisitedBoard, "lastVisit">) {
  if (!useVisited.getState().loaded) await loadVisited();
  const items = useVisited.getState().items;
  const prev = items.find((v) => v.id === entry.id);
  if (prev && prev.title === entry.title && prev.pages === entry.pages && Date.now() - prev.lastVisit < 60_000) return;
  const next = [{ ...entry, lastVisit: Date.now() }, ...items.filter((v) => v.id !== entry.id)].slice(0, MAX);
  await persist(next);
}

export async function forgetVisit(id: string) {
  await persist(useVisited.getState().items.filter((v) => v.id !== id));
}

export function visitedLink(v: Pick<VisitedBoard, "id" | "local">): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("ver", v.id);
  if (v.local) url.searchParams.set("t", "local");
  return url.toString();
}

/** The site's own board (no share link). */
export function homeLink(): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}
