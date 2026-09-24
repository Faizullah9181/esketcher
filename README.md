# eSketcher

A generative painting instrument. You select part of a sketch; **Jev** (TypeSafe's System One model) decides which paint material it should get; the material leaves the stream at the bottom of the screen, flies across the desk and paints itself in.

```
SKETCH → SELECT → JEV DECIDES → PAINT MATERIAL ARRIVES → CANVAS TRANSFORMS
```

<p align="center">
  <img src="docs/architecture.svg" alt="Architecture: the browser (desk canvas, paint engine, Jev controller, Play and Sampling) talks to the FastAPI backend (Jev routes, JevClient, catalog, SQLite), which alone calls TypeSafe Jev or the offline mock" width="760">
</p>

<p align="center">
  <img src="docs/color-decision.svg" alt="How Jev chooses a colour: select a region, measure it, pick a board palette if there is none, build a candidate field, ask Jev, read probabilities and certainty, paint, and feed the painted colours into the next decision" width="760">
</p>

<p align="center">
  <img src="docs/jev-internals.svg" alt="How Jev decides: typed state and a choice question go to a parallel sampler shaped by RLCD training; it returns a probability distribution, choice is the argmax and confidence is (n times p_max minus 1) over (n minus 1); eSketcher then normalises, ranks, bands the certainty and paints, feeding the result into the next state" width="760">
</p>

**Inside Jev.** TypeSafe publishes the behaviour, not the model. It documents these parts:
- Jev answers each question in one parallel-sampler query, isolated against the same state.
- Every answer is a probability distribution over the declared options.
- The choice is the most likely option.
- Confidence is `(n·p_max − 1)/(n − 1)`: 0 when all options are equally likely, 1 when one option has all the probability.
- RLCD (*Reinforcement Learning for Calibrated Decisions*) trains those probabilities against real outcomes so they are calibrated.

TypeSafe doesn't publish the architecture, reward, loss or weights, so the diagram shows those as a dashed box instead of inventing them.

### Painted by Jev

One Play run in mock mode: each board got a palette from Jev first, then one decision per region.

<p align="center">
  <img src="docs/screenshots/eyes.jpg" alt="The Watcher: an eye with a spectral iris and jewel-tone faceted lids" width="180">
  <img src="docs/screenshots/planets.jpg" alt="Gas Storm: a violet faceted planet on a purple nebula" width="180">
  <img src="docs/screenshots/landscapes.jpg" alt="Lake Mirror: sandstone mountains reflected in a sunset lake" width="180">
  <img src="docs/screenshots/creatures.jpg" alt="Deep Drifter: a jellyfish in lilac crystal and cosmic dust" width="180">
</p>
<p align="center">
  <img src="docs/screenshots/desk.jpg" alt="The studio after Play: eight painted boards, the Jev panel with recent decisions and the material stream" width="760">
</p>

- 105 procedural line-art sketches across 21 categories, each with named, paintable regions (eye, iris, petal, gear…)
- 121 procedural paint materials across 13 behaviours, each with its own reveal animation (liquid blobs, spray particles, watercolor blooms, ink branching, chrome sweeps, pixel assembly, smoke, glitter orbits, lava, holographic foil, dry media, crystal facets, impasto strokes)
- An infinite desk (our own canvas engine, no licensed dependencies) with any number of sketch boards: pan, zoom, select, move, resize, rotate, duplicate, group, lock, delete, pen, brush, erase, frames, undo/redo
- **Play**: Jev fills every sketch on the desk, one decision per region kind, with the camera following each board
- **Sampling**: pick N samples; they line up in a carousel under a stage, and Play lifts each one onto the stage, paints it, drops it back and slides the carousel on
- Probability fields drawn from Jev's real distribution, with honest uncertainty
- Manual override everywhere: apply, try another, pick manually, lock material, lock sketch, undo
- Chaos mode, decision history with replay, autosave
- A home page at `/` (the logo always links there) and the studio at `/studio`; **Fresh** in the nav clears the desk to an empty canvas (undoable)
- Responsive from 360px phones (portrait and landscape) through tablets to desktop, with touch: pinch zoom, finger-sized handles, a decision pill on small screens

Generated from the [codestash](../codestash) template (`python3 cli.py`), then cut down to what this app needs: no Postgres, Terraform, LangChain agent or vendored skills.

## Quick start

Requirements: Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node 22+ with npm.

```bash
# backend: http://localhost:8000 (docs at /docs)
cd backend
cp .env.example .env          # JEV_MODE=mock works with no key
make install
make dev

# frontend: http://localhost:5173 (proxies /api to the backend)
cd frontend
cp .env.example .env
npm install
npm run dev
```

Other arena apps also use 8000 and 5173. To run side by side:

```bash
cd backend && uv run --extra dev uvicorn app.main:app --port 8010 --reload
cd frontend && PORT=5180 DEV_PROXY_TARGET=http://localhost:8010 npm run dev
```

With Docker, use `BACKEND_PORT=8010 FRONTEND_PORT=5180 docker compose up --build`. It runs the backend with SQLite in a named volume and the Vite dev server.

### Routes and hosting

`/` is the home page and `/studio` is the studio; routing uses the History API (`src/lib/router.ts`). Vite's dev and preview servers already fall back to `index.html`. On any other static host, rewrite unknown paths to `index.html` so `/studio` works on refresh.

## Jev modes

| `JEV_MODE` | What answers | Needs |
|---|---|---|
| `mock` (default) | `MockJevProvider`: deterministic, local, same wire format as TypeSafe | nothing |
| `real` | `RealJevProvider`: `POST https://api.typesafe.ai/v1/systemone` | `TYPESAFE_API_KEY` |

The UI behaves identically in both modes. The header shows which one is live (`JEV ● ONLINE · REAL`), and each decision shows the model that produced it (for example `jev-1.13.0`).

**Mock mode** scores each candidate from the same traits real Jev receives: region kind, measured complexity, density, symmetry, area, painted neighbours, and chaos. It adds seeded noise and a softmax whose temperature varies per target. Some answers are decisive and some are genuinely uncertain, and it doesn't always pick the first candidate. Its confidence uses the formula TypeSafe documents for real Jev: `(n·p_max − 1)/(n − 1)`.

**Real mode:** put the key in `backend/.env` and set `JEV_MODE=real`. The backend refuses to start in real mode without a key. The key never reaches the browser, and it never appears in logs.

### Environment variables

`backend/.env`:

| Variable | Default | Purpose |
|---|---|---|
| `JEV_MODE` | `mock` | `mock` or `real` |
| `TYPESAFE_API_KEY` | — | TypeSafe bearer token (real mode) |
| `TYPESAFE_BASE_URL` | `https://api.typesafe.ai` | API host |
| `JEV_MODEL` | `jev-latest` | Any name from `GET /v1/models` (`jev-latest`, `jev-preview`) |
| `JEV_TIMEOUT_SECONDS` | `8` | Per-request timeout; one retry on 5xx, 429 or network errors |
| `JEV_RATE_LIMIT_PER_MINUTE` | `90` | Per-client limit on `/api/jev/*` |
| `DATABASE_URL` | `sqlite+aiosqlite:///./esketcher.db` | Project storage (any async SQLAlchemy URL) |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated; only needed when the frontend isn't proxied |
| `ENV` | `development` | `production` disables `/docs` |

`frontend/.env`:

| Variable | Purpose |
|---|---|
| `DEV_PROXY_TARGET` | Where the Vite dev server forwards `/api` |
| `VITE_API_URL` | Backend URL for production builds |

## How a decision works

A finite, described candidate set goes to Jev, and Jev returns a probability distribution. Everything around that distribution is deterministic code.

```
React ──► FastAPI ──► TypeSafe Jev ──► probability distribution ──► FastAPI ──► React ──► paint
```

1. **Select.** Click a board (select tool), or click a region with the Jev tool (`J`).
2. **Measure.** `frontend/src/lib/analysis/analyzer.ts` measures the real geometry of the selection: area ratio, ink density relative to the sketch, mirror symmetry, and composition.
3. **Palette.** On a board's first decision, Jev picks a palette direction for the whole sketch, such as *neon night*, *sunset fire*, *ocean & ice* or *royal jewel* (`POST /api/jev/palette`). It's stored on the board, and every later region follows it.
4. **Candidates.** `lib/jev/candidates.ts` builds the field (10 by default, 14 in chaos, at most 2 per behaviour):
   - mostly materials from the board's palette that harmonise with what's already painted (analogous or complementary hues)
   - luminous options for focal regions and calmer ones for large backgrounds
   - one contrasting wildcard, plus anything you pinned
5. **Ask.** `POST /api/jev/decide`. The backend validates ids against its catalog and builds two things:
   - a `state`: the sketch, the target in words and numbers, the painted colours in words, and the palette direction
   - a `choice` question: each candidate is described with its named hues, warm/cool temperature and traits, and the instructions spell out the harmony rules. Whole-sketch selections add a second `choice` question for the **treatment**: `focal-accent`, `full-flood`, `duotone` or `spectrum-mix`.
6. **Normalise.** `services/paint_selector.py` restricts Jev's probabilities to the candidates, fills any gaps, renormalises, and ranks them. Jev's own `confidence` sets the band: `confident` ≥ 0.55, `uncertain` < 0.35, `leaning` between.
7. **Show.** The panel draws the full field, the confidence needle and the treatment.
8. **Paint.** With the Jev tool, a `leaning` or better answer paints automatically (configurable under Experiments). An `uncertain` field waits for you: *Apply anyway*, *Try another*, or *Pick manually*. The material flies from its chip in the stream to the region, lands, and the reveal plays.

### Colour quality

Colour is decided at three levels: a palette per board, a harmony-aware candidate field, and colour words and rules in what Jev reads.

I measured the effect by painting the same four sketches with real Jev before and after. The scores are area-weighted: a colour pair counts as harmonious if the hues are analogous (≤ 40° apart), triadic or complementary.

| | before | after |
|---|---|---|
| harmonious colour pairs | 0.65 | **0.94** |
| hue families per board | 1.75 | **1.50** |
| worst board (Skyline 3AM) | 0.00 | **0.90** |

The mock provider follows the same palette and harmony rules, so mock mode looks coherent too.

### Play

**Play** in the header runs the whole loop across the desk. For every unlocked board, it groups the unpainted regions by kind (all petals, all windows), asks Jev once per group, and flies the winner into every region of that group. The camera glides to each board, and the panel shows each field as it resolves. Uncertain answers are applied anyway, because the point is to fill the desk, but the panel still shows them as uncertain.

*Pause* finishes the current decision and holds; *Resume* continues from there, and *Stop* abandons the run. If the desk is already full, Play repaints it. A 12-board desk takes about 37 decisions, which is roughly 70k input tokens in real mode.

### Sampling

**Sampling** (beside Fresh) sets how many samples to run (3–30, or presets of 4, 7, 12 or 24) and which sketches (mixed, or one category). **Build carousel** replaces the desk with the samples in a row under a stage. It's one undo step, so ⌘Z brings the old desk back.

With a carousel built, **Play** drives it. The centre sample pops and flies up to the stage, and Jev paints it: one real decision per region kind, with the paint flying in from the stream. Then the sample drops back into its slot, and the carousel slides one step, so painted samples drift off to the left and the next one arrives in the centre. After the last sample, the carousel whips back through every painted one and settles.

- *Pause* holds between samples. *Rewind* returns to the first sample. *Dissolve* keeps the painted boards as ordinary desk boards.
- Playing a finished carousel again repaints it.
- Editing is paused while it runs (panning still works).
- It's all on the real desk, so the results autosave.

The layout and choreography live in `src/state/sampling.ts`, the tweening in `src/lib/desk/animate.ts`, and the stage, carousel and arrow drawing in `src/components/Canvas/SamplingDecor.tsx`. With `prefers-reduced-motion`, every move is instant.

*Try another* calls `POST /api/jev/retry` with the rejected winner removed, and tells Jev which materials were rejected. **Lock material** makes a sketch always paint with one material without asking Jev. **Lock sketch** freezes a board. Every paint is a single undo step.

The backend's `JevClient` exposes `decide_paint`, `rank_paint_candidates`, `decide_sketch_treatment` and `get_health`. `get_health` checks `GET /v1/models` and caches the result for 30 s.

## Architecture

Both diagrams are at the top of this README. Their editable sources are [`docs/architecture.excalidraw`](docs/architecture.excalidraw) and [`docs/color-decision.excalidraw`](docs/color-decision.excalidraw); open them at excalidraw.com.

```
backend/app/
  main.py                 app factory: CORS, request-id + JSON logs, routers
  config.py               pydantic-settings; real mode requires a key
  catalog/                materials.py (121) · sketches.py (105) · palettes.py (7): source of truth
  models/                 camelCase wire schemas with strict validation
  routes/                 health · sketches · materials · decisions · projects
  services/
    jev.py                JevProvider → Real / Mock, JevClient, error taxonomy
    paint_selector.py     question building, normalisation, ranking, certainty
    color.py              hex → hue words, warm/cool, harmony
    sketch_analyzer.py    features → Jev state
    projects.py           SQLite/SQLAlchemy project store with revision guard
  rate_limit.py           sliding-window limiter for /api/jev/*

frontend/src/
  components/             Header · Toolbar · Canvas · MaterialRail · JevPanel ·
                          JevDecision (probability field, thinking, flights) · SketchGallery
  lib/sketchArt/          ArtBuilder + 21 category generators (procedural line art)
  lib/paintEngine/        PaintLayer (13 behaviours) · recipes · swatches · shared SVG defs
  lib/desk/               the canvas engine: Desk (document, history, camera, hit-testing),
                          GestureController (pointer/keyboard state machine), strokes
  lib/canvas/             sketch boards on the desk: art, coordinates, paints, seeding
  lib/analysis, lib/jev   selection measurement · candidate field · treatment distribution
  state/                  zustand UI store · jevController (the decision loop) · simulation (Play)
  hooks/                  catalog, health, project sync, chaos, decision
  services/api.ts         typed client that keeps backend error codes
```

Canvas state (boards, paints, strokes, frames) lives in the `Desk` document and is autosaved to `/api/projects/{id}` as `{ desk: DeskDoc }`. UI state (focus, active decision, flights, history, simulation) lives in zustand. Keeping the two apart means a Jev decision never re-renders the canvas.

**Why our own canvas.** tldraw v5 requires a paid licence for production: without one it watermarks the canvas and hides it after 5 seconds on non-localhost hosts. eSketcher only needed its camera, selection, transforms, drawing and history, and those fit in about 1,000 lines we own. The engine is pure TypeScript over a vanilla zustand store. Screen space is client coordinates, and `screen = (page + camera) · zoom + viewport`. Every mutation is one undo step, except a gesture (drag, resize, rotate), which folds into a single step. Only shapes that intersect the viewport render. Pen strokes use [perfect-freehand](https://github.com/steveruizok/perfect-freehand) (MIT).

Performance choices:
- Only shapes intersecting the viewport render, and the camera moves one CSS transform.
- Line art is generated once per recipe and memoised.
- The material stream moves by writing transforms from a `requestAnimationFrame` loop and re-renders only when its window of chips shifts.
- Galleries are windowed.
- Paint noise comes from one shared tile, not a filter per region.
- Reveal animations play only for fresh paints.
- Jev requests are cancellable and cached for 5 minutes per identical question.

### API

| Method | Path | |
|---|---|---|
| GET | `/api/health` | server version + Jev mode/model/online/latency |
| GET | `/api/sketches`, `/api/sketches/{id}` | `?category=` filter |
| GET | `/api/materials`, `/api/materials/{id}` | |
| GET | `/api/materials/palettes` | the 7 palette directions |
| POST | `/api/jev/palette` | `{target, context}` → `{palette, probabilities, confidence, certainty, …}` |
| POST | `/api/jev/decide` | `{target, context, candidateMaterials, scope}` → `{selectedMaterial, probabilities, ranking, confidence, certainty, treatment, latencyMs, provider, model, usage}` |
| POST | `/api/jev/retry` | as above + `rejectedMaterialIds`, `attempt` |
| POST / GET / PUT | `/api/projects`, `/api/projects/{id}` | snapshot storage; `PUT` takes `revision`, returns 409 on stale writes |

Errors use `{"detail": {"code", "message"}}`, and the UI maps each code to native copy. For example `jev_unavailable` shows *JEV CONNECTION INTERRUPTED* with *Retry* / *Continue manually*. The other codes are `jev_timeout`, `jev_auth`, `jev_quota`, `jev_malformed`, `rate_limited` and `bad_candidates`. A Jev failure never blocks painting by hand.

## Testing

```bash
cd backend && make lint test        # ruff + pytest, 90% gate (currently 100%)
cd frontend && npm run lint && npm run typecheck && npm run coverage   # 90% line gate (currently ~97%)
```

The backend tests use the mock provider and `httpx.MockTransport` for TypeSafe, so no network or key is needed.

The frontend gate covers everything except the stream's animation loop and the flight overlay, which are motion-driven and were verified by driving the app in Chrome. The canvas engine, gesture controller, simulation and canvas component are all in the gate.

## Keyboard

`V` select · `H` pan (or hold space, or middle-drag) · `Z` zoom · `D` pen · `⇧D` brush · `E` erase · `B` paint the armed material · `I` pick a material from a painted region · `F` frame · `J` Jev
`⌘Z` / `⇧⌘Z` undo / redo · `⌘D` duplicate · `⌘G` / `⇧⌘G` group / ungroup · `⌘A` select all · `⌫` delete · arrows nudge (`⇧` ×10) · `⇧L` lock · `]` / `[` front / back · `⇧1` zoom to fit · `⇧2` zoom to selection · `⌘0` 100% · `⌘`/pinch + wheel zooms, wheel pans. Double-click a board to fly to it; right-click for the context menu.