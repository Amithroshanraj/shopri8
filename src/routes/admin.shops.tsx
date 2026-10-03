import { createFileRoute } from "@tanstack/react-router";
import { AdminShopsPage } from "@/components/admin/AdminPages";

export const Route = createFileRoute("/admin/shops")({ component: AdminShopsPage });
