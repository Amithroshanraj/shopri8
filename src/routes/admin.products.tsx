import { createFileRoute } from "@tanstack/react-router";
import { AdminProductsPage } from "@/components/admin/AdminPages";

export const Route = createFileRoute("/admin/products")({ component: AdminProductsPage });
