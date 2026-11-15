import { get, set } from "idb-keyval";
import type { Page } from "./types";

const KEY = "quadro-cea:v1";

export interface SavedBoard {
  version: 1;
  pages: Page[];
  current: number;
  savedAt: string;
}

export async function loadBoard(): Promise<SavedBoard | null> {
  try {
    const data = await get<SavedBoard>(KEY);
    return data && Array.isArray(data.pages) ? data : null;
  } catch {
    return null;
  }
}

export async function saveBoard(pages: Page[], current: number): Promise<boolean> {
  try {
    await set(KEY, { version: 1, pages, current, savedAt: new Date().toISOString() } satisfies SavedBoard);
    return true;
  } catch {
    return false;
  }
}

export function parseBoardFile(text: string): SavedBoard | null {
  try {
    const data = JSON.parse(text);
    if (data?.version === 1 && Array.isArray(data.pages)) return data as SavedBoard;
  } catch {
    /* invalid file */
  }
  return null;
}
