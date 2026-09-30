import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ConfirmationResult } from "firebase/auth";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Wordmark } from "@/components/brand/Wordmark";
import { confirmPhoneOtp, isFirebaseConfigured, startPhoneSignIn } from "@/lib/firebase/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SHOPRi8" },
      { name: "description", content: "Sign in to SHOPRi8 with your mobile number." },
      { property: "og:title", content: "Sign in — SHOPRi8" },
      { property: "og:description", content: "Sign in with your mobile number." },
    ],
  }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-ring";

  return (
    <AppShell nav={false}>
      <PageHeader title="Sign in" />
      <div className="mx-auto max-w-sm rounded-3xl glass-2 p-6">
        <Wordmark showTagline className="mb-6" />
        {!isFirebaseConfigured ? (
          <p className="mb-4 rounded-xl bg-warning/15 px-3 py-2 text-xs text-warning">
            Sign in is not available yet — the Firebase project still needs to be connected.
          </p>
        ) : null}
        {!confirmation ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                setConfirmation(await startPhoneSignIn(`+91${phone}`, "recaptcha"));
              });
            }}
            className="space-y-3"
          >
            <label className="text-xs text-muted-foreground">Mobile number</label>
            <div className="flex items-center gap-2">
              <span className="rounded-xl glass-1 px-3 py-3 text-sm">+91</span>
              <input
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit number"
                className={input}
              />
            </div>
            <button
              disabled={busy || phone.length !== 10 || !isFirebaseConfigured}
              className="press w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Send OTP
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await confirmPhoneOtp(confirmation, otp);
                navigate({ to: "/profile" });
              });
            }}
            className="space-y-3"
          >
            <label className="text-xs text-muted-foreground">
              Enter the 6-digit code sent to +91 {phone}
            </label>
            <input
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={`${input} tracking-[0.5em]`}
            />
            <button
              disabled={busy || otp.length !== 6}
              className="press w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Verify
            </button>
          </form>
        )}
        {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
        <div id="recaptcha" />
      </div>
    </AppShell>
  );
}
