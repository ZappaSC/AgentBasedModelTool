import { describe, expect, it } from "vitest";

import type { Agent } from "@/features/simulation/engine";

import { drawDots } from "./draw-dots";

type CtxCall = { method: string; args: unknown[] };

const makeRecordingCtx = () => {
  const calls: CtxCall[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };
  const ctx = {
    clearRect: record("clearRect"),
    beginPath: record("beginPath"),
    arc: record("arc"),
    fill: record("fill"),
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
};

const agent = (overrides: Partial<Agent> = {}): Agent => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  ...overrides,
});

describe("drawDots", () => {
  const bounds = { width: 320, height: 240 };

  it("clears the full canvas before drawing", () => {
    const { ctx, calls } = makeRecordingCtx();

    drawDots(ctx, [agent()], bounds);

    expect(calls).toContainEqual({
      method: "clearRect",
      args: [0, 0, bounds.width, bounds.height],
    });
  });

  it("draws one dot per agent", () => {
    const { ctx, calls } = makeRecordingCtx();
    const agents = [agent({ x: 10 }), agent({ x: 20 }), agent({ x: 30 })];

    drawDots(ctx, agents, bounds);

    const arcs = calls.filter((c) => c.method === "arc");
    expect(arcs).toHaveLength(agents.length);
  });

  it("places each dot at its agent's position", () => {
    const { ctx, calls } = makeRecordingCtx();
    const agents = [
      agent({ x: 12, y: 34 }),
      agent({ x: 56, y: 78 }),
      agent({ x: 99, y: 7 }),
    ];

    drawDots(ctx, agents, bounds);

    const arcs = calls.filter((c) => c.method === "arc");
    const drawnPositions = arcs.map((c) => [c.args[0], c.args[1]]);
    const agentPositions = agents.map((a) => [a.x, a.y]);
    expect(drawnPositions).toEqual(agentPositions);
  });
});
