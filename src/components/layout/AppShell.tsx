import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { FloatingCart } from "@/components/cart/FloatingCart";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  nav = true,
  className,
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
}) {
  return (
    <div className="app-ambience min-h-screen">
      <main
        className={cn(
          "mx-auto w-full max-w-2xl px-4 pt-4",
          nav
            ? "pb-[calc(5.75rem+3.5rem+max(0.75rem,env(safe-area-inset-bottom))+1rem)]"
            : "pb-[calc(4rem+max(0.75rem,env(safe-area-inset-bottom))+1rem)]",
          className,
        )}
      >
        {children}
      </main>
      <FloatingCart />
      {nav ? <BottomNav /> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="mb-5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
      <button
        onClick={() => router.history.back()}
        aria-label="Go back"
        className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-xl glass-1"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <h1 className="truncate font-display text-lg font-semibold">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="shrink-0">{action}</div>
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  cta,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  cta?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl glass-1 px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-soft-violet">
        {icon}
      </div>
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
      {cta ? (
        <Link
          to={cta.to}
          className="press mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}
