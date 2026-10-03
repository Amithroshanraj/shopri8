import { createFileRoute } from "@tanstack/react-router";
import { AdminUsersPage } from "@/components/admin/AdminPages";

export const Route = createFileRoute("/admin/users")({ component: AdminUsersPage });
