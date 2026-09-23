import { useStudio } from "@/state/studio";

export function useMaterials() {
  return useStudio((s) => s.materials);
}

export function useMaterial(id: string | null | undefined) {
  return useStudio((s) => (id ? s.materialsById.get(id) : undefined));
}
