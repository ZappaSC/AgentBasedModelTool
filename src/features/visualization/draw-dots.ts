// TODO: throwaway placeholder draw — replace alongside the engine module
// when a real ABM model arrives. The Canvas accepts the active DrawFn as
// a prop, so future models supply their own.

import type { Agent, Bounds } from "@/features/simulation/engine";

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  agents: Agent[],
  bounds: Bounds,
) => void;

export const drawDots: DrawFn = (ctx, agents, bounds) => {
  ctx.clearRect(0, 0, bounds.width, bounds.height);
  ctx.fillStyle = "#000";
  for (const a of agents) {
    ctx.beginPath();
    ctx.arc(a.x, a.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
};
