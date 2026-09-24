import type { TargetFeatures } from "@/types";

const ROWS: { key: keyof TargetFeatures; label: string }[] = [
  { key: "complexity", label: "complexity" },
  { key: "strokeDensity", label: "density" },
  { key: "symmetry", label: "symmetry" },
  { key: "areaRatio", label: "area" },
];

/** The measurements sent to Jev, shown as-is. */
export function StructureReadout({ features }: { features: TargetFeatures }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-3">
      {ROWS.map(({ key, label }) => {
        const value = Number(features[key]);
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between">
              <span className="es-mono text-[10px] text-ash">{label}</span>
              <span className="es-mono text-[11px] tabular-nums">{value.toFixed(2)}</span>
            </div>
            <span className="relative mt-1.5 block h-px bg-bone/10">
              <span className="absolute inset-y-0 left-0 bg-bone/50" style={{ width: `${value * 100}%` }} />
              <span className="absolute -top-[2px] h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-bone" style={{ left: `${value * 100}%` }} />
            </span>
          </div>
        );
      })}
      <div className="col-span-2 flex items-baseline justify-between">
        <span className="es-mono text-[10px] text-ash">composition</span>
        <span className="es-mono text-[11px] uppercase">{features.composition}</span>
      </div>
    </div>
  );
}
