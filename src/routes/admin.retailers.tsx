import { createFileRoute } from "@tanstack/react-router";
import { AdminRetailersPage } from "@/components/admin/AdminPages";

export const Route = createFileRoute("/admin/retailers")({ component: AdminRetailersPage });
