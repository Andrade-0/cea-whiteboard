"use client";

import { useEffect, useRef } from "react";
import { useBoard, PEN_SIZES, HIGHLIGHTER_SIZES, newId } from "@/lib/store";
import type { El, InkPoint, ShapeEl, StrokeEl, TextEl, ImageEl } from "@/lib/types";
import { panBy, toWorld, zoomAt } from "@/lib/camera";
import { Stabilizer, catchUp, snapAngle, straighten } from "@/lib/ink";
import { drawLiveStroke, drawScene, measure, setImageLoadListener, resetMeasureCache } from "@/lib/render";
import { elBox, erasePartial, hitEl, intersects, resetBoxCache, translateEl } from "@/lib/geometry";
import { colorOf } from "@/lib/theme";
import { makeMatrixFromPreset } from "@/lib/actions";
import { matrixLayout } from "@/lib/matrix";
import { emitLive, getRemoteLive, onRemoteLive, packPoints, unpackPoints } from "@/lib/share/live";
import { useShare } from "@/lib/share/session";

type Live =
  | { kind: "none" }
  | { kind: "pan"; lastX: number; lastY: number }
  | {
      kind: "stroke";
      points: InkPoint[];
      stab: Stabilizer;
      real: boolean;
      shift: boolean;
      straight: boolean;
      lastMoveAt: number;
      lastMoveX: number;
      lastMoveY: number;
      pointer: [number, number];
    }
  | { kind: "erase"; before: El[] }
  | { kind: "shape"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "move"; before: El[]; ids: Set<string>; lastX: number; lastY: number; moved: boolean }
  | { kind: "marquee"; x1: number; y1: number; x2: number; y2: number; additive: boolean };

const HOLD_TO_STRAIGHTEN_MS = 550;
const LASER_FADE_MS = 900;

