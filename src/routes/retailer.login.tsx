import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock, Mail, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DEMO_RETAILER_CREDENTIALS, useRetailerAuth } from "@/lib/retailerAuth";
import { firebaseIsActive } from "@/lib/auth";
import { consumeAuthReturnTo } from "@/lib/auth/returnTo";
import { Wordmark } from "@/components/brand/Wordmark";

export const Route = createFileRoute("/retailer/login")({
  head: () => ({
    meta: [
      { title: "Retailer Sign In — SHOPRi8" },
      { name: "description", content: "Sign in to your SHOPRi8 retailer portal." },
      { property: "og:title", content: "Retailer Sign In — SHOPRi8" },
      { property: "og:description", content: "Manage your shop and orders." },
    ],
  }),
  component: RetailerLogin,
});

function RetailerLogin() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useRetailerAuth();
  // Firebase mode authenticates a real Firebase account; the demo panel and its
  // credentials are hidden entirely so they cannot be mistaken for a real login.
  const isDemo = !firebaseIsActive();
  const [email, setEmail] = useState<string>(isDemo ? DEMO_RETAILER_CREDENTIALS.email : "");
  const [password, setPassword] = useState<string>(
    isDemo ? DEMO_RETAILER_CREDENTIALS.password : "",
  );
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/retailer/dashboard", replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setLoading(true);

    try {
      await login({ email, password });
      toast.success("Welcome back!", { description: "Logged in to Retailer Portal" });
      navigate({
        to: consumeAuthReturnTo("retailer", "/retailer/dashboard") as never,
        replace: true,
      });
    } catch (error) {
      toast.error("Login failed", {
        description: error instanceof Error ? error.message : "Please check your credentials",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail(DEMO_RETAILER_CREDENTIALS.email);
    setPassword(DEMO_RETAILER_CREDENTIALS.password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Wordmark showTagline className="mx-auto" />
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-soft-violet">
            <Store className="h-3.5 w-3.5" />
            Retailer Partner Portal
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
            Sign In to Your Shop
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage your catalogue, incoming orders, and daily inventory
          </p>
        </div>

        <div className="mb-5 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-xs">
          {isDemo ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-warning">Demo Mode Active</span>
                <button
                  type="button"
                  onClick={handleFillDemo}
                  className="text-[0.7rem] font-medium text-warning underline hover:text-warning/80"
                >
                  Reset Demo Info
                </button>
              </div>
              <p className="mt-1 text-muted-foreground">Local demo authentication is active.</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[0.7rem] text-foreground">
                <dt className="text-muted-foreground">Email</dt>
                <dd>{DEMO_RETAILER_CREDENTIALS.email}</dd>
                <dt className="text-muted-foreground">Password</dt>
                <dd>{DEMO_RETAILER_CREDENTIALS.password}</dd>
              </dl>
            </>
          ) : (
            <>
              <span className="font-semibold text-soft-violet">Retailer accounts</span>
              <p className="mt-1 text-muted-foreground">
                Sign in with the email your SHOPRi8 admin registered. Retailer access is granted per
                account.
              </p>
            </>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-md shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="retailer-email"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Retailer Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="retailer-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="retailer@shop.com"
                  className="w-full rounded-xl border border-input bg-background/50 pl-10 pr-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="retailer-password"
                className="mb-1.5 block text-xs font-medium text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="retailer-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-input bg-background/50 pl-10 pr-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="press mt-2 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign In to Dashboard"}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/auth?step=roles"
            className="text-xs font-medium text-soft-violet hover:underline"
          >
            ← Change role
          </a>
        </div>
      </div>
    </div>
  );
}
