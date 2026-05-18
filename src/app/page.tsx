import { Canvas } from "@/features/visualization/Canvas";

const defaultConfig = {
  agentCount: 100,
  bounds: { width: 640, height: 480 },
};

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        AgentBasedModelTool
      </h1>
      <p className="text-sm text-zinc-500">
        Scaffold slice #3 — single frame of the placeholder engine.
      </p>
      <Canvas config={defaultConfig} />
    </main>
  );
}
