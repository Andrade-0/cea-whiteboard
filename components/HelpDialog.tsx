"use client";

import { useBoard } from "@/lib/store";
import { SHORTCUTS, T } from "@/lib/strings";
import { IconClose } from "./icons";

export default function HelpDialog() {
  const open = useBoard((s) => s.helpOpen);
  if (!open) return null;
  const close = () => useBoard.setState({ helpOpen: false });
  return (
    <div className="help-backdrop" onPointerDown={close}>
      <section className="help" role="dialog" aria-label={T.help} onPointerDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{T.help}</h2>
          <button onClick={close} aria-label="Fechar">
            <IconClose width={18} height={18} />
          </button>
        </header>
        <dl>
          {SHORTCUTS.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
