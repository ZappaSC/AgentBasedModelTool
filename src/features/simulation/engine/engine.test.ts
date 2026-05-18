import { describe, expect, it } from "vitest";

import { initState, type State, step } from "./index";

describe("initState", () => {
  it("returns the requested number of agents", () => {
    const state = initState({
      agentCount: 7,
      bounds: { width: 100, height: 100 },
    });
    expect(state.agents).toHaveLength(7);
  });

  it("places every agent inside the bounds", () => {
    const bounds = { width: 80, height: 60 };
    const state = initState({ agentCount: 200, bounds });
    for (const agent of state.agents) {
      expect(agent.x).toBeGreaterThanOrEqual(0);
      expect(agent.x).toBeLessThan(bounds.width);
      expect(agent.y).toBeGreaterThanOrEqual(0);
      expect(agent.y).toBeLessThan(bounds.height);
    }
  });
});

const interior = (state: Partial<State> = {}): State => ({
  tick: 0,
  agents: [{ x: 10, y: 20, vx: 1, vy: 2 }],
  ...state,
});

const bounds = { width: 100, height: 100 };

describe("step", () => {
  it("advances each agent by its velocity and increments tick", () => {
    const before = interior();
    const after = step(before, bounds);

    expect(after.tick).toBe(1);
    expect(after.agents[0]).toMatchObject({ x: 11, y: 22, vx: 1, vy: 2 });
  });

  it("reflects vx when an agent moves past the right wall", () => {
    const before = interior({
      agents: [{ x: 99, y: 50, vx: 3, vy: 0 }],
    });
    const after = step(before, bounds);
    expect(after.agents[0]?.vx).toBeLessThan(0);
  });

  it("reflects vx when an agent moves past the left wall", () => {
    const before = interior({
      agents: [{ x: 1, y: 50, vx: -3, vy: 0 }],
    });
    const after = step(before, bounds);
    expect(after.agents[0]?.vx).toBeGreaterThan(0);
  });

  it("reflects vy when an agent moves past the bottom wall", () => {
    const before = interior({
      agents: [{ x: 50, y: 99, vx: 0, vy: 3 }],
    });
    const after = step(before, bounds);
    expect(after.agents[0]?.vy).toBeLessThan(0);
  });

  it("reflects vy when an agent moves past the top wall", () => {
    const before = interior({
      agents: [{ x: 50, y: 1, vx: 0, vy: -3 }],
    });
    const after = step(before, bounds);
    expect(after.agents[0]?.vy).toBeGreaterThan(0);
  });

  it("does not mutate the input state", () => {
    const before = interior({
      agents: [{ x: 99, y: 99, vx: 5, vy: 5 }],
    });
    const snapshot = structuredClone(before);
    step(before, bounds);
    expect(before).toEqual(snapshot);
  });
});
