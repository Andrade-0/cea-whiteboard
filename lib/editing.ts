import { useBoard } from "./store";
import type { El } from "./types";

/**
 * Tracks editing sessions (typing in a matrix or a text box) at the store
 * level, so that each session becomes a single undo step and empty text boxes
 * disappear when the user leaves them. Kept out of React effects on purpose:
 * effect cleanups also run on remounts, which must not delete anything.
 */
export function installEditTracking(): () => void {
  let session: { id: string; pageId: string; before: El[]; existed: boolean } | null = null;

  const start = () => {
    const s = useBoard.getState();
    if (!s.editing) return;
    const page = s.page();
    // the element may have been created in the same action: look at the undo point
    const past = s.history[page.id]?.past;
    const prevEls = past?.[past.length - 1];
    const createdNow = !!prevEls && !prevEls.some((e) => e.id === s.editing!.id);
    session = { id: s.editing.id, pageId: page.id, before: page.elements, existed: !createdNow };
  };

  const finish = () => {
    if (!session) return;
    const { id, pageId, before, existed } = session;
    session = null;
    const s = useBoard.getState();
    if (s.page().id !== pageId) return;
    const el = s.page().elements.find((e) => e.id === id);
    if (el?.type === "text" && !el.text.trim()) {
      if (!existed) {
        // a box that was opened and left empty: remove it and drop its creation step
        useBoard.setState((st) => {
          const pages = st.pages.slice();
          pages[st.current] = { ...pages[st.current], elements: pages[st.current].elements.filter((e) => e.id !== id) };
          const h = st.history[pageId];
          return { pages, history: h ? { ...st.history, [pageId]: { ...h, past: h.past.slice(0, -1) } } : st.history };
        });
        return;
      }
      s.changeTransient((els) => els.filter((e) => e.id !== id));
    }
    s.commitFrom(before);
  };

  start();
  return useBoard.subscribe((s, prev) => {
    if (s.editing?.id === prev.editing?.id) return;
    finish();
    start();
  });
}
