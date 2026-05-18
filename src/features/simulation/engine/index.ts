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

const MAX_INITIAL_SPEED = 2;

export function initState(config: Config): State {
  const { bounds } = config;
  const randomVelocity = () => (Math.random() * 2 - 1) * MAX_INITIAL_SPEED;
  return {
    tick: 0,
    agents: Array.from({ length: config.agentCount }, () => ({
      x: Math.random() * bounds.width,
      y: Math.random() * bounds.height,
      vx: randomVelocity(),
      vy: randomVelocity(),
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
