import type { ShareTransport, Updates } from "./transport";

/**
 * Same-browser transport over BroadcastChannel. Used to test sharing between
 * two tabs without a Firebase project. The host keeps the whole tree in memory
 * and answers "hello" messages from viewers with a full snapshot.
 */
type Msg =
  | { kind: "hello"; from: string }
  | { kind: "snapshot"; to?: string; tree: Record<string, unknown> }
  | { kind: "path"; path: string; value: unknown }
  | { kind: "join"; id: string; on: boolean };

function setPath(tree: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split("/").filter(Boolean);
  let node = tree;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof node[k] !== "object" || node[k] === null) node[k] = {};
    node = node[k] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (value === null) delete node[last];
  else node[last] = structuredClone(value);
}

function getPath(tree: Record<string, unknown>, path: string): unknown {
  let node: unknown = tree;
  for (const k of path.split("/").filter(Boolean)) {
    if (typeof node !== "object" || node === null) return null;
    node = (node as Record<string, unknown>)[k];
  }
  return node ?? null;
}

export class LocalTransport implements ShareTransport {
  readonly kind = "local" as const;
  private ch: BroadcastChannel | null = null;
  private tree: Record<string, unknown> = {};
  private isHost = false;
  private watchers: { path: string; cb: (v: unknown) => void }[] = [];
  private viewers = new Set<string>();
  private readonly me = Math.random().toString(36).slice(2);

  private channel(boardId: string) {
    if (this.ch) return this.ch;
    this.ch = new BroadcastChannel(`quadro-cea:${boardId}`);
    this.ch.onmessage = (ev: MessageEvent<Msg>) => this.onMessage(ev.data);
    return this.ch;
  }

  private onMessage(m: Msg) {
    if (this.isHost) {
      if (m.kind === "hello") this.ch!.postMessage({ kind: "snapshot", to: m.from, tree: this.tree } satisfies Msg);
      if (m.kind === "join") {
        if (m.on) this.viewers.add(m.id);
        else this.viewers.delete(m.id);
        const v = Object.fromEntries([...this.viewers].map((id) => [id, true]));
        this.tree.viewers = v;
        this.notify("viewers");
      }
      return;
    }
    if (m.kind === "snapshot" && (!m.to || m.to === this.me)) {
      this.tree = m.tree;
      for (const w of this.watchers) w.cb(getPath(this.tree, w.path));
    }
    if (m.kind === "path") {
      setPath(this.tree, m.path, m.value);
      this.notify(m.path);
    }
  }

  private notify(changed: string) {
    for (const w of this.watchers) {
      if (changed.startsWith(w.path) || w.path.startsWith(changed)) w.cb(getPath(this.tree, w.path));
    }
  }

  async host(boardId: string) {
    this.isHost = true;
    this.channel(boardId);
  }

  async write(updates: Updates) {
    for (const [path, value] of Object.entries(updates)) {
      setPath(this.tree, path, value);
      this.ch?.postMessage({ kind: "path", path, value } satisfies Msg);
    }
  }

  async set(path: string, value: unknown) {
    setPath(this.tree, path, value);
    this.ch?.postMessage({ kind: "path", path, value } satisfies Msg);
  }

  watch(boardId: string, path: string, cb: (v: unknown) => void) {
    const ch = this.channel(boardId);
    const w = { path, cb };
    this.watchers.push(w);
    if (this.isHost) cb(getPath(this.tree, path));
    else ch.postMessage({ kind: "hello", from: this.me } satisfies Msg);
    return () => {
      this.watchers = this.watchers.filter((x) => x !== w);
    };
  }

  async join(boardId: string) {
    const ch = this.channel(boardId);
    ch.postMessage({ kind: "join", id: this.me, on: true } satisfies Msg);
    const leave = () => ch.postMessage({ kind: "join", id: this.me, on: false } satisfies Msg);
    window.addEventListener("pagehide", leave);
    return () => {
      leave();
      window.removeEventListener("pagehide", leave);
    };
  }

  close() {
    this.ch?.close();
    this.ch = null;
    this.watchers = [];
  }
}
