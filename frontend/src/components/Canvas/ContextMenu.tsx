import { useEffect } from "react";

import type { Desk } from "@/lib/desk/desk";

interface Item {
  label: string;
  kbd?: string;
  run: () => void;
  danger?: boolean;
}

export function ContextMenu({ desk, x, y, onClose }: { desk: Desk; x: number; y: number; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [onClose]);

  const ids = desk.state.selection;
  const shapes = desk.getSelected();
  const grouped = shapes.some((s) => s.groupId);
  const locked = shapes.length > 0 && shapes.every((s) => s.locked);
  const items: Item[] = ids.length
    ? [
        { label: "Duplicate", kbd: "⌘D", run: () => desk.duplicate(ids) },
        grouped ? { label: "Ungroup", kbd: "⇧⌘G", run: () => desk.ungroup(ids) } : { label: "Group", kbd: "⌘G", run: () => desk.group(ids) },
        { label: locked ? "Unlock" : "Lock", kbd: "⇧L", run: () => desk.toggleLock(ids) },
        { label: "Bring to front", kbd: "]", run: () => desk.bringToFront(ids) },
        { label: "Send to back", kbd: "[", run: () => desk.sendToBack(ids) },
        { label: "Zoom to selection", kbd: "⇧2", run: () => desk.zoomToSelection() },
        { label: "Delete", kbd: "⌫", run: () => desk.deleteShapes(ids), danger: true },
      ]
    : [
        { label: "Select all", kbd: "⌘A", run: () => desk.selectAll() },
        { label: "Zoom to fit", kbd: "⇧1", run: () => desk.zoomToFit() },
        { label: "Undo", kbd: "⌘Z", run: () => desk.undo() },
      ];

  return (
    <div role="menu" className="es-surface fixed z-[450] min-w-[200px] border es-hairline py-1" style={{ left: x, top: y }} onPointerDown={(e) => e.stopPropagation()}>
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          className={`es-focus flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] hover:bg-bone/[0.06] ${item.danger ? "text-err" : ""}`}
          onClick={() => {
            item.run();
            onClose();
          }}
        >
          {item.label}
          {item.kbd && <span className="es-mono text-[10px] text-ash">{item.kbd}</span>}
        </button>
      ))}
    </div>
  );
}
