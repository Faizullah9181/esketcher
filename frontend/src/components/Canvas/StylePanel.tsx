import { useDeskValue } from "@/hooks/useDesk";
import { useStudio } from "@/state/studio";

const COLORS = ["#ece8df", "#c6ff3d", "#ff2bd6", "#00f0ff", "#ff8a3d", "#ff4d5e", "#8f00ff", "#111114"];
const SIZES = [2, 4, 8, 14];

/** Pen and brush settings; only visible while drawing. */
export function StylePanel() {
  const desk = useStudio((s) => s.desk);
  const tool = useDeskValue((s) => s.tool);
  const style = useDeskValue((s) => s.style);
  if (!desk || (tool !== "draw" && tool !== "highlight")) return null;
  return (
    <div className="es-surface pointer-events-auto absolute right-3 top-3 z-[300] flex items-center gap-3 border es-hairline px-3 py-2" aria-label="Stroke style">
      <div className="flex gap-1.5">
        {COLORS.map((color) => (
          <button
            key={color}
            aria-label={`Colour ${color}`}
            aria-pressed={style.color === color}
            onClick={() => desk.setStyle({ color })}
            className={`es-focus h-5 w-5 rounded-full border ${style.color === color ? "border-bone ring-1 ring-bone ring-offset-2 ring-offset-slab" : "border-bone/20"}`}
            style={{ background: color }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1 border-l es-hairline pl-3">
        {SIZES.map((size) => (
          <button key={size} aria-label={`Size ${size}`} aria-pressed={style.size === size} onClick={() => desk.setStyle({ size })} className={`es-focus grid h-6 w-6 place-items-center ${style.size === size ? "bg-bone/10" : ""}`}>
            <span className="rounded-full bg-bone" style={{ width: Math.min(14, size + 2), height: Math.min(14, size + 2) }} />
          </button>
        ))}
      </div>
    </div>
  );
}
