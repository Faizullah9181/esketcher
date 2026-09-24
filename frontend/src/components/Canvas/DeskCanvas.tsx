import { useEffect, useMemo, useRef, useState } from "react";

import { useDeskValue } from "@/hooks/useDesk";
import { focusBoard, isBoard } from "@/lib/canvas/boards";
import type { Desk } from "@/lib/desk/desk";
import { GestureController, type Handle, type PointerInfo } from "@/lib/desk/gestures";
import { shapeBounds } from "@/lib/desk/math";
import { OFFLINE } from "@/services/api";
import { requestDecision } from "@/state/jevController";
import { actOnRegion, hoverRegion } from "@/state/regionTools";
import { useStudio } from "@/state/studio";

import { BoardIndex } from "./BoardIndex";
import { ContextMenu } from "./ContextMenu";
import { EmptyState } from "./EmptyState";
import { SamplingDecor } from "./SamplingDecor";
import { SelectionOverlay } from "./SelectionOverlay";
import { ShapeView } from "./ShapeView";
import { StylePanel } from "./StylePanel";

const AUTO_DECIDE_DELAY_MS = 260;
const CURSOR: Record<string, string> = { hand: "grab", zoom: "zoom-in", draw: "crosshair", highlight: "crosshair", eraser: "cell", frame: "crosshair", jev: "crosshair", paint: "crosshair", pick: "copy" };

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

function pointerInfo(e: React.PointerEvent | PointerEvent, handle: Handle | null = null): PointerInfo {
  return { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey, alt: e.altKey, mod: e.metaKey || e.ctrlKey, pressure: e.pointerType === "pen" ? e.pressure : 0.5, handle };
}

/** Mirror desk selection into the studio focus, and ask Jev (debounced, cached)
 * whenever the user settles on a board. */
function useSelectionSync(desk: Desk) {
  const selection = useDeskValue((s) => s.selection);
  const tool = useDeskValue((s) => s.tool);
  const focus = useStudio((s) => s.focus);
  const selectedBoard = selection.length === 1 && isBoard(desk.getShape(selection[0])) ? selection[0] : null;

  useEffect(() => {
    const { focus: current, setFocus } = useStudio.getState();
    if (!selectedBoard) {
      if (current && useStudio.getState().sim.status !== "running") setFocus(null);
      return;
    }
    if (current?.boardId !== selectedBoard) setFocus({ boardId: selectedBoard, regionId: null });
  }, [selectedBoard]);

  useEffect(() => {
    if (OFFLINE || !focus || tool === "jev" || useStudio.getState().sim.status === "running") return;
    const timer = setTimeout(() => {
      const { active, sim } = useStudio.getState();
      if (sim.status === "running") return;
      if (active?.boardId === focus.boardId && active.regionId === focus.regionId && active.status !== "error") return;
      void requestDecision({ ...focus, autoApply: false });
    }, AUTO_DECIDE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focus, tool]);
}

export function DeskCanvas({ desk }: { desk: Desk }) {
  const ref = useRef<HTMLDivElement>(null);
  const doc = useDeskValue((s) => s.doc);
  const camera = useDeskValue((s) => s.camera);
  const viewport = useDeskValue((s) => s.viewport);
  const selection = useDeskValue((s) => s.selection);
  const tool = useDeskValue((s) => s.tool);
  const draft = useDeskValue((s) => s.draft);
  const erasing = useDeskValue((s) => s.erasing);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);

  const controller = useMemo(
    () =>
      new GestureController(desk, {
        onRegion: actOnRegion,
        onHover: hoverRegion,
        onOpenBoard: (board) => focusBoard(desk, board.id),
      }),
    [desk],
  );
  useSelectionSync(desk);

  // viewport size and position
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      desk.setViewport({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [desk]);

  // wheel must be non-passive to stop the page zooming
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      controller.wheel({ x: e.clientX, y: e.clientY, dx: e.deltaX, dy: e.deltaY, mod: e.ctrlKey || e.metaKey });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [controller]);

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (controller.keyDown({ key: e.key, mod: e.metaKey || e.ctrlKey, shift: e.shiftKey, alt: e.altKey })) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => controller.keyUp({ key: e.key });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [controller]);

  // deleting a board collapses it into particles
  useEffect(
    () =>
      desk.onBeforeDelete((shapes) => {
        const { addBurst, focus, setFocus } = useStudio.getState();
        for (const s of shapes.filter(isBoard)) {
          const b = shapeBounds(s);
          const a = desk.pageToScreen({ x: b.x, y: b.y });
          const c = desk.pageToScreen({ x: b.x + b.w, y: b.y + b.h });
          addBurst({ id: `${s.id}-${Date.now()}`, x: a.x, y: a.y, w: c.x - a.x, h: c.y - a.y });
          if (focus?.boardId === s.id) setFocus(null);
        }
      }),
    [desk],
  );

  const visible = useMemo(() => desk.getVisibleShapes(), [desk, doc, camera, viewport]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = useMemo(() => new Set(selection), [selection]);
  const erased = useMemo(() => new Set(erasing), [erasing]);
  const empty = Object.keys(doc.shapes).length === 0;
  const grid = 28 * camera.z;

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    ref.current?.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      controller.cancel();
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      return;
    }
    const handle = (e.target as HTMLElement).closest?.("[data-handle]")?.getAttribute("data-handle") as Handle | null;
    controller.down(pointerInfo(e, handle));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      desk.panBy(mid.x - pinch.current.mid.x, mid.y - pinch.current.mid.y);
      desk.zoomAt(mid, dist / Math.max(1, pinch.current.dist));
      pinch.current = { dist, mid };
      return;
    }
    controller.move(pointerInfo(e));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    controller.up(pointerInfo(e));
  };

  return (
    <div className="absolute inset-0">
    <div
      ref={ref}
      className="es-desk absolute inset-0 touch-none select-none outline-none"
      style={{
        cursor: controller.space ? "grab" : (CURSOR[tool] ?? "default"),
        backgroundSize: `${grid}px ${grid}px`,
        backgroundPosition: `${camera.x * camera.z}px ${camera.y * camera.z}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        pinch.current = null;
        controller.cancel();
      }}
      onPointerLeave={() => tool !== "select" && useStudio.getState().setHover(null)}
      onDoubleClick={(e) => controller.doubleClick(pointerInfo(e as unknown as React.PointerEvent))}
      onContextMenu={(e) => {
        e.preventDefault();
        const hit = desk.shapeAt(desk.screenToPage({ x: e.clientX, y: e.clientY }));
        if (hit && !desk.state.selection.includes(hit.id)) desk.select([hit.id]);
        if (!hit) desk.selectNone();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      role="application"
      aria-label="Sketch desk"
      tabIndex={0}
    >
      <div className="es-desk__world" style={{ transform: `scale(${camera.z}) translate(${camera.x}px, ${camera.y}px)` }}>
        <SamplingDecor layer="under" />
        {visible.map((shape) => (
          <ShapeView key={shape.id} shape={shape} selected={selected.has(shape.id)} erasing={erased.has(shape.id)} />
        ))}
        {draft && <ShapeView shape={draft} selected={false} erasing={false} />}
        <SamplingDecor layer="over" />
      </div>
      <SelectionOverlay />
    </div>
      <StylePanel />
      <BoardIndex />
      {empty && <EmptyState />}
      {menu && <ContextMenu desk={desk} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </div>
  );
}