export default function Board() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const staticRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const live = useRef<Live>({ kind: "none" });
  const laser = useRef<{ x: number; y: number; t: number }[]>([]);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const spaceDown = useRef(false);
  // touch screens: two fingers pinch-zoom and pan the board
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mx: number; my: number } | null>(null);
  const frame = useRef({ staticDirty: true, liveDirty: true, raf: 0 });

  const tool = useBoard((s) => s.tool);

  // ---------- rendering loop ----------
  useEffect(() => {
    const schedule = () => {
      if (!frame.current.raf) frame.current.raf = requestAnimationFrame(render);
    };
    const markStatic = () => {
      frame.current.staticDirty = true;
      schedule();
    };

    function render() {
      frame.current.raf = 0;
      const s = useBoard.getState();
      const page = s.pages[s.current];
      const { w, h, dpr } = size.current;
      if (!w) return;
      if (frame.current.staticDirty) {
        frame.current.staticDirty = false;
        const ctx = staticRef.current!.getContext("2d")!;
        drawScene(ctx, page, page.camera, w, h, {
          dpr,
          editingId: s.editing?.id,
          selection: new Set(s.selection),
        });
      }
      // live layer is cheap: redraw every scheduled frame
      const lctx = liveRef.current!.getContext("2d", { desynchronized: true })!;
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.clearRect(0, 0, w, h);
      const cam = page.camera;
      const L = live.current;
      lctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, -cam.x * cam.z * dpr, -cam.y * cam.z * dpr);
      if (L.kind === "stroke") {
        const hl = s.tool === "highlighter";
        drawLiveStroke(
          lctx,
          {
            points: L.points,
            size: hl ? HIGHLIGHTER_SIZES[s.size] : PEN_SIZES[s.size],
            highlighter: hl,
            realPressure: L.real,
            color: hl ? s.highlighterColor : s.color,
          },
          page.bg,
        );
      } else if (L.kind === "shape") {
        const preview: ShapeEl = { id: "preview", type: "shape", kind: s.shapeKind, x1: L.x1, y1: L.y1, x2: L.x2, y2: L.y2, color: s.color, size: PEN_SIZES[s.size] };
        drawPreviewShape(lctx, preview, page.bg);
      } else if (L.kind === "marquee") {
        lctx.save();
        lctx.fillStyle = "rgba(127,216,232,0.15)";
        lctx.strokeStyle = "#1F7A8C";
        lctx.lineWidth = 1 / cam.z;
        lctx.setLineDash([5 / cam.z, 4 / cam.z]);
        const x = Math.min(L.x1, L.x2), y = Math.min(L.y1, L.y2), mw = Math.abs(L.x2 - L.x1), mh = Math.abs(L.y2 - L.y1);
        lctx.fillRect(x, y, mw, mh);
        lctx.strokeRect(x, y, mw, mh);
        lctx.restore();
      }
      // the host's in-progress stroke, when following a shared board
      if (s.viewer) {
        const r = getRemoteLive();
        const st = r?.state.stroke;
        if (st && r!.state.pageId === page.id) {
          drawLiveStroke(lctx, { points: unpackPoints(st.p), size: st.s, highlighter: st.h, realPressure: st.r, color: st.c }, page.bg);
        }
      }
      // laser trail (screen-independent: stored in world coordinates)
      const now = performance.now();
      laser.current = laser.current.filter((p) => now - p.t < LASER_FADE_MS);
      const pts = laser.current;
      if (pts.length) {
        lctx.save();
        lctx.lineCap = "round";
        lctx.lineJoin = "round";
        for (let i = 1; i < pts.length; i++) {
          const a = 1 - (now - pts[i].t) / LASER_FADE_MS;
          lctx.strokeStyle = `rgba(214,51,132,${(a * 0.85).toFixed(3)})`;
          lctx.lineWidth = (3 + 5 * a) / cam.z;
          lctx.beginPath();
          lctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          lctx.lineTo(pts[i].x, pts[i].y);
          lctx.stroke();
        }
        const head = pts[pts.length - 1];
        if (now - head.t < 120 || useBoard.getState().tool === "laser") {
          lctx.fillStyle = "rgba(214,51,132,0.25)";
          lctx.beginPath();
          lctx.arc(head.x, head.y, 14 / cam.z, 0, Math.PI * 2);
          lctx.fill();
          lctx.fillStyle = "#D63384";
          lctx.beginPath();
          lctx.arc(head.x, head.y, 5.5 / cam.z, 0, Math.PI * 2);
          lctx.fill();
        }
        lctx.restore();
        schedule(); // keep fading
      }
      // hold-to-straighten check
      if (L.kind === "stroke" && !L.straight && !L.shift && L.points.length > 6) {
        if (now - L.lastMoveAt > HOLD_TO_STRAIGHTEN_MS) {
          const a = L.points[0];
          const b = L.pointer;
          if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 40 / cam.z && isRoughlyStraight(L.points)) {
            L.straight = true;
            L.points = straighten([a, [b[0], b[1], 0.5]]);
          }
        }
        schedule();
      }
    }

    const unsub = useBoard.subscribe((s, prev) => {
      if (s.pages !== prev.pages || s.current !== prev.current || s.selection !== prev.selection || s.editing !== prev.editing) markStatic();
      if (s.tool !== prev.tool) schedule();
    });
    setImageLoadListener(markStatic);
    const offRemote = onRemoteLive(() => {
      const r = getRemoteLive();
      const flat = r?.state.laser;
      if (flat && r!.state.pageId === useBoard.getState().page().id) {
        const pts: { x: number; y: number; t: number }[] = [];
        for (let i = 0; i + 2 < flat.length; i += 3) pts.push({ x: flat[i], y: flat[i + 1], t: r!.at - flat[i + 2] });
        laser.current = pts;
      }
      schedule();
    });

    const fontsReady = () => {
      resetMeasureCache();
      resetBoxCache();
      markStatic();
    };
    document.fonts?.ready.then(fontsReady);

    const ro = new ResizeObserver(() => {
      const el = wrapRef.current!;
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth, h = el.clientHeight;
      size.current = { w, h, dpr };
      for (const c of [staticRef.current!, liveRef.current!]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
      markStatic();
    });
    ro.observe(wrapRef.current!);
    (window as unknown as { __boardRedraw?: () => void }).__boardRedraw = markStatic;

    const f = frame.current;
    // expose scheduler to handlers below
    schedulerRef.current = schedule;
    return () => {
      unsub();
      offRemote();
      ro.disconnect();
      cancelAnimationFrame(f.raf);
    };
  }, []);

  const schedulerRef = useRef<() => void>(() => {});
  const requestLive = () => {
    frame.current.liveDirty = true;
    schedulerRef.current();
  };

  /** Tells a running share session what is being drawn right now. */
  const publishLive = (done = false) => {
    const s = useBoard.getState();
    if (s.viewer) return;
    const L = live.current;
    const now = performance.now();
    const hl = s.tool === "highlighter";
    const laserFlat: number[] = [];
    for (const p of laser.current) if (now - p.t < LASER_FADE_MS) laserFlat.push(Math.round(p.x), Math.round(p.y), Math.round(now - p.t));
    emitLive({
      pageId: s.page().id,
      stroke:
        !done && L.kind === "stroke"
          ? { p: packPoints(L.points), c: hl ? s.highlighterColor : s.color, s: hl ? HIGHLIGHTER_SIZES[s.size] : PEN_SIZES[s.size], h: hl || undefined, r: L.real || undefined }
          : null,
      laser: laserFlat.length ? laserFlat : null,
    });
  };

  // ---------- wheel: pan / pinch-zoom ----------
  useEffect(() => {
    const el = liveRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useBoard.getState();
      if (s.viewer) useShare.setState({ follow: false });
      const cam = s.page().camera;
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        // touchpad pinch arrives as ctrl+wheel with small deltas
        const factor = Math.exp(-e.deltaY * (Math.abs(e.deltaY) < 50 ? 0.012 : 0.0025));
        s.setCamera(zoomAt(cam, e.clientX - r.left, e.clientY - r.top, cam.z * factor));
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        s.setCamera(panBy(cam, -dx, -dy));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping(e.target)) {
        spaceDown.current = e.type === "keydown";
        if (e.type === "keydown") e.preventDefault();
        el.style.cursor = spaceDown.current ? "grab" : "";
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  // ---------- pointer handling ----------
  const worldOf = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = liveRef.current!.getBoundingClientRect();
    return toWorld(useBoard.getState().page().camera, e.clientX - r.left, e.clientY - r.top);
  };

  const topHit = (x: number, y: number, r: number): El | undefined => {
    const els = useBoard.getState().page().elements;
    for (let i = els.length - 1; i >= 0; i--) if (hitEl(els[i], x, y, r, measure)) return els[i];
    return undefined;
  };

  const eraseAt = (x: number, y: number) => {
    const s = useBoard.getState();
    const r = 10 / s.page().camera.z;
    s.changeTransient((els) => {
      let changed = false;
      const out: El[] = [];
      for (const el of els) {
        if (s.eraserMode === "partial" && el.type === "stroke") {
          const runs = hitEl(el, x, y, r, measure) ? erasePartial(el.points, x, y, r + el.size / 2) : null;
          if (runs) {
            changed = true;
            runs.forEach((pts, k) => out.push({ ...el, id: k === 0 ? el.id : newId(), points: pts }));
            continue;
          }
        } else if (hitEl(el, x, y, r, measure)) {
          changed = true;
          continue;
        }
        out.push(el);
      }
      return changed ? out : els;
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return;
    // stops the browser from moving focus away from editors we open below
    e.preventDefault();
    const s = useBoard.getState();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const [x, y] = worldOf(e);
    const cam = s.page().camera;

    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        // a second finger turns whatever started into a pinch (the half-drawn stroke is dropped)
        const L0 = live.current;
        if (L0.kind === "move" || L0.kind === "erase") s.commitFrom(L0.before);
        live.current = { kind: "none" };
        const [a, b] = [...touches.current.values()];
        pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        if (s.viewer) useShare.setState({ follow: false });
        requestLive();
        return;
      }
      if (touches.current.size > 2) return;
    }

    if (s.viewer) useShare.setState({ follow: false });
    if (e.button === 1 || spaceDown.current || s.tool === "hand" || s.viewer) {
      live.current = { kind: "pan", lastX: e.clientX, lastY: e.clientY };
      el.style.cursor = "grabbing";
      return;
    }
    if (s.editing) useBoard.setState({ editing: null });

    switch (s.tool) {
      case "pen":
      case "highlighter": {
        const real = e.pointerType === "pen";
        // a mouse/touchpad needs a longer rope than a real pen
        const radius = (real ? Math.min(2, s.stabilizer * 0.3) : s.stabilizer) / cam.z;
        const stab = new Stabilizer(radius);
        stab.reset(x, y);
        live.current = {
          kind: "stroke",
          points: [[x, y, real ? e.pressure || 0.5 : 0.5]],
          stab,
          real,
          shift: e.shiftKey,
          straight: false,
          lastMoveAt: performance.now(),
          lastMoveX: x,
          lastMoveY: y,
          pointer: [x, y],
        };
        break;
      }
      case "eraser":
        live.current = { kind: "erase", before: s.page().elements };
        eraseAt(x, y);
        break;
      case "shape":
        live.current = { kind: "shape", x1: x, y1: y, x2: x, y2: y };
        break;
      case "laser":
        laser.current.push({ x, y, t: performance.now() });
        break;
      case "text":
      case "system": {
        const hit = topHit(x, y, 4 / cam.z);
        if (hit && hit.type === "text") {
          useBoard.setState({ selection: [hit.id], editing: { id: hit.id } });
          break;
        }
        const t: TextEl = {
          id: newId(),
          type: "text",
          x,
          y: y - 16,
          text: "",
          color: s.tool === "system" ? "ink" : s.color,
          fontSize: s.tool === "system" ? 28 : 26,
          system: s.tool === "system" || undefined,
        };
        s.change((els) => [...els, t]);
        useBoard.setState({ selection: [t.id], editing: { id: t.id } });
        break;
      }
      case "matrix": {
        const m = makeMatrixFromPreset(x, y);
        const L = matrixLayout(m, measure);
        m.y = y - L.height / 2;
        s.change((els) => [...els, m]);
        useBoard.setState({ tool: "select", selection: [m.id], editing: { id: m.id, cell: [0, 0] } });
        break;
      }
      case "select": {
        const hit = topHit(x, y, 6 / cam.z);
        if (hit) {
          let sel = s.selection;
          if (e.shiftKey) sel = sel.includes(hit.id) ? sel.filter((i) => i !== hit.id) : [...sel, hit.id];
          else if (!sel.includes(hit.id)) sel = [hit.id];
          useBoard.setState({ selection: sel });
          live.current = { kind: "move", before: s.page().elements, ids: new Set(sel), lastX: x, lastY: y, moved: false };
        } else {
          if (!e.shiftKey) useBoard.setState({ selection: [] });
          live.current = { kind: "marquee", x1: x, y1: y, x2: x, y2: y, additive: e.shiftKey };
        }
        break;
      }
    }
    requestLive();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = useBoard.getState();
    if (e.pointerType === "touch" && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current && touches.current.size >= 2) {
        const [a, b] = [...touches.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const r = liveRef.current!.getBoundingClientRect();
        const p = pinch.current;
        let cam = s.page().camera;
        cam = panBy(cam, mx - p.mx, my - p.my);
        if (p.dist > 0) cam = zoomAt(cam, mx - r.left, my - r.top, cam.z * (dist / p.dist));
        s.setCamera(cam);
        pinch.current = { dist, mx, my };
        return;
      }
    }
    const L = live.current;
    if (s.tool === "laser" && (L.kind === "none" || L.kind === "pan") && !(L.kind === "pan")) {
      const [x, y] = worldOf(e);
      laser.current.push({ x, y, t: performance.now() });
      publishLive();
      requestLive();
      return;
    }
    if (L.kind === "none") return;
    if (L.kind === "pan") {
      s.setCamera(panBy(s.page().camera, e.clientX - L.lastX, e.clientY - L.lastY));
      L.lastX = e.clientX;
      L.lastY = e.clientY;
      return;
    }
    const events = L.kind === "stroke" && "getCoalescedEvents" in e.nativeEvent ? e.nativeEvent.getCoalescedEvents() : [];
    const list = events.length ? events : [e.nativeEvent];
    const [x, y] = worldOf(e);

    if (L.kind === "stroke") {
      const cam = s.page().camera;
      L.pointer = [x, y];
      if (Math.hypot(x - L.lastMoveX, y - L.lastMoveY) > 3 / cam.z) {
        L.lastMoveAt = performance.now();
        L.lastMoveX = x;
        L.lastMoveY = y;
      }
      if (L.shift || e.shiftKey || L.straight) {
        // straight line from the starting point, following the pointer
        const a = L.points[0];
        const [bx, by] = L.shift || e.shiftKey ? snapAngle(a[0], a[1], x, y) : [x, y];
        L.shift = L.shift || e.shiftKey;
        L.points = straighten([a, [bx, by, 0.5]]);
      } else {
        for (const ev of list) {
          const [wx, wy] = worldOf(ev);
          const p = L.stab.update(wx, wy);
          if (p) L.points.push([p[0], p[1], L.real ? ev.pressure || 0.5 : 0.5]);
        }
      }
      publishLive();
    } else if (L.kind === "erase") {
      for (const ev of list) {
        const [wx, wy] = worldOf(ev);
        eraseAt(wx, wy);
      }
    } else if (L.kind === "shape") {
      if (e.shiftKey) {
        if (s.shapeKind === "line" || s.shapeKind === "arrow") [L.x2, L.y2] = snapAngle(L.x1, L.y1, x, y);
        else {
          const d = Math.max(Math.abs(x - L.x1), Math.abs(y - L.y1));
          L.x2 = L.x1 + Math.sign(x - L.x1 || 1) * d;
          L.y2 = L.y1 + Math.sign(y - L.y1 || 1) * d;
        }
      } else {
        L.x2 = x;
        L.y2 = y;
      }
    } else if (L.kind === "move") {
      const dx = x - L.lastX, dy = y - L.lastY;
      if (dx || dy) {
        L.moved = true;
        s.changeTransient((els) => els.map((el) => (L.ids.has(el.id) ? translateEl(el, dx, dy) : el)));
        L.lastX = x;
        L.lastY = y;
      }
    } else if (L.kind === "marquee") {
      L.x2 = x;
      L.y2 = y;
    }
    requestLive();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = useBoard.getState();
    if (e.pointerType === "touch") {
      touches.current.delete(e.pointerId);
      if (pinch.current) {
        // stay in pinch mode until every finger has left the screen
        if (touches.current.size === 0) pinch.current = null;
        return;
      }
    }
    const L = live.current;
    live.current = { kind: "none" };
    e.currentTarget.style.cursor = "";
    if (L.kind === "stroke") {
      let points = L.points;
      if (!L.straight && !L.shift) {
        // finish exactly where the pointer was released
        const [x, y] = worldOf(e);
        const last = points[points.length - 1];
        for (const [cx, cy] of catchUp([last[0], last[1]], [x, y], 2 / s.page().camera.z)) points.push([cx, cy, last[2]]);
        if (points.length > 1 && Math.hypot(points[0][0] - x, points[0][1] - y) < 0.01) points = [points[0]];
      }
      const hl = s.tool === "highlighter";
      const stroke: StrokeEl = {
        id: newId(),
        type: "stroke",
        points,
        color: hl ? s.highlighterColor : s.color,
        size: hl ? HIGHLIGHTER_SIZES[s.size] : PEN_SIZES[s.size],
        highlighter: hl || undefined,
        realPressure: L.real || undefined,
      };
      s.change((els) => [...els, stroke]);
      publishLive(true);
    } else if (L.kind === "erase") {
      s.commitFrom(L.before);
    } else if (L.kind === "shape") {
      if (Math.hypot(L.x2 - L.x1, L.y2 - L.y1) > 3) {
        const shape: ShapeEl = { id: newId(), type: "shape", kind: s.shapeKind, x1: L.x1, y1: L.y1, x2: L.x2, y2: L.y2, color: s.color, size: PEN_SIZES[s.size] };
        s.change((els) => [...els, shape]);
      }
    } else if (L.kind === "move") {
      if (L.moved) s.commitFrom(L.before);
    } else if (L.kind === "marquee") {
      const box = { minX: Math.min(L.x1, L.x2), minY: Math.min(L.y1, L.y2), maxX: Math.max(L.x1, L.x2), maxY: Math.max(L.y1, L.y2) };
      if (box.maxX - box.minX > 2 || box.maxY - box.minY > 2) {
        const ids = s.page().elements.filter((el) => intersects(elBox(el, measure), box)).map((el) => el.id);
        useBoard.setState({ selection: L.additive ? [...new Set([...s.selection, ...ids])] : ids });
      }
    }
    requestLive();
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = useBoard.getState();
    if (s.tool !== "select" || s.viewer) return;
    const [x, y] = worldOf(e);
    const hit = topHit(x, y, 6 / s.page().camera.z);
    if (!hit) return;
    if (hit.type === "matrix") {
      const L = matrixLayout(hit, measure);
      const i = Math.max(0, Math.min(hit.cells.length - 1, Math.floor((y - hit.y) / L.rowH)));
      let j = L.colX.findIndex((cx, k) => x - hit.x >= cx && x - hit.x < cx + L.colW[k]);
      if (j < 0) j = x - hit.x >= L.opsX && hit.showOps ? -1 : 0;
      useBoard.setState({ selection: [hit.id], editing: { id: hit.id, cell: [i, j] } });
    } else if (hit.type === "text") {
      useBoard.setState({ selection: [hit.id], editing: { id: hit.id } });
    }
  };

  // ---------- paste & drop images ----------
  useEffect(() => {
    const addImage = (file: File, at?: [number, number]) => {
      const reader = new FileReader();
      reader.onload = () => {
        const original = String(reader.result);
        const img = new Image();
        img.onload = () => {
          // big screenshots are re-encoded so saving and sharing stay light
          let src = original;
          const MAX = 1600;
          if (original.length > 400_000 || Math.max(img.naturalWidth, img.naturalHeight) > MAX) {
            const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
            const c = document.createElement("canvas");
            c.width = Math.round(img.naturalWidth * k);
            c.height = Math.round(img.naturalHeight * k);
            const cx = c.getContext("2d")!;
            cx.fillStyle = "#fff";
            cx.fillRect(0, 0, c.width, c.height);
            cx.drawImage(img, 0, 0, c.width, c.height);
            const jpeg = c.toDataURL("image/jpeg", 0.85);
            if (jpeg.length < original.length) src = jpeg;
          }
          const s = useBoard.getState();
          const cam = s.page().camera;
          const { w, h } = size.current;
          const maxW = Math.min(720, (w / cam.z) * 0.6);
          const k = Math.min(1, maxW / img.naturalWidth);
          const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
          const [cx, cy] = at ?? toWorld(cam, w / 2, h / 2);
          const el: ImageEl = { id: newId(), type: "image", x: cx - iw / 2, y: cy - ih / 2, w: iw, h: ih, src };
          s.change((els) => [...els, el]);
          useBoard.setState({ selection: [el.id], tool: "select" });
        };
        img.src = original;
      };
      reader.readAsDataURL(file);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        addImage(file);
      } else {
        window.dispatchEvent(new CustomEvent("board:paste-internal"));
      }
    };
    const wrap = wrapRef.current!;
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) addImage(file, worldOf(e));
    };
    window.addEventListener("paste", onPaste);
    wrap.addEventListener("dragover", onDragOver);
    wrap.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      wrap.removeEventListener("dragover", onDragOver);
      wrap.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div ref={wrapRef} className="board-wrap">
      <canvas ref={staticRef} className="board-canvas" />
      <canvas
        ref={liveRef}
        className="board-canvas board-live"
        data-tool={tool}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          if (useBoard.getState().tool === "laser") requestLive();
        }}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}

