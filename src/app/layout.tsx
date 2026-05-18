import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentBasedModelTool",
  description: "Agent-based modeling web application",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-zinc-900">
        {children}
      </body>
    </html>
  );
}
