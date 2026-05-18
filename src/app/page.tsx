import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        AgentBasedModelTool
      </h1>
      <p className="text-sm text-zinc-500">
        Scaffold is alive. Replace this page with the simulation UI.
      </p>
      <Button>Hello, shadcn</Button>
    </main>
  );
}
