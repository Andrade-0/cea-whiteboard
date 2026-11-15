import type { Box, Camera } from "./types";

// screen = (world - camera.xy) * camera.z

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 6;

export function toWorld(cam: Camera, sx: number, sy: number): [number, number] {
  return [sx / cam.z + cam.x, sy / cam.z + cam.y];
}

export function toScreen(cam: Camera, wx: number, wy: number): [number, number] {
  return [(wx - cam.x) * cam.z, (wy - cam.y) * cam.z];
}

/** Zoom keeping the world point under (sx, sy) fixed on screen. */
export function zoomAt(cam: Camera, sx: number, sy: number, nextZ: number): Camera {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZ));
  const [wx, wy] = toWorld(cam, sx, sy);
  return { z, x: wx - sx / z, y: wy - sy / z };
}

export function panBy(cam: Camera, dxScreen: number, dyScreen: number): Camera {
  return { ...cam, x: cam.x - dxScreen / cam.z, y: cam.y - dyScreen / cam.z };
}

/** Camera that fits a world box into a viewport, with padding in screen px. */
export function fitBox(box: Box, vw: number, vh: number, pad = 60): Camera {
  const w = Math.max(1, box.maxX - box.minX);
  const h = Math.max(1, box.maxY - box.minY);
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((vw - 2 * pad) / w, (vh - 2 * pad) / h, 2)));
  return { z, x: box.minX - (vw / z - w) / 2, y: box.minY - (vh / z - h) / 2 };
}

export function viewportBox(cam: Camera, vw: number, vh: number): Box {
  return { minX: cam.x, minY: cam.y, maxX: cam.x + vw / cam.z, maxY: cam.y + vh / cam.z };
}
