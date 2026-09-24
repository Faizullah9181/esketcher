import { useDeskValue } from "@/hooks/useDesk";
import { shapeBounds, union } from "@/lib/desk/math";
import type { Handle } from "@/lib/desk/gestures";
import type { Shape } from "@/lib/desk/types";

const HANDLES: Handle[] = ["nw", "ne", "se", "sw"];

/** Selection box in screen space so handles stay the same size at any zoom. */
export function SelectionOverlay() {
  const doc = useDeskValue((s) => s.doc);
  const selection = useDeskValue((s) => s.selection);
  const camera = useDeskValue((s) => s.camera);
  const tool = useDeskValue((s) => s.tool);
  const marquee = useDeskValue((s) => s.marquee);
  const interactive = useDeskValue((s) => s.interactive);
  const shapes = selection.map((id) => doc.shapes[id]).filter((s): s is Shape => Boolean(s));
  const bounds = tool === "select" && interactive ? union(shapes.map(shapeBounds)) : null;
  const toScreen = (x: number, y: number) => ({ x: (x + camera.x) * camera.z, y: (y + camera.y) * camera.z });
  const locked = shapes.length > 0 && shapes.every((s) => s.locked);

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {marquee && (() => {
        const a = toScreen(marquee.x, marquee.y);
        return <div className="es-marquee" style={{ left: a.x, top: a.y, width: marquee.w * camera.z, height: marquee.h * camera.z }} />;
      })()}
      {bounds && (() => {
        const a = toScreen(bounds.x, bounds.y);
        const w = bounds.w * camera.z;
        const h = bounds.h * camera.z;
        return (
          <div className={`es-selection ${locked ? "es-selection--locked" : ""}`} style={{ left: a.x, top: a.y, width: w, height: h }}>
            {!locked && (
              <>
                {HANDLES.map((handle) => (
                  <div key={handle} data-handle={handle} className={`es-handle es-handle--${handle}`} />
                ))}
                <div data-handle="rotate" className="es-handle es-handle--rotate" title="Rotate (shift snaps)" />
              </>
            )}
            {shapes.length > 1 && <div className="es-selection__count">{shapes.length}</div>}
          </div>
        );
      })()}
    </div>
  );
}
