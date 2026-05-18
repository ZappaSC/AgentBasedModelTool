# ADR 0001 — Five-layer simulation architecture

## Status

Accepted — 2026-05-18.

## Context

The scaffold's central technical risk is that a future, real agent-based model
will land in a codebase whose seams force a rewrite of the surrounding plumbing
(worker host, state propagation, renderer). We want to be able to **replace the
simulation logic without touching anything else.**

The simulation pipeline has four distinct concerns that come up the moment the
sim is moving on a canvas:

1. **What the model does** (pure logic).
2. **Where it runs in time** (off the main thread, at a controllable rate).
3. **How the React tree talks to that off-main-thread process.**
4. **How the renderer reads agent state without re-rendering the world every tick.**

Conflating any two of these makes one of them hard to change later. Several
alternatives were considered:

- **Engine + Worker fused.** Simpler — one file. But the engine becomes
  untestable in plain Node (it pulls in Comlink/Worker globals), and swapping
  in a real model requires touching the worker host.
- **No Store; Canvas subscribes directly to the worker.** Cuts a layer. But
  Comlink subscriptions trigger React re-renders, and high-frequency tick
  updates would re-render any component on the same hook — making it hard to
  put other UI (controls, sidebar) on the same page without performance
  regressions. The Store with selector-based reads isolates re-render scope.
- **No Client; components import the worker directly.** Cuts a layer. But then
  every component knows about Comlink, the worker file path, and the
  bootstrap dance — and Comlink stops being a swappable detail.

## Decision

Adopt a **five-layer split** with strict directionality:

```
Engine  →  Worker  →  Client  →  Store  →  Renderer
(pure)    (host)     (RPC)      (state)    (pixels)
```

- **Engine** (`src/features/simulation/engine/`): pure TS, no imports from
  other layers. Replaceable wholesale.
- **Worker** (`workers/simulation.worker.ts`): Comlink host. Owns one engine
  `State`. Calls `engine.step()` on its tick-rate loop. No domain logic.
- **Client** (`src/features/simulation/client.ts`): the React side's only
  path to the Worker. Boots the Worker via Comlink, exposes typed async
  methods, plumbs incoming snapshots into the Store.
- **Store** (`src/features/simulation/store.ts`): Zustand store holding the
  latest snapshot (`tick`, `agents`) and `playbackState`. Selector-based
  reads.
- **Renderer** (`src/features/visualization/`): Canvas + pluggable draw
  function. Reads `agents` from the Store via a selector inside a
  `requestAnimationFrame` loop.

Invariants:

- The **Engine** imports nothing from the other four layers.
- No **engine logic** lives in the **Worker** — the Worker only orchestrates
  time.
- The **Client** has no engine import. Components never call the Worker
  directly; they go through the Client.
- The **Store** is the only thing the Renderer reads for live simulation
  data.
- The **Renderer** imports neither Engine nor Worker nor Client.

One time-bounded exception: during scaffold slice #3 (Issue #3) the Canvas
imports the Engine directly to render a single frame on mount, because the
Worker and Store don't yet exist. This shortcut is removed in slice #4 (Issue
#4). Files using the shortcut carry a TODO referencing Issue #4 so the cleanup
is locatable.

## Consequences

**Positive.**

- A real ABM model replaces the Engine module without touching the Worker,
  Client, Store, or Renderer.
- The Engine is testable in plain Node (Vitest's default `node` environment),
  with no jsdom, no Worker shim, no Comlink mock.
- Swapping Comlink for a different RPC layer is a Client-internal change.
- Tick-rate UI updates affect only components that read the slices that
  changed (selector-based Zustand reads).

**Negative.**

- Five layers is a lot for a scaffold. Anyone trying to follow data flow has
  to traverse all of them.
- The Store-as-intermediary means the Renderer can never read "the live engine
  state" — only the most recent snapshot the Worker has chosen to emit. If
  a renderer ever genuinely needs sub-snapshot data (e.g. interpolated
  positions between snapshots for smooth motion), it has to compute that
  itself or the Worker has to emit more often.
- The Client and Worker are two files for what is conceptually one
  capability. Renaming the Worker's API surface requires editing both.

**Mitigations.**

- Each layer's directory carries its own purpose in [CONTEXT.md](../../CONTEXT.md#architecture-layers).
- The Engine's TODO comment marks it as throwaway placeholder logic;
  replacement is the *expected* path, not an exception.
