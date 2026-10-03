import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LockKeyhole, Mail, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DEMO_WORKER_CREDENTIALS, useWorkerAuth } from "@/lib/workerAuth";

export const Route = createFileRoute("/worker/login")({
  head: () => ({
    meta: [
      { title: "Delivery Worker Sign In — SHOPRi8" },
      { name: "description", content: "Sign in to manage your SHOPRi8 delivery tasks." },
    ],
  }),
  component: WorkerLogin,
});

function WorkerLogin() {
  const navigate = useNavigate();
  const { login } = useWorkerAuth();
  const [email, setEmail] = useState<string>(DEMO_WORKER_CREDENTIALS.email);
  const [password, setPassword] = useState<string>(DEMO_WORKER_CREDENTIALS.password);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login({ email, password });
      toast.success("Welcome to your delivery tasks");
      navigate({ to: "/worker/dashboard", replace: true });
    } catch (error) {
      toast.error("Sign in failed", {
        description: error instanceof Error ? error.message : "Check your credentials and retry.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-ambience flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-soft-violet">
            <Package className="h-7 w-7" />
          </div>
          <p className="font-display text-xl font-bold">SHOPRi8</p>
          <p className="mt-1 text-sm text-muted-foreground">Delivery Worker Portal</p>
          <h1 className="mt-5 font-display text-2xl font-semibold">Sign in to continue</h1>
        </div>

        <div className="rounded-3xl border border-border bg-card/60 p-6 shadow-xl backdrop-blur-xl">
          <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 p-3 text-xs">
            <p className="font-semibold text-soft-violet">Demo account</p>
            <p className="mt-1 text-muted-foreground">
              {DEMO_WORKER_CREDENTIALS.email} · {DEMO_WORKER_CREDENTIALS.password}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="worker-email" className="mb-1.5 block text-xs font-medium">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="worker-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  required
                  className="w-full rounded-xl border border-input bg-background/70 py-3 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label htmlFor="worker-password" className="mb-1.5 block text-xs font-medium">
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="worker-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-input bg-background/70 py-3 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="press w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <Link
          to="/"
          className="mt-5 block text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Back to SHOPRi8
        </Link>
      </div>
    </div>
  );
}