function drawPreviewShape(ctx: CanvasRenderingContext2D, el: ShapeEl, bg: Parameters<typeof colorOf>[1]) {
  // reuse the static renderer through a tiny scene
  ctx.save();
  ctx.strokeStyle = colorOf(el.color, bg);
  ctx.lineWidth = el.size;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (el.kind === "rect") ctx.strokeRect(Math.min(el.x1, el.x2), Math.min(el.y1, el.y2), Math.abs(el.x2 - el.x1), Math.abs(el.y2 - el.y1));
  else if (el.kind === "ellipse") {
    ctx.ellipse((el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2, Math.abs(el.x2 - el.x1) / 2, Math.abs(el.y2 - el.y1) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.moveTo(el.x1, el.y1);
    ctx.lineTo(el.x2, el.y2);
    ctx.stroke();
    if (el.kind === "arrow") {
      const ang = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
      const len = Math.max(10, el.size * 4.5);
      ctx.beginPath();
      ctx.moveTo(el.x2, el.y2);
      ctx.lineTo(el.x2 - len * Math.cos(ang - 0.42), el.y2 - len * Math.sin(ang - 0.42));
      ctx.moveTo(el.x2, el.y2);
      ctx.lineTo(el.x2 - len * Math.cos(ang + 0.42), el.y2 - len * Math.sin(ang + 0.42));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A stroke is "roughly straight" if no point strays far from the chord. */
function isRoughlyStraight(points: InkPoint[]): boolean {
  const a = points[0], b = points[points.length - 1];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 1) return false;
  let maxDev = 0;
  for (const p of points) {
    const dev = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
    if (dev > maxDev) maxDev = dev;
  }
  return maxDev < Math.max(8, len * 0.08);
}

export function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}
