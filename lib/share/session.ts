import { create } from "zustand";
import { nanoid } from "nanoid";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { useBoard } from "../store";
import type { Box, El, Page } from "../types";
import { fitBox, viewportBox } from "../camera";
import type { ShareTransport } from "./transport";
import { viewerLink } from "./transport";
import { buildPages, diffDoc, fullDoc, type RemoteDoc } from "./doc";
import { onLiveOut, setRemoteLive, type LiveState } from "./live";
import { LocalTransport } from "./local";
import { firebaseConfigured } from "./firebase";

export type ShareStatus = "off" | "connecting" | "live" | "error" | "unconfigured";

interface ShareState {
  status: ShareStatus;
  error: string | null;
  link: string | null;
  viewers: number;
  /** viewer: follow the host's page and view */
  follow: boolean;
  /** viewer: last time anything arrived from the host */
  lastSeen: number;
  set: (p: Partial<ShareState>) => void;
}

export const useShare = create<ShareState>((set) => ({
  status: "off",
  error: null,
  link: null,
  viewers: 0,
  follow: true,
  lastSeen: 0,
  set: (p) => set(p),
}));

const SHARE_KEY = "quadro-cea:share-id";
const LIVE_INTERVAL = 50;
const META_INTERVAL = 120;

/** "local" lets two tabs of the same browser share without Firebase (testing). */
export function wantsLocal(): boolean {
  return new URLSearchParams(window.location.search).get("t") === "local" || (!firebaseConfigured() && process.env.NODE_ENV !== "production");
}

async function makeTransport(local: boolean): Promise<ShareTransport> {
  if (local) return new LocalTransport();
  const { createFirebaseTransport } = await import("./firebase");
  return createFirebaseTransport();
}

function hostView(): Box | undefined {
  const host = document.querySelector(".board-wrap") as HTMLElement | null;
  if (!host) return undefined;
  return viewportBox(useBoard.getState().page().camera, host.clientWidth, host.clientHeight);
}

// ------------------------------------------------------------------ host

let stopHost: (() => void) | null = null;

export async function startSharing() {
  if (stopHost) return;
  const local = wantsLocal();
  if (!local && !firebaseConfigured()) {
    useShare.setState({ status: "unconfigured", error: null });
    return;
  }
  useShare.setState({ status: "connecting", error: null });
  let transport: ShareTransport;
  try {
    transport = await makeTransport(local);
    let id = (await idbGet<string>(SHARE_KEY)) ?? "";
    if (!id) {
      id = nanoid(12);
      await idbSet(SHARE_KEY, id);
    }
    try {
      await transport.host(id);
    } catch (e) {
      // the saved id belongs to someone else (e.g. cleared login): start a fresh board
      if ((e as Error).message !== "not-owner") throw e;
      id = nanoid(12);
      await idbSet(SHARE_KEY, id);
      await transport.host(id);
    }

    let pages = useBoard.getState().pages;
    await transport.set("doc", { ...fullDoc(pages), meta: { pageId: useBoard.getState().page().id, view: hostView() ?? null, updatedAt: Date.now() } });
    await transport.set("live", null);

    // document changes
    let queue: Promise<void> = Promise.resolve();
    const unsubDoc = useBoard.subscribe((s) => {
      if (s.pages === pages) return;
      const u = diffDoc(pages, s.pages);
      pages = s.pages;
      if (Object.keys(u).length) queue = queue.then(() => transport.write(u)).catch(fail);
    });

    // page + view (throttled)
    let metaTimer: ReturnType<typeof setTimeout> | null = null;
    let lastMeta = "";
    const pushMeta = () => {
      metaTimer = null;
      const meta = { pageId: useBoard.getState().page().id, view: hostView() ?? null, updatedAt: Date.now() };
      const key = JSON.stringify([meta.pageId, meta.view]);
      if (key === lastMeta) return;
      lastMeta = key;
      void transport.set("doc/meta", meta).catch(fail);
    };
    const unsubMeta = useBoard.subscribe((s, prev) => {
      if (s.current === prev.current && s.page().camera === prev.pages[prev.current]?.camera) return;
      if (!metaTimer) metaTimer = setTimeout(pushMeta, META_INTERVAL);
    });
    const onResize = () => !metaTimer && (metaTimer = setTimeout(pushMeta, META_INTERVAL));
    window.addEventListener("resize", onResize);

    // in-progress ink and laser (throttled, last value wins)
    let pendingLive: LiveState | null = null;
    let liveTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubLive = onLiveOut((s) => {
      pendingLive = s;
      if (liveTimer) return;
      liveTimer = setTimeout(() => {
        liveTimer = null;
        if (pendingLive) void transport.set("live", pendingLive).catch(fail);
      }, LIVE_INTERVAL);
    });

    const unsubViewers = transport.watch(id, "viewers", (v) =>
      useShare.setState({ viewers: v && typeof v === "object" ? Object.keys(v).length : 0 }),
    );

    function fail(e: unknown) {
      console.error("[share]", e);
      useShare.setState({ status: "error", error: String((e as Error)?.message ?? e) });
    }

    stopHost = () => {
      unsubDoc();
      unsubMeta();
      unsubLive();
      unsubViewers();
      window.removeEventListener("resize", onResize);
      if (metaTimer) clearTimeout(metaTimer);
      if (liveTimer) clearTimeout(liveTimer);
      void transport.set("live", null).finally(() => transport.close());
    };
    useShare.setState({ status: "live", link: viewerLink(id, transport.kind) });
  } catch (e) {
    console.error("[share]", e);
    useShare.setState({ status: "error", error: String((e as Error)?.message ?? e) });
  }
}

