import { createFileRoute } from "@tanstack/react-router";
import { AdminDetailPage } from "@/components/admin/AdminPages";

export const Route = createFileRoute("/admin/users/$userId")({
  component: () => <AdminDetailPage section="users" />,
});
