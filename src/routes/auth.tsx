import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  AtSign,
  Bike,
  ChevronRight,
  LockKeyhole,
  Phone,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { InputOTP, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/useAuth";

/**
 * The invisible reCAPTCHA widget for phone sign-in mounts into this element.
 *
 * It must exist in the DOM when `signInWithPhoneNumber` runs, and it must not be
 * `display: none` or `hidden`, so it is kept in the layout at effectively zero
 * size. `RecaptchaVerifier` is never constructed during server rendering — the
 * sign-in calls live behind `provider === "firebase"` and only run on submit.
 */
const RECAPTCHA_CONTAINER_ID = "customer-recaptcha";

type AuthStep =
  "welcome" | "roles" | "customer-method" | "customer-phone" | "customer-otp" | "customer-email";
type CustomerMethod = "phone" | "email";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) =>
    search["step"] === "roles" ? { step: "roles" as const } : {},
  head: () => ({
    meta: [
      { title: "Sign in — SHOPRi8" },
      { name: "description", content: "Sign in to SHOPRi8 with your mobile number or email." },
      { property: "og:title", content: "Sign in — SHOPRi8" },
      { property: "og:description", content: "Sign in with your mobile number or email." },
    ],
  }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const { step: stepParam } = Route.useSearch();
  const {
    cancelPhoneCode,
    confirmPhoneCode,
    accountStatus,
    logout,
    provider,
    registerWithPassword,
    requestPhoneCode,
    signInWithPassword,
    startDemoSession,
  } = useAuth();
  const isFirebase = provider === "firebase";
  const [step, setStep] = useState<AuthStep>(stepParam === "roles" ? "roles" : "welcome");
  const [method, setMethod] = useState<CustomerMethod>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (stepParam === "roles") setStep("roles");
  }, [stepParam]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Sends the sign-in code.
   *
   * Firebase mode runs the real flow — `RecaptchaVerifier` ->
   * `signInWithPhoneNumber` -> an SMS code the user types next. Demo mode keeps
   * the local-only `123456` shortcut, which is unreachable under Firebase because
   * `startDemoSession` refuses there.
   */
  const sendCode = () =>
    run(async () => {
      if (!/^[6-9]\d{9}$/.test(phone)) throw new Error("Enter a valid 10-digit mobile number.");
      if (isFirebase) {
        await requestPhoneCode(phone, RECAPTCHA_CONTAINER_ID);
        setOtp("");
        setStep("customer-otp");
        setMessage(`We sent a 6-digit code to +91 ${phone}.`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      setOtp("");
      setStep("customer-otp");
      setMessage("Demo code: 123456. No SMS is sent in this local authentication flow.");
    });

  const verifyCode = () =>
    run(async () => {
      if (isFirebase) {
        await confirmPhoneCode(otp);
        return;
      }
      if (otp !== "123456")
        throw new Error("That demo code is not valid. Check the code and retry.");
      startDemoSession({
        userId: `demo-customer-${phone}`,
        role: "customer",
        displayName: `Customer ${phone.slice(-4)}`,
        phone: `+91${phone}`,
      });
    });

  const submitEmail = () =>
    run(async () => {
      const trimmedEmail = email.trim();
      if (!trimmedEmail.includes("@")) throw new Error("Enter a valid email address.");
      if (password.length < 6) throw new Error("Your password needs at least 6 characters.");
      if (registering) {
        await registerWithPassword(trimmedEmail, password, {
          capability: "customer",
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        });
        return;
      }
      await signInWithPassword(trimmedEmail, password);
    });

  const input =
    "w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-ring";

  const chooseMethod = (next: CustomerMethod) => {
    setError(null);
    setMessage(null);
    setMethod(next);
    setStep(next === "phone" ? "customer-phone" : "customer-email");
  };

  const selectRole = (role: "customer" | "retailer" | "deliveryWorker" | "admin") => {
    if (role === "customer") {
      chooseMethod(method);
    } else if (role === "retailer") {
      navigate({ to: "/retailer/login" });
    } else if (role === "deliveryWorker") {
      navigate({ to: "/worker/login" });
    } else {
      navigate({ to: "/admin/login" });
    }
  };

  const leavePhoneFlow = () => {
    cancelPhoneCode();
    setOtp("");
    setError(null);
    setMessage(null);
  };

  const roles = [
    {
      role: "customer" as const,
      name: "Customer",
      description: "Shop nearby products and order from local shops.",
      icon: UserRound,
    },
    {
      role: "retailer" as const,
      name: "Retailer",
      description: "Manage your shop, products, inventory and orders.",
      icon: Store,
    },
    {
      role: "deliveryWorker" as const,
      name: "Delivery Worker",
      description: "Manage local pickup and delivery tasks.",
      icon: Bike,
    },
    {
      role: "admin" as const,
      name: "Admin",
      description: "Manage SHOPRi8 platform operations.",
      icon: ShieldCheck,
    },
  ];

  const methodButton = (value: CustomerMethod, label: string, Icon: typeof Phone) => (
    <button
      key={value}
      type="button"
      onClick={() => chooseMethod(value)}
      className={`press flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
        method === value
          ? "border-primary bg-primary text-primary-foreground shadow-md"
          : "border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <main className="app-ambience flex min-h-screen items-center justify-center px-4 py-8 sm:py-12">
      <section className="w-full max-w-md rounded-3xl glass-2 p-6 shadow-2xl sm:p-8">
        <div className="mb-7 flex justify-center">
          <Wordmark showTagline className="items-center" />
        </div>
        {accountStatus === "suspended" ? (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"
          >
            <p className="font-semibold text-destructive">This account is suspended.</p>
            <p className="mt-1 text-muted-foreground">
              Contact SHOPRi8 support for assistance, or sign out of this account.
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-3 text-xs font-semibold text-soft-violet hover:underline"
            >
              Sign out
            </button>
          </div>
        ) : null}
        {/* reCAPTCHA mount point for the phone flow. Present but zero-sized. */}
        <div
          id={RECAPTCHA_CONTAINER_ID}
          aria-hidden="true"
          className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
        />
        {step === "welcome" ? (
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Welcome to SHOPRi8</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Discover local shops and get what you need, right from your neighborhood.
            </p>
            <button
              type="button"
              onClick={() => chooseMethod("phone")}
              className="press mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
            >
              <Phone className="h-4 w-4" /> Continue with Phone
            </button>
            <button
              type="button"
              onClick={() => chooseMethod("email")}
              className="press mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/40 py-3.5 text-sm font-semibold hover:border-primary/50"
            >
              <AtSign className="h-4 w-4" /> Continue with Email
            </button>
            <p className="mt-5 text-xs text-muted-foreground">
              Retailer, delivery partner or admin?{" "}
              <button
                type="button"
                onClick={() => navigate({ to: "/auth", search: { step: "roles" }, replace: true })}
                className="font-semibold text-soft-violet hover:underline"
              >
                Sign in here
              </button>
            </p>
          </div>
        ) : step === "roles" ? (
          <div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep("welcome");
                navigate({ to: "/auth", search: {}, replace: true });
              }}
              className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <h1 className="font-display text-xl font-semibold">Choose your role</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose how you want to use SHOPRi8.
            </p>
            <div className="mt-5 space-y-2.5">
              {roles.map(({ role, name, description, icon: Icon }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => selectRole(role)}
                  className="group press flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-background/30 p-3.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-soft-violet group-hover:bg-primary/25">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{name}</span>
                    <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                      {description}
                    </span>
                    <span className="mt-1 block text-[0.65rem] font-semibold text-soft-violet">
                      Continue as {name}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-soft-violet" />
                </button>
              ))}
            </div>
          </div>
        ) : step === "customer-method" ? (
          <div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMessage(null);
                setStep("welcome");
              }}
              className="mb-5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <h1 className="font-display text-xl font-semibold">How should we sign you in?</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Both options reach the same account. Add the other later from your profile.
            </p>
            <div className="mt-5 flex gap-2.5">
              {methodButton("phone", "Phone + OTP", Phone)}
              {methodButton("email", "Email", AtSign)}
            </div>
          </div>
        ) : step === "customer-phone" ? (
          <div>
            <button
              type="button"
              onClick={() => {
                leavePhoneFlow();
                setStep(method === "phone" ? "customer-method" : "welcome");
              }}
              className="mb-5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <h1 className="font-display text-xl font-semibold">Continue with your phone</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter your mobile number to continue.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendCode();
              }}
              className="mt-5 space-y-3"
            >
              <label htmlFor="customer-phone" className="text-xs text-muted-foreground">
                Mobile number
              </label>
              <div className="flex items-center gap-2">
                <span className="rounded-xl glass-1 px-3 py-3 text-sm">+91</span>
                <input
                  id="customer-phone"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit number"
                  className={input}
                />
              </div>
              {error ? (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              ) : null}
              <button
                disabled={busy || phone.length !== 10}
                className="press w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Sending code..." : "Send Code"}
              </button>
            </form>
            <p className="mt-4 text-center text-[0.68rem] text-muted-foreground">
              {isFirebase
                ? "We'll text you a one-time code to confirm it's you."
                : "Local development sign-in. No SMS is sent."}
            </p>
            <button
              type="button"
              onClick={() => chooseMethod("email")}
              className="mt-3 block w-full text-center text-[0.68rem] font-medium text-soft-violet hover:underline"
            >
              Use email instead
            </button>
          </div>
        ) : step === "customer-otp" ? (
          <div>
            <button
              type="button"
              onClick={() => {
                leavePhoneFlow();
                setStep("customer-phone");
              }}
              className="mb-5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Change phone number
            </button>
            <h1 className="font-display text-xl font-semibold">Verify your number</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter the 6-digit code for +91 {phone}.
            </p>
            {message ? (
              <p className="mt-4 rounded-xl bg-primary/10 px-3 py-2 text-center text-xs text-soft-violet">
                {message}
              </p>
            ) : null}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void verifyCode();
              }}
              className="mt-5 space-y-3"
            >
              <label htmlFor="customer-otp" className="text-xs text-muted-foreground">
                One-time code
              </label>
              <InputOTP
                id="customer-otp"
                maxLength={6}
                value={otp}
                onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                containerClassName="w-full justify-between gap-1.5"
                className="w-full"
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="h-12 w-full rounded-xl border border-input bg-background/40 text-base font-semibold first:rounded-l-xl last:rounded-r-xl"
                  />
                ))}
              </InputOTP>
              {error ? (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              ) : null}
              <button
                disabled={busy || otp.length !== 6}
                className="press w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Verifying..." : "Verify Code"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendCode()}
                className="w-full py-2 text-xs font-medium text-soft-violet disabled:opacity-50"
              >
                Resend code
              </button>
            </form>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMessage(null);
                setStep(method === "email" ? "customer-method" : "welcome");
              }}
              className="mb-5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <h1 className="font-display text-xl font-semibold">
              {registering ? "Create your account" : "Continue with email"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {registering
                ? "Your account starts as a customer. Shop and delivery roles are added by an admin."
                : "Sign in with the email linked to your account."}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitEmail();
              }}
              className="mt-5 space-y-3"
            >
              {registering ? (
                <>
                  <label htmlFor="customer-name" className="block text-xs text-muted-foreground">
                    Your name
                  </label>
                  <input
                    id="customer-name"
                    autoComplete="name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Optional"
                    className={input}
                  />
                </>
              ) : null}
              <label htmlFor="customer-email" className="block text-xs text-muted-foreground">
                Email address
              </label>
              <input
                id="customer-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={input}
              />
              <label htmlFor="customer-password" className="block text-xs text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="customer-password"
                  type="password"
                  autoComplete={registering ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  className={`${input} pl-10`}
                />
              </div>
              {error ? (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              ) : null}
              <button
                disabled={busy || !email || password.length < 6}
                className="press w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy
                  ? registering
                    ? "Creating account..."
                    : "Signing in..."
                  : registering
                    ? "Create Account"
                    : "Sign In"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setRegistering((value) => !value);
              }}
              className="mt-4 block w-full text-center text-xs font-medium text-soft-violet hover:underline"
            >
              {registering
                ? "Already have an account? Sign in"
                : "New to SHOPRi8? Create an account"}
            </button>
            <button
              type="button"
              onClick={() => chooseMethod("phone")}
              className="mt-2 block w-full text-center text-[0.68rem] font-medium text-muted-foreground hover:underline"
            >
              Use phone instead
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
