import { createFileRoute } from "@tanstack/react-router";
import { AdminProfilePage } from "@/components/admin/AdminPages";

export const Route = createFileRoute("/admin/profile")({ component: AdminProfilePage });
