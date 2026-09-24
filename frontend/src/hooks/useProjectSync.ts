import { useEffect } from "react";

import { seedDesk, zoomToStart } from "@/lib/canvas/boards";
import { isDeskDoc, type Desk } from "@/lib/desk/desk";
import { ApiError, api } from "@/services/api";
import { useStudio, type HistoryEntry } from "@/state/studio";

const PROJECT_KEY = "esketcher:project";
const HISTORY_KEY = (id: string) => `esketcher:history:${id}`;
const SAVE_DEBOUNCE_MS = 1500;

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: persistence is best-effort */
  }
}

const snapshotOf = (desk: Desk) => ({ desk: desk.snapshot() });

// One load per desk: React StrictMode runs effects twice in development, and a
// second load must not seed (or create) the project again.
const opening = new WeakMap<Desk, Promise<{ id: string; revision: number }>>();

function openProject(desk: Desk): Promise<{ id: string; revision: number }> {
  const pending = opening.get(desk) ?? loadProject(desk);
  opening.set(desk, pending);
  pending.catch(() => opening.delete(desk));
  return pending;
}

async function loadProject(desk: Desk): Promise<{ id: string; revision: number }> {
  const store = useStudio.getState();
  const existing = readLocal(PROJECT_KEY);
  if (existing) {
    try {
      const project = await api.getProject(existing);
      // older snapshots (pre-desk engine) are not loadable; start a fresh desk over them
      if (isDeskDoc(project.snapshot.desk)) {
        desk.load(project.snapshot.desk);
        zoomToStart(desk);
      } else seedDesk(desk, store.sketches, store.materials);
      return { id: project.id, revision: project.revision };
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  }
  seedDesk(desk, store.sketches, store.materials);
  const created = await api.createProject("My universe", snapshotOf(desk));
  writeLocal(PROJECT_KEY, created.id);
  return { id: created.id, revision: created.revision };
}

/** Load the project into the desk, then autosave document changes (debounced). */
export function useProjectSync(desk: Desk | null): void {
  useEffect(() => {
    if (!desk) return;
    const store = useStudio.getState();
    let revision = 0;
    let projectId: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const save = async () => {
      if (!projectId) return;
      useStudio.getState().setSave("saving");
      try {
        const saved = await api.saveProject(projectId, snapshotOf(desk), revision);
        revision = saved.revision;
        useStudio.getState().setSave("saved");
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          revision = Number(error.detail.revision ?? revision);
          void save();
          return;
        }
        useStudio.getState().setSave(error instanceof ApiError && error.status === 0 ? "offline" : "error");
      }
    };

    openProject(desk)
      .then((project) => {
        if (disposed) return;
        projectId = project.id;
        revision = project.revision;
        store.setProject(project.id);
        const history = readLocal(HISTORY_KEY(project.id));
        if (history) store.setHistory(JSON.parse(history) as HistoryEntry[]);
        store.setSave("saved");
      })
      .catch(() => {
        if (disposed) return;
        if (!Object.keys(desk.snapshot().shapes).length) seedDesk(desk, store.sketches, store.materials);
        store.setSave("offline");
      });

    const stopDoc = desk.onDocChange(() => {
      useStudio.getState().setSave("dirty");
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void save();
      }, SAVE_DEBOUNCE_MS);
    });
    const stopHistory = useStudio.subscribe((s, prev) => {
      if (s.history !== prev.history && s.projectId) writeLocal(HISTORY_KEY(s.projectId), JSON.stringify(s.history));
    });

    return () => {
      disposed = true;
      stopDoc();
      stopHistory();
      // leaving with unsaved edits (e.g. back to the home page): save them now
      if (timer !== undefined && useStudio.getState().save === "dirty") {
        clearTimeout(timer);
        void save();
      }
    };
  }, [desk]);
}
