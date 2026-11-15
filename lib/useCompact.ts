import { useSyncExternalStore } from "react";

export const COMPACT_QUERY = "(max-width: 900px)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(COMPACT_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True on narrow screens (phones, small tablets, split windows). */
export function useCompact(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false,
  );
}

export const isCompact = () => typeof window !== "undefined" && window.matchMedia(COMPACT_QUERY).matches;
