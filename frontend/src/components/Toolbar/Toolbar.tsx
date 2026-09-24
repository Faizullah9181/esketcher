import { Brush, Copy, Eraser, Frame, Hand, MousePointer2, PaintBucket, PenLine, Pipette, Plus, ZoomIn, type LucideIcon } from "lucide-react";
import { JevGlyph } from "@/components/common/JevGlyph";
import { useDeskValue } from "@/hooks/useDesk";
import type { Desk } from "@/lib/desk/desk";
import type { ToolId } from "@/lib/desk/types";
import { useStudio } from "@/state/studio";

interface ToolDef {
  id: ToolId;
  label: string;
  kbd: string;
  icon: LucideIcon;
  /** hidden on phones, where the bar has room for the essentials only */
  desktop?: boolean;
}

const GROUPS: ToolDef[][] = [
  [
    { id: "select", label: "Select", kbd: "V", icon: MousePointer2 },
    { id: "hand", label: "Pan", kbd: "H", icon: Hand },
    { id: "zoom", label: "Zoom", kbd: "Z", icon: ZoomIn, desktop: true },
  ],
  [
    { id: "draw", label: "Pen", kbd: "D", icon: PenLine },
    { id: "highlight", label: "Brush", kbd: "⇧D", icon: Brush, desktop: true },
    { id: "eraser", label: "Erase", kbd: "E", icon: Eraser },
  ],
  [
    { id: "paint", label: "Paint armed material", kbd: "B", icon: PaintBucket },
    { id: "pick", label: "Material picker", kbd: "I", icon: Pipette },
    { id: "frame", label: "Frame", kbd: "F", icon: Frame, desktop: true },
  ],
];

function ToolButton({ active, label, kbd, onClick, children, desktop }: { active: boolean; label: string; kbd?: string; onClick: () => void; children: React.ReactNode; desktop?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`es-focus group relative ${desktop ? "max-sm:hidden [@media(max-height:520px)]:hidden" : ""} grid h-10 w-10 shrink-0 place-items-center [@media(max-height:520px)]:h-8 [@media(max-height:520px)]:w-8 rounded-[3px] transition-[background,color,transform] duration-150 active:scale-95 ${active ? "bg-bone text-void" : "text-ash hover:bg-bone/[0.06] hover:text-bone"}`}
    >
      {children}
      <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap border es-hairline bg-slab px-2 py-1 text-[11px] text-bone opacity-0 transition-opacity group-hover:opacity-100 sm:block">
        {label}
        {kbd && <span className="es-mono ml-2 text-ash">{kbd}</span>}
      </span>
    </button>
  );
}

function Tools({ desk }: { desk: Desk }) {
  const tool = useDeskValue((s) => s.tool);
  const setDrawer = useStudio((s) => s.setDrawer);
  const duplicate = () => desk.duplicate(desk.state.selection);
  return (
    <>
      {GROUPS.map((group, i) => (
        <div key={i} className="flex gap-1 border-b es-hairline pb-2 max-sm:border-b-0 max-sm:border-r max-sm:pb-0 max-sm:pr-1 sm:flex-col">
          {group.map((t) => (
            <ToolButton key={t.id} active={tool === t.id} label={t.label} kbd={t.kbd} desktop={t.desktop} onClick={() => desk.setTool(t.id)}>
              <t.icon size={17} strokeWidth={1.6} />
            </ToolButton>
          ))}
        </div>
      ))}
      <div className="flex gap-1 max-sm:hidden sm:flex-col [@media(max-height:520px)]:hidden">
        <ToolButton active={false} label="Duplicate" kbd="⌘D" onClick={duplicate}>
          <Copy size={16} strokeWidth={1.6} />
        </ToolButton>
        <ToolButton active={false} label="New sketch board" onClick={() => setDrawer("sketches")}>
          <Plus size={17} strokeWidth={1.6} />
        </ToolButton>
      </div>
      <div className="sm:mt-auto">
        <button
          onClick={() => desk.setTool("jev")}
          aria-label="Jev: click anything and Jev chooses its material"
          aria-pressed={tool === "jev"}
          className={`es-focus group relative grid h-12 w-12 shrink-0 place-items-center rounded-full border transition-all duration-300 max-sm:h-10 max-sm:w-10 sm:h-11 sm:w-11 [@media(max-height:520px)]:h-9 [@media(max-height:520px)]:w-9 ${
            tool === "jev" ? "border-jev bg-jev/10 text-bone shadow-[0_0_24px_-4px_var(--color-jev)]" : "border-bone/15 text-bone hover:border-jev/60"
          }`}
        >
          <JevGlyph size={22} active={tool === "jev"} />
          <span className="es-mono pointer-events-none absolute -bottom-4 text-[8px] tracking-[0.2em] text-jev max-sm:hidden [@media(max-height:520px)]:hidden">JEV</span>
        </button>
      </div>
    </>
  );
}

export function Toolbar() {
  const desk = useStudio((s) => s.desk);
  return (
    <aside
      aria-label="Tools"
      className="es-scroll z-30 flex flex-col items-center gap-2 overflow-y-auto border-r es-hairline bg-void/60 py-3 [grid-area:tools] [@media(max-height:520px)]:gap-1 [@media(max-height:520px)]:py-1.5 max-sm:fixed max-sm:bottom-[calc(var(--rail-h)+10px)] max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:flex-row max-sm:rounded-md max-sm:border max-sm:px-2 max-sm:py-1.5 max-sm:bg-slab/90 max-sm:backdrop-blur-md"
    >
      {desk && <Tools desk={desk} />}
    </aside>
  );
}
