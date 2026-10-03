import { createFileRoute } from "@tanstack/react-router";
import { AdminDetailPage } from "@/components/admin/AdminPages";

export const Route = createFileRoute("/admin/delivery/$taskId")({
  component: () => <AdminDetailPage section="delivery" />,
});
