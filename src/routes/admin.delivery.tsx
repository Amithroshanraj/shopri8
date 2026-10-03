import { createFileRoute } from "@tanstack/react-router";
import { AdminDeliveryPage } from "@/components/admin/AdminPages";

export const Route = createFileRoute("/admin/delivery")({ component: AdminDeliveryPage });
