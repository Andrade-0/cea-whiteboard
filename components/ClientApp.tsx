"use client";

import dynamic from "next/dynamic";

// The board uses canvas, IndexedDB and pointer APIs: render it only in the browser.
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => <div className="boot">Quadro CEA</div>,
});

export default function ClientApp() {
  return <App />;
}