export function stopSharing() {
  stopHost?.();
  stopHost = null;
  useShare.setState({ status: "off", viewers: 0 });
}

// ------------------------------------------------------------------ viewer

/** Applies the host's page and visible area to this viewer's camera. */
export function followHost(meta: RemoteDoc["meta"] | undefined) {
  if (!meta) return;
  const s = useBoard.getState();
  const idx = s.pages.findIndex((p) => p.id === meta.pageId);
  if (idx >= 0 && idx !== s.current) useBoard.setState({ current: idx });
  const host = document.querySelector(".board-wrap") as HTMLElement | null;
  if (meta.view && host) useBoard.getState().setCamera(fitBox(meta.view, host.clientWidth, host.clientHeight, 0));
}

export async function startViewing(boardId: string) {
  useBoard.setState({ viewer: true, loaded: true, tool: "hand", presentation: false, pagesOpen: false });
  useShare.setState({ status: "connecting" });
  const local = wantsLocal();
  if (!local && !firebaseConfigured()) {
    useShare.setState({ status: "unconfigured" });
    return () => {};
  }
  const transport = await makeTransport(local);
  const cache = new Map<string, El>();
  let lastMeta: RemoteDoc["meta"];

  const offDoc = transport.watch(boardId, "doc", (raw) => {
    const doc = raw as RemoteDoc | null;
    if (!doc?.pages) {
      useShare.setState({ status: "error", error: "not-found" });
      return;
    }
    const prev = useBoard.getState();
    const built = buildPages(doc, cache);
    // keep each page's local camera so followers who zoom are not reset
    const pages: Page[] = built.map((p) => ({ ...p, camera: prev.pages.find((q) => q.id === p.id)?.camera ?? p.camera }));
    const curId = prev.pages[prev.current]?.id;
    const current = Math.max(0, pages.findIndex((p) => p.id === (useShare.getState().follow ? doc.meta?.pageId : curId)));
    useBoard.setState({ pages, current });
    lastMeta = doc.meta;
    if (useShare.getState().follow) followHost(lastMeta);
    useShare.setState({ status: "live", lastSeen: Date.now() });
  });
  const offLive = transport.watch(boardId, "live", (v) => {
    setRemoteLive((v as LiveState | null) ?? null);
    useShare.setState({ lastSeen: Date.now() });
  });
  const leave = await transport.join(boardId).catch(() => () => {});
  const unsubFollow = useShare.subscribe((s, p) => {
    if (s.follow && !p.follow) followHost(lastMeta);
  });
  const onResize = () => useShare.getState().follow && followHost(lastMeta);
  window.addEventListener("resize", onResize);

  return () => {
    offDoc();
    offLive();
    leave();
    unsubFollow();
    window.removeEventListener("resize", onResize);
    transport.close();
  };
}
