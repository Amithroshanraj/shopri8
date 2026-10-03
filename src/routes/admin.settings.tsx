import { createFileRoute } from "@tanstack/react-router";
import { AdminSettingsPage } from "@/components/admin/AdminPages";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettingsPage });
