# PRD 0001 — Web-app scaffold for AgentBasedModelTool

## Problem Statement

The user wants to build an agent-based modeling (ABM) analysis tool as a web application, but the repository currently contains nothing beyond a one-line README. Before any modeling work can begin, they need a runnable web-app scaffold with the persistence, simulation, and visualization seams already in place — so that future ABM features slot into clearly-marked positions instead of forcing scaffolding decisions and modeling decisions to happen at the same time.

## Solution

Scaffold a Next.js 15 (App Router) application that runs locally with `pnpm dev`, persists scenario data to a Postgres database (running via local `docker-compose`), and visualizes agents on an HTML5 canvas driven by a Web Worker-hosted simulation engine. The scaffold ships with a deliberately-trivial "bouncing dots" placeholder model that exercises the full worker ↔ UI ↔ DB pipeline end-to-end — so on first clone, `pnpm dev` shows visible motion, a working "Save scenario" button, and a populated scenario list. The placeholder model is throwaway; real ABM logic plugs into the same engine seam later.

## User Stories

1. As a researcher cloning the repo fresh, I want `pnpm install && docker compose up -d && pnpm db:push && pnpm dev` to give me a running app, so that I can start work without resolving setup issues.
2. As a researcher, I want to see a running placeholder simulation on the canvas immediately, so that I know the worker→UI pipeline works end-to-end before I commit to a modeling paradigm.
3. As a researcher, I want simulation logic to run off the main thread, so that rendering stays smooth as the model grows in complexity.
4. As a researcher, I want simulation engine logic to live in a pure-function module separate from the Web Worker, so that I can test the engine in plain Node without spinning up a browser.
5. As a researcher, I want to save the current scenario configuration to the database, so that I can return to specific experimental setups later.
6. As a researcher, I want to load a previously saved scenario, so that I can reproduce earlier experiments.
7. As a researcher, I want to update a saved scenario's name and config, so that I can iterate on parameter sets without piling up duplicates.
8. As a researcher, I want to delete saved scenarios I no longer need, so that the list stays manageable.
9. As a researcher, I want a list of all saved scenarios visible in the UI, so that I can navigate between experiments.
10. As a researcher, I want playback controls (play, pause, reset) wired up in the UI, so that I can step through simulations interactively.
11. As a developer, I want the canvas renderer to read agent state from a global store rather than from props, so that high-frequency tick updates don't re-render unrelated components.
12. As a developer, I want feature-folder organization (`scenarios`, `simulation`, `visualization`, `runs`), so that I can add code in obvious places as the project grows.
13. As a developer, I want a future-ready `runs` feature folder (empty but present), so that saving simulation outputs is an obvious next step rather than a re-architecture.
14. As a developer, I want all communication between UI and Web Worker wrapped in a typed RPC layer (Comlink), so that I don't have to maintain a hand-rolled message-protocol enum.
15. As a developer, I want shadcn/ui primitives copy-pasted into my repo, so that I can edit them freely without vendor lock-in.
16. As a developer, I want the canvas draw function to be pluggable, so that swapping the placeholder model for a real one doesn't require rewriting the renderer.
17. As a developer, I want Drizzle migrations generated from a TS schema, so that schema changes are tracked in version control.
18. As a developer, I want a committed initial migration so a fresh clone can apply schema without any extra steps.
19. As a developer, I want a `.env.example` template committed and `.env.local` gitignored, so that secrets management follows the standard convention.
20. As a developer, I want TypeScript strict mode (including `noUncheckedIndexedAccess`) enabled from the start, so that I don't have to backfill strictness later.
21. As a developer, I want Biome as the single lint+format tool, so that I have one config file instead of separate ESLint and Prettier setups.
22. As a developer, I want Vitest configured with at least one passing test against the simulation engine, so that the test pattern is established for future work.
23. As a developer, I want a `docker-compose.yml` for Postgres 16 at the repo root, so that I can start the DB with one command.
24. As a developer, I want package scripts (`dev`, `build`, `lint`, `test`, `db:push`, `db:generate`, `db:studio`), so that common tasks are discoverable.
25. As a developer publishing the app later, I want the persistence API co-located in Next.js route handlers (not a separate process), so that deployment is a single Next.js deploy with no separate backend.
26. As a researcher, I want the placeholder bouncing-dots model marked clearly as throwaway (TODO comments, named to signal placeholder status), so that I can confidently delete it when my real model arrives.
27. As a developer, I want TanStack Query hooks abstracting all scenario API calls, so that components don't import `fetch` directly.
28. As a developer, I want a Zustand store handling sim state with selector-based subscriptions, so that only components reading the changed slice re-render on each tick.

## Implementation Decisions

- **Simulation runtime:** client-side in a Web Worker. The persistence backend is purely a CRUD API; no server-side simulation.
- **Frontend + persistence:** single Next.js 15 (App Router) project. API lives in route handlers under `app/api/scenarios/`. This keeps the scaffold to one process and one deploy unit when published.
- **Database:** Postgres 16, run locally via committed `docker-compose.yml`. Production path is unchanged drivers via Neon / Supabase / Railway later.
- **ORM:** Drizzle, with the schema defined as TypeScript modules under `lib/db/schema/`. Migrations generated via `pnpm db:generate`, applied via `pnpm db:push`.
- **Initial schema (deliberately minimal):**
  - `scenarios(id uuid pk, name text, config jsonb, created_at timestamptz, updated_at timestamptz)`
  - `runs(id uuid pk, scenario_id uuid fk → scenarios.id, params jsonb, summary jsonb, created_at timestamptz)`
