# eSketcher — agent notes

Arena **experiment**. Kill criteria live in `README.md`; state which one a change moves before adding features.

Commands: `backend/Makefile`, `frontend/package.json` scripts. Run backend tools as `uv run --extra dev …` — plain `uv run` re-syncs the venv and drops pytest/ruff.

## Invariants

- **The TypeSafe key lives only in `backend/.env`.** The browser talks to FastAPI; only `RealJevProvider` talks to `api.typesafe.ai`. Logs carry decision ids and outcomes, never state payloads or headers.
- **Real mode shows real answers.** Every probability in the UI comes from a `/api/jev/*` response. Pacing (the ~380 ms minimum think time) is allowed; invented numbers are not. The mock lives behind `JEV_MODE=mock` and returns the exact SystemOne wire shape.
- **Candidate field is chosen client-side** (`frontend/src/lib/jev/candidates.ts`); the backend validates ids against its catalog and builds the question (`backend/app/services/paint_selector.py`). Jev ranks; it never sees materials outside the field.
- **Region ids are persisted.** Saved paints key on `region.id` (`kind-index`) produced by the generators in `frontend/src/lib/sketchArt/generators/`. Reordering or inserting `b.region(...)` calls re-labels saved paints; append new regions at the end of a variant.
- **Every Jev route stays behind `jev_limited`** (`backend/app/deps.py`): per-client minute and day limits, then the server's daily budget, in that order, so blocked clients can't spend the budget. Limits key on the client IP, which is only real when uvicorn trusts the proxy that overwrites `X-Forwarded-For` (see README → Abuse limits).
- **Mock noise is seeded from sketch + target + retry only**, so canvas context (painted neighbours, chaos) shifts scores deterministically. Keep it that way; `test_mock_avoids_already_painted_neighbours` guards it.
- **Demo mode never fakes Jev.** When the boot-time catalog load fails, `useCatalog` calls `goOffline()` (`frontend/src/services/api.ts`) and sets the store's `offline` flag. `VITE_OFFLINE=1` forces this for a whole build. `api` then delegates to `createOfflineApi()`, which reads the bundled catalog, saves to localStorage, and rejects every Jev call with code `offline`. Gate new Jev entry points on `useStudio` → `offline`. The mode is chosen once per visit; don't switch it live, because saves would split between server and browser.
- **Catalog is backend-owned** (`backend/app/catalog/`); the frontend renders visuals from its metadata. After catalog changes run `make catalog` to regenerate `frontend/src/data/catalog.json`; `test_catalog.py` fails until you do. A material's look is its `type` + `palette` + `roughness`/`viscosity`, rendered in `frontend/src/lib/paintEngine/PaintLayer.tsx`.

## Testing

- Backend: 90% coverage gate, currently 100%. Provider tests use `httpx.MockTransport`; no network.
- Frontend: vitest gate covers everything except `MaterialRail` (rAF conveyor), `FlightLayer` (motion) and `App`. After touching those, open the app in mock mode and exercise select → Jev tool → paint → Play.

## Canvas engine

`src/lib/desk/` is ours (no tldraw: its licence blocks production). `Desk` owns document, history, camera and hit-testing; `GestureController` is the pointer/keyboard state machine; React only renders. Mutate through `Desk` methods so undo and autosave see the change; wrap multi-step edits in `desk.transact` or a gesture so they undo as one.
