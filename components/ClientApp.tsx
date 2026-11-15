"use client";

import dynamic from "next/dynamic";

// The board uses canvas, IndexedDB and pointer APIs: render it only in the browser.
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => (
    <div className="boot" role="status" aria-label="A carregar o Quadro CEA">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="boot-logo" src="isaf.png" alt="ISAF" />
      <span className="boot-name">Quadro CEA</span>
      <span className="boot-bar" aria-hidden />
    </div>
  ),
});

export default function ClientApp() {
  return <App />;
}
