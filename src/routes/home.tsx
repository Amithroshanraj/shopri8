import { createFileRoute } from "@tanstack/react-router";
import { CustomerHome } from "@/components/customer/CustomerHome";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "SHOPRi8 — Shops near you" },
      {
        name: "description",
        content: "Browse open shops around you and order groceries, medicines, flowers and more.",
      },
    ],
  }),
  component: CustomerHome,
});
