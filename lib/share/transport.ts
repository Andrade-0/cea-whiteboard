/**
 * Minimal realtime tree used for sharing. Paths are relative to the board root:
 *   doc/meta, doc/pages/{pageId}, doc/els/{pageId}/{elId}, live, viewers/{id}
 * Values must be JSON (no undefined). `null` deletes.
 */
export type Updates = Record<string, unknown>;

export interface ShareTransport {
  readonly kind: "firebase" | "local";
  /** Host: make sure this browser may write to the board (claims it if new). */
  host(boardId: string): Promise<void>;
  /** Host: multi-path update. */
  write(updates: Updates): Promise<void>;
  /** Host: replaces a whole subtree. */
  set(path: string, value: unknown): Promise<void>;
  /** Anyone: listen to a subtree; returns an unsubscribe function. */
  watch(boardId: string, path: string, cb: (value: unknown) => void): () => void;
  /** Viewer: announce presence while connected. */
  join(boardId: string): Promise<() => void>;
  close(): void;
}

export const viewerLink = (boardId: string, kind: ShareTransport["kind"]) => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("ver", boardId);
  if (kind === "local") url.searchParams.set("t", "local");
  return url.toString();
};
