import { createFileRoute } from "@tanstack/react-router";
import { WorkerShell } from "@/components/WorkerShell";

export const Route = createFileRoute("/worker")({
  component: WorkerShell,
});
