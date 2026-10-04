import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { CartProvider } from "../lib/cart";
import { consumeDemoReturnTo, rememberDemoReturnTo, useDemoSession } from "../lib/demoAuth";
import { ROLE_LANDING, resolveCustomerGate } from "../lib/customerGate";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SHOPRi8 — Shop Nearby. Live Local." },
      {
        name: "description",
        content: "Order from trusted shops in your neighbourhood with SHOPRi8.",
      },
      { name: "theme-color", content: "#080612" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <CartProvider>
        <CustomerRouteGate />
        <Toaster position="top-center" />
      </CartProvider>
    </QueryClientProvider>
  );
}

/**
 * Guards the customer storefront. Role portals keep their own guards, so they
 * are never redirected here. Everything else requires a customer session:
 * signed-out visitors land on /auth and return to their deep link afterwards.
 */
function CustomerRouteGate() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { loading, activeRole } = useDemoSession("customer");
  const decision = useMemo(
    () => resolveCustomerGate({ pathname, activeRole, loading }),
    [pathname, activeRole, loading],
  );

  useEffect(() => {
    if (!decision.redirect) return;
    if (decision.remember) rememberDemoReturnTo("customer", pathname);
    const to =
      decision.redirect.kind === "customer-return-to"
        ? consumeDemoReturnTo("customer", ROLE_LANDING.customer)
        : decision.redirect.to;
    navigate({ to: to as never, replace: true });
  }, [decision, navigate, pathname]);

  // Blocked combinations render nothing, so protected content never flashes.
  if (decision.render === "loading") {
    return (
      <div className="app-ambience flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading SHOPRi8...</p>
      </div>
    );
  }
  return decision.render === "outlet" ? <Outlet /> : null;
}
