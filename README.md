# Esketcher

FastAPI + React + PostgreSQL application with a built-in agent runtime.

## Stack

| Piece | Choice |
| --- | --- |
| Backend | FastAPI, SQLAlchemy asyncio, asyncpg |
| Frontend | React 19, TypeScript, Vite |
| Database | PostgreSQL 16 |
| LLM provider | OpenAI (`gpt-4o`) |
| Orchestration | LangChain |
| Agentic pattern | `react` — a single tool-using agent |
| Agent roles | single agent |
| MCP servers | none configured |

## Quick Start

```bash
cp backend/.env.example backend/.env   # set OPENAI_API_KEY
cp frontend/.env.example frontend/.env
docker compose up --build
```

| Service | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |

`VITE_API_URL` is resolved by the browser. `DEV_PROXY_TARGET` is resolved by the Vite dev server
and is overridden to `http://backend:8000` by docker compose.

## Agent

The agent lives in `backend/app/agentic/agent/agent.py` and is written directly against the
LangChain SDK — there is no wrapper layer or provider switch to unpick.

```python
from app.agentic.agent import root_agent

result = await root_agent.run("Summarise the latest release notes")
print(result.final_output, result.steps, result.duration_ms)

async for chunk in root_agent.stream("Draft a changelog"):
    print(chunk, end="")
```

Three seams to edit:

| Function / class | Responsibility |
| --- | --- |
| `build_model(config)` | Binds OpenAI to LangChain |
| `build_runtime(config)` | Assembles the `react` topology |
| `Agent` | Adapts the runtime to `run()` / `stream()` / `chat()` |

Check it over HTTP:

```bash
curl localhost:8000/api/agent              # provider, framework, pattern, telemetry
curl "localhost:8000/api/agent?probe=true" # also round-trips one call to the model
```

## Layout

```text
backend/app/
|-- agentic/        # agent runtime, config, mcp, memory, telemetry
|-- api/            # HTTP layer
|-- services/       # business logic
|-- repositories/   # data access + models
`-- main.py
```

The backend follows a Controller → Service → Repository → Model flow. `app/api/items.py` is the
reference resource: copy it, its service and its repository when adding a new entity.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/status` | Version plus database connectivity |
| `GET` | `/api/agent` | Agent runtime configuration |
| `GET` | `/api/items` | Paginated list — `page`, `limit`, optional `status` |
| `POST` | `/api/items` | Create an item |
| `GET` | `/api/items/{id}` | Fetch one item |
| `PATCH` | `/api/items/{id}` | Partial update |
| `DELETE` | `/api/items/{id}` | Delete an item |

Timestamps are serialised as UTC ISO-8601 with a trailing `Z`.

## Development

```bash
cd backend && make install && make dev    # API on :8000
cd frontend && npm install && npm run dev # UI on :5173
```

```bash
make test    # pytest
make lint    # ruff check
make format  # ruff format
```

## Deployment

`terraform/` holds DigitalOcean modules. Before going to production: restrict `CORS_ORIGINS`,
set `ENV=production` to disable the docs endpoint, move secrets into a managed store, and point
`VITE_API_URL` at the public API origin.

## License

Released under the [MIT License](LICENSE).
