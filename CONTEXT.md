# Context

Domain glossary for AgentBasedModelTool. When code, issues, or PRDs name a concept
listed here, use the term as defined. If you need a concept that isn't yet pinned,
that's a signal to grill it out and add it here.

This is a glossary, not a spec. Implementation details belong in code, ADRs, or
PRDs — not here.

## Glossary

### Config

The *parameters* required to construct a fresh simulation. Currently
`{ agentCount, bounds: { width, height } }`. Pure data, no runtime state, no tick
counter. Handed to [`initState`](#step) to produce a [State](#state).

Config will grow as real simulation models arrive (likely additions: random seed,
tick rate, model-specific interaction parameters). The scaffold's shape is
intentionally minimal and is expected to change.

### State

The engine's runtime data at a single moment: `{ tick, agents[] }`. Lives in
memory inside the [Worker](#worker). Produced by `initState(config)` and
advanced one step at a time by `step(state, bounds)`. The engine module owns
the canonical `State` type.

### Scenario

A *saved, named* [Config](#config). Persisted as a row
`{ id, name, config: jsonb, created_at, updated_at }` in the `scenarios` table.

A Scenario captures **only the recipe**, not any captured [State](#state).
Loading a Scenario re-runs `initState(config)` from scratch — it does **not**
resume a previous simulation mid-tick. Mid-run resume is out of scope; if it is
ever needed, it will be a separate concept (a [Run](#run) checkpoint or
similar), not a Scenario field.

### Run

A *single execution* of a [Scenario](#scenario), producing outputs (summary
statistics, possibly a recording). One Scenario relates to many Runs.

The `runs` table exists in the schema (`{ id, scenario_id, params, summary, created_at }`)
but nothing writes to it in the scaffold. Real run-output persistence is a
future slice — `runs` is currently a marked-but-empty seam.

### Step

The *verb*. The pure engine function `step(state, bounds) → State` that advances
the simulation by one unit. Always used as a verb or as the function's name —
never as a noun for a unit of time. The unit of time is a [tick](#tick).

### `initState` vs `init`

Two related operations live at different [architecture layers](#architecture-layers)
and intentionally keep different names:

- **`initState(config) → State`** — the **Engine**'s pure constructor. Returns
  a fresh [State](#state) value. No side effects.
- **`init(config) → Promise<void>`** — the **Worker** / **Client**'s effectful
  re-init. Replaces the Worker's owned State, resets [`tick`](#tick) to 0,
  and starts emitting [snapshots](#snapshot). Returns nothing — the result is
  observed via the [Store](#store).

The names differ because the operations differ: one is a pure value-producer,
the other is an effect on long-lived state. Don't try to unify them.

### Tick

The simulation's discrete-time counter. The integer field on [State](#state)
that starts at `0` after `initState` and increments by `1` each [step](#step).
A *count*, not a duration.

Distinct from [tick rate](#tick-rate), which is a wall-clock concept.

### Tick rate

The wall-clock frequency at which the [Worker](#worker)'s loop calls
[`step`](#step) when running (PRD target: 30Hz). This is about *when* steps
happen, not what they are.

Adjustable. Will likely move into [Config](#config) once the scaffold's
placeholder model is replaced by a real one.

### Snapshot

A *transferable copy* of [State](#state) at one [tick](#tick): `{ tick, agents[] }`.
What the [Worker](#worker) emits to the main thread each tick. The Zustand
store holds the latest snapshot; the renderer reads agents from snapshots, never
from the engine's live State (which lives only in the worker).

Distinct from a **render frame** (one pass of `requestAnimationFrame`). Render
frames can outpace snapshots — the renderer redraws every animation frame even
when no new snapshot has arrived.

## Architecture layers

The simulation pipeline is split into five layers. Each is named below, with
the directory it lives in and the invariants it must respect. See
[ADR-0001](docs/adr/0001-five-layer-simulation-architecture.md) for the
rationale.

### Engine

`src/features/simulation/engine/`. **Pure** TypeScript. No Worker, no Comlink,
no DOM, no React. Exports `initState`, `step`, and the `State` / `Agent` /
`Config` types. Replaceable wholesale when a real ABM model arrives.

**Invariant:** Engine imports nothing from the other four layers.

### Worker

`workers/simulation.worker.ts`. Thin Comlink **host**. Owns one [State](#state)
instance, runs the [tick rate](#tick-rate) loop, calls [`engine.step`](#step),
posts [snapshots](#snapshot) to the main thread.

**Invariant:** No domain logic in the Worker. Anything that touches agent
fields (`x`, `y`, `vx`, `vy`) or interaction rules belongs in the [Engine](#engine).
The Worker only orchestrates time.

### Client

`src/features/simulation/client.ts`. UI-side wrapper around the Worker. Boots
the Worker via Comlink, exposes typed async methods (`init`, `play`, `pause`,
`reset`, `step`), plumbs incoming snapshots into the [Store](#store).

**Invariant:** No engine import. Components never call the Worker directly —
they go through the Client. This is what makes Comlink a swappable
implementation detail.

### Store

`src/features/simulation/store.ts`. Zustand store holding the latest snapshot
fields (`tick`, `agents`) and [playbackState](#playbackstate). Selector-based
reads.

**Invariant:** The Store is the only thing the [Renderer](#renderer) reads
from for live simulation data.

### Renderer

`src/features/visualization/`. The Canvas component plus a pluggable draw
function. Reads `agents` from the [Store](#store) via a selector, calls
`draw(ctx, agents)` inside a `requestAnimationFrame` loop.

**Invariant:** No Engine import, no Worker import, no Client import. The
Renderer cares about pixels, not simulation logic.

**Temporary exception during scaffold slice #3:** the Canvas imports the
[Engine](#engine) directly to render one frame on mount, because the Worker
and Store don't exist yet. This shortcut is removed in scaffold slice #4 when
the Worker / Client / Store land. Files that take this shortcut must carry a
TODO comment naming issue #4 so a later agent working on #4 in isolation can
find and remove them.

## Renderer concepts

### DrawFn

The pluggable signature the [Renderer](#renderer) uses to paint a frame:

```ts
type DrawFn = (
  ctx: CanvasRenderingContext2D,
  agents: Agent[],
  bounds: Bounds,
) => void;
```

A DrawFn owns the **full visual semantics** of a frame, including clearing
or styling the background. The Canvas component does **not** clear before
calling — that's the DrawFn's job, so future models can render trails,
tinted backgrounds, or non-rectangular worlds without changing the Canvas.

### drawDots

The default placeholder [DrawFn](#drawfn), supplied by the [Engine](#engine)'s
sibling placeholder file `src/features/visualization/draw-dots.ts`. Renders
each agent as a small solid black dot on a cleared white background.

Throwaway, same as the placeholder engine. When the real model arrives it
brings its own DrawFn; `drawDots` is deleted. The Canvas accepts the active
DrawFn as a prop (`<Canvas draw={drawDots} />`) — there is no global
"current draw" registry.

## Playback

### PlaybackState

A three-valued enum on the [Store](#store): `idle | running | paused`.

- **`idle`** — the sim has been initialized but is not running. Either it's
  just been [`init`](#step)'d for the first time, or [reset](#reset) has just
  fired, or a [Scenario](#scenario) was just loaded. `tick === 0`; agents are
  at their initial positions.
- **`running`** — the [Worker](#worker)'s tick-rate loop is actively calling
  [`step`](#step) and emitting [snapshots](#snapshot). `tick` advances every
  Worker tick.
- **`paused`** — the sim was `running` and has been stopped mid-flight.
  `tick > 0`; agents are frozen at the last emitted snapshot.

Both `idle` and `paused` are "stopped" — the distinction is **at the start**
vs **mid-run**. Saving Scenarios is independent of this state (Scenarios
capture the recipe, not the live State).

#### Transitions

| From      | Event           | To        |
| --------- | --------------- | --------- |
| `idle`    | Play            | `running` |
| `running` | Pause           | `paused`  |
| `paused`  | Play            | `running` |
| any       | Reset           | `idle`    |
| any       | Load Scenario   | `idle`    |

Loading a Scenario is **disabled while `running`** — the user must Pause or
Reset first. This is a deliberate simplification; we are not building "load
interrupts and re-inits" interactions.

There are no automatic transitions: the sim runs until explicitly stopped by
the user.

### Active Scenario

The [Scenario](#scenario) whose [Config](#config) is currently running in the
[Worker](#worker), if any. Held in the [Store](#store) as `activeScenarioId:
string | null`. **Just a pointer, not a copy of the row** — the Scenario's
fields are fetched separately via TanStack Query.

`null` on fresh page load (the sim is running placeholder defaults, not from
the database).

**Lifecycle:**

| Event                                | Effect on `activeScenarioId`                          |
| ------------------------------------ | ----------------------------------------------------- |
| Fresh page load                      | `null`                                                |
| Click a Scenario in sidebar          | Becomes that Scenario's id                            |
| Save a new Scenario (#6)             | Becomes the newly-created Scenario's id (auto-activate) |
| Rename the active Scenario           | Unchanged                                             |
| Delete the active Scenario           | `null`; sim keeps running its current State           |
| Reset                                | Unchanged                                             |

In code, the canonical name is **`activeScenarioId`**. In English (CONTEXT.md,
PRDs, comments, UI tooltips that surface internal terminology) use **"the
active Scenario"**. "Loaded" / "currently loaded" is acceptable only in
user-facing copy (e.g. sidebar tooltips) and is treated as a synonym, not a
second concept.
