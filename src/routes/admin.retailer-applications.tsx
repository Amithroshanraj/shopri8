import { createFileRoute } from "@tanstack/react-router";
import { AdminRetailerApplicationsPage } from "@/components/admin/AdminRetailerApplicationsPage";

export const Route = createFileRoute("/admin/retailer-applications")({
  component: AdminRetailerApplicationsPage,
});
