import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RetailerShell } from "@/components/retailer/RetailerShell";

export const Route = createFileRoute("/retailer")({
  component: RetailerShell,
});
