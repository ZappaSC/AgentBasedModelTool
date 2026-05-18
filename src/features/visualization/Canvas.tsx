"use client";

// TODO(issue-#3 → issue-#4): this component imports the Engine directly to
// render a single frame on mount, because the Worker / Client / Store don't
// exist yet. When Issue #4 lands (Worker via Comlink + Zustand Store), the
// Engine import must be removed; the Renderer reads `agents` from the Store
// inside a requestAnimationFrame loop. See CONTEXT.md → Architecture layers →
// Renderer for the invariant this temporarily violates.

import { useEffect, useRef } from "react";

import { type Config, initState } from "@/features/simulation/engine";

import { type DrawFn, drawDots } from "./draw-dots";

type CanvasProps = {
  config: Config;
  draw?: DrawFn;
};

export function Canvas({ config, draw = drawDots }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = initState(config);
    draw(ctx, state.agents, config.bounds);
  }, [config, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={config.bounds.width}
      height={config.bounds.height}
      className="border border-zinc-300"
    />
  );
}