- **Worker RPC:** Comlink. The worker exposes `init(config)`, `play()`, `pause()`, `reset()`, `step()`, and a subscription channel for tick snapshots.
- **Deep module split for the simulation:**
  - **`features/simulation/engine`** — pure, no Worker, no Comlink, no DOM. Functions: `initState(config) → State`, `step(state) → State`. The placeholder bouncing-dots logic lives here. Future real models replace this module wholesale.
  - **`workers/simulation.worker`** — thin Comlink host. Owns one `State` instance, calls `engine.step()` on its tick loop, posts snapshots to the UI subscriber. No domain logic.
  - **`features/simulation/client`** — UI-side wrapper. Boots the worker via Comlink, exposes typed async methods to React, plumbs incoming snapshots into the Zustand store.
- **State management:**
  - **Zustand store** for live sim state: `tick`, `agents` snapshot array, `playbackState` (`idle | running | paused`). Selector-based reads so renders are cheap.
  - **TanStack Query** for scenario CRUD: `useScenarios`, `useCreateScenario`, `useUpdateScenario`, `useDeleteScenario`.
- **Rendering:** raw HTML5 Canvas inside a React component. A `requestAnimationFrame` loop reads `agents` from the Zustand store and calls a pluggable `draw(ctx, agents)` function. The default draw function renders the placeholder dots.
- **API contract (scenarios):**
  - `GET /api/scenarios` → list
  - `POST /api/scenarios` → create (body: `{ name, config }`)
  - `GET /api/scenarios/[id]` → read one
  - `PATCH /api/scenarios/[id]` → update (body: partial `{ name?, config? }`)
  - `DELETE /api/scenarios/[id]` → delete
  - All requests/responses JSON. Validation in route handlers via zod (added as part of the scaffold).
- **Styling:** Tailwind CSS configured with shadcn/ui defaults. Initial shadcn components seeded: `Button`, `Card`, `Dialog`, `Input`, `Label`. Other primitives added when first needed.
- **Folder structure:** feature-folders under `src/features/` (`scenarios`, `simulation`, `visualization`, empty `runs`); `src/lib/` for cross-cutting infrastructure (`db/`, `utils.ts`); `src/components/ui/` for shadcn primitives. Worker source lives at top-level `workers/simulation.worker.ts` to keep it out of Next.js's main bundle.
- **Tooling:** pnpm package manager. Biome as the only lint+format tool (replaces ESLint + Prettier). Vitest as the test runner. TypeScript strict mode plus `noUncheckedIndexedAccess`.
- **Living-scaffold demo content:** the placeholder bouncing-dots engine seeds N agents (default 100), each with `(x, y, vx, vy)`. `step()` advances positions and reflects velocity off canvas edges. Tick rate target: 30Hz. The renderer redraws every animation frame. A "Save current scenario" button persists the current init-config to `scenarios`. A scenarios sidebar lists saved entries. Loading a saved scenario re-runs `init` with that config.

## Testing Decisions

**What makes a good test in this codebase:** tests exercise the **observable behavior** of a module through its public interface — never private fields, never internal implementation details. A test that fails when the implementation is refactored (but behavior is unchanged) is a bad test.

**Modules with tests in this scaffold:**

- **`features/simulation/engine`** — the only module tested in the initial scaffold. Vitest in the Node environment (no jsdom). Covered behaviors:
  - `initState(config)` returns the requested number of agents
  - `initState(config)` agents are inside the bounds specified by config
  - `step(state)` advances each agent by its velocity
  - `step(state)` reflects velocity when an agent hits a wall
  - `step(state)` is pure: calling it twice with the same input gives the same output
- These tests double as the canonical example for "how to write a test in this codebase." Future tests for new engine modules follow the same pattern.

**Deferred (added when the modules grow real logic):**

- `features/simulation/store` (Zustand actions) — trivial in the scaffold; will be tested once non-trivial reducer logic appears.
- `features/scenarios/api-client` (TanStack Query hooks) — needs MSW or similar mock-server setup; add when the API stabilizes.
- `lib/db` schema/migrations — testcontainers- or pglite-based integration tests; add when schema complexity warrants it.

**Prior art:** none — this scaffold establishes the test patterns for the repo.

## Out of Scope

- Authentication, accounts, multi-user isolation
- Production deployment configuration (Vercel / Neon / etc. — local-only for now)
- Real ABM modeling content (Schelling, SIR, opinion dynamics, etc.) — the placeholder dots are intentionally meaningless
- Run-result persistence beyond having an empty `runs` table — saving actual run outputs comes later
- Parameter sweeps, batch experimentation, scheduling
- Charting / aggregate metrics dashboards
- 3D visualization
- Multi-context / monorepo structure
- CI configuration

## Further Notes

- The split between **`features/simulation/engine`** (pure) and **`workers/simulation.worker`** (Comlink host) is deliberately the deepest module boundary in the scaffold. When a real ABM model arrives, it should replace the engine module wholesale without touching the worker host, the store, the renderer, or the API.
- The `runs` folder is intentionally empty at scaffold-time but committed. It marks the obvious slot for saving simulation outputs and serves as a hint to future contributors.
- Next.js Web Worker support in the App Router has historical quirks (Webpack worker-loader config, edge-runtime constraints). The exact incantation is left to the implementer; the success criterion is that the placeholder model appears on screen at first `pnpm dev`.
- Domain glossary: `CONTEXT.md` does not yet exist. The first run of `/grill-with-docs` will create it once real modeling vocabulary needs to be pinned down.
