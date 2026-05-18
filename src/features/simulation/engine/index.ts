// TODO: throwaway placeholder model — replace when real model is chosen.
// This is the bouncing-dots stand-in that exists so the scaffold has something
// to render and persist end-to-end. Real ABM logic replaces this module
// wholesale: the worker host, store, renderer, and API should not need to
// change.

export type Agent = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type State = {
  tick: number;
  agents: Agent[];
};

export type Bounds = { width: number; height: number };

export type Config = {
  agentCount: number;
  bounds: Bounds;
};

export function initState(config: Config): State {
  return {
    tick: 0,
    agents: Array.from({ length: config.agentCount }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    })),
  };
}

export function step(state: State, bounds: Bounds): State {
  return {
    tick: state.tick + 1,
    agents: state.agents.map((a) => {
      const nextX = a.x + a.vx;
      const nextY = a.y + a.vy;
      const reflectX = nextX < 0 || nextX >= bounds.width;
      const reflectY = nextY < 0 || nextY >= bounds.height;
      return {
        x: nextX,
        y: nextY,
        vx: reflectX ? -a.vx : a.vx,
        vy: reflectY ? -a.vy : a.vy,
      };
    }),
  };
}
