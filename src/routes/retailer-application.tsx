import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Store } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CATEGORIES } from "@/data/demo";
import { useAuth } from "@/hooks/useAuth";
import {
  retailerApplicationQueryKeys,
  useMyRetailerApplication,
} from "@/hooks/useRetailerApplications";
import { isFirebaseActive } from "@/lib/firebase";
import { retailerApplicationRepository } from "@/lib/repositories";
import type { CategoryId, RetailerApplicationInput } from "@/lib/types";

export const Route = createFileRoute("/retailer-application")({
  head: () => ({
    meta: [
      { title: "Become a Retailer — SHOPRi8" },
      { name: "description", content: "Apply to become a SHOPRi8 retailer." },
    ],
  }),
  component: RetailerApplicationPage,
});

const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
const labelClass = "block text-xs font-medium text-foreground";

const emptyApplication = (): RetailerApplicationInput => ({
  applicantName: "",
  applicantEmail: "",
  applicantPhone: "",
  shopName: "",
  category: "grocery",
  description: "",
  shopPhone: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  openingTime: "09:00",
  closingTime: "21:00",
});

function RetailerApplicationPage() {
  const { user, provider, loading } = useAuth();
  const client = useQueryClient();
  const applicationQuery = useMyRetailerApplication(user?.uid);
  const [form, setForm] = useState<RetailerApplicationInput>(emptyApplication);
  const [submitting, setSubmitting] = useState(false);
  const [hasLoadedSavedApplication, setHasLoadedSavedApplication] = useState(false);
  const [hasPrefilledAccount, setHasPrefilledAccount] = useState(false);
  const application = applicationQuery.data;
  const firebaseMode = isFirebaseActive && provider === "firebase";

  useEffect(() => {
    if (!user || application || hasPrefilledAccount) return;
    setForm((current) => ({
      ...current,
      applicantName: user.displayName || "",
      applicantEmail: user.email || "",
      applicantPhone: user.phoneNumber || "",
    }));
    setHasPrefilledAccount(true);
  }, [application, hasPrefilledAccount, user]);

  useEffect(() => {
    if (!application || hasLoadedSavedApplication) return;
    setForm({
      applicantName: application.applicantName,
      applicantEmail: application.applicantEmail,
      applicantPhone: application.applicantPhone,
      shopName: application.shopName,
      category: application.category,
      description: application.description,
      shopPhone: application.shopPhone,
      address: application.address,
      city: application.city,
      state: application.state,
      postalCode: application.postalCode,
      openingTime: application.openingTime,
      closingTime: application.closingTime,
    });
    setHasLoadedSavedApplication(true);
  }, [application, hasLoadedSavedApplication]);

  const update = <K extends keyof RetailerApplicationInput>(
    key: K,
    value: RetailerApplicationInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      toast.error("Sign in with your customer account before applying.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await retailerApplicationRepository.submit(user.uid, form);
      if (!result.ok) throw new Error(result.message);
      await client.invalidateQueries({
        queryKey: retailerApplicationQueryKeys.mine(user.uid),
      });
      toast.success("Application submitted", {
        description: "We’ll notify you after an administrator reviews your shop.",
      });
    } catch (cause) {
      toast.error("Could not submit application", {
        description:
          cause instanceof Error ? cause.message : "Please check the information and retry.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const setField =
    (key: keyof RetailerApplicationInput) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      update(key, event.target.value as RetailerApplicationInput[typeof key]);

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading your account…</p>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-background px-4 py-6 pb-12">
      <Link
        to="/profile"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-soft-violet"
      >
        <ArrowLeft className="h-4 w-4" /> Profile
      </Link>
      <header className="mb-6">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-soft-violet">
          <Store className="h-5 w-5" />
        </span>
        <h1 className="font-display text-2xl font-bold">Become a Retailer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit your details for review. Your current customer account stays the same.
        </p>
      </header>

      {applicationQuery.isError ? (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          Could not load your application: {applicationQuery.error.message}
        </p>
      ) : null}
      {applicationQuery.sessionRefreshError ? (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          Your application is approved, but account access could not be refreshed:{" "}
          {applicationQuery.sessionRefreshError}
        </p>
      ) : null}

      {!user ? (
        <section className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-semibold">Sign in with your customer account to apply.</p>
          <Link to="/auth" className="mt-3 inline-block font-semibold text-soft-violet underline">
            Sign in
          </Link>
        </section>
      ) : !firebaseMode ? (
        <section className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-semibold">Retailer applications need Firebase mode.</p>
          <p className="mt-1 text-muted-foreground">
            Demo authentication does not create applications or grant portal capabilities. Switch to
            the Firebase backend to submit a secure application.
          </p>
        </section>
      ) : (
        <>
          {application?.status === "APPROVED" ? (
            <section className="mb-5 rounded-2xl border border-success/30 bg-success/10 p-4">
              <p className="font-semibold text-success">Your application is approved.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Retailer access is enabled for this same account. Sign in to open your retailer
                portal.
              </p>
              <Link
                to="/retailer/login"
                className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Open retailer portal
              </Link>
            </section>
          ) : null}
          {application?.status === "PENDING" ? (
            <section className="mb-5 rounded-2xl border border-warning/30 bg-warning/10 p-4">
              <p className="font-semibold text-warning">Application under review</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your application was received. You can’t access the retailer portal until it is
                approved.
              </p>
            </section>
          ) : null}
          {application?.status === "REJECTED" ? (
            <section className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
              <p className="font-semibold text-destructive">Application needs changes</p>
              <p className="mt-1 text-sm text-muted-foreground">{application.rejectionReason}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Update the details below and resubmit for review.
              </p>
            </section>
          ) : null}

          {application?.status !== "APPROVED" ? (
            <form
              onSubmit={handleSubmit}
              className="space-y-5 rounded-3xl border border-border bg-card/60 p-5 shadow-xl sm:p-6"
            >
              <section className="space-y-4">
                <h2 className="font-display text-base font-semibold">Applicant information</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Applicant name
                    <input
                      className={fieldClass}
                      value={form.applicantName}
                      onChange={setField("applicantName")}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Email
                    <input
                      className={fieldClass}
                      type="email"
                      value={form.applicantEmail}
                      onChange={setField("applicantEmail")}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Phone
                    <input
                      className={fieldClass}
                      type="tel"
                      value={form.applicantPhone}
                      onChange={setField("applicantPhone")}
                      required
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-4 border-t border-border/60 pt-5">
                <h2 className="font-display text-base font-semibold">Shop information</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Shop name
                    <input
                      className={fieldClass}
                      value={form.shopName}
                      onChange={setField("shopName")}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Shop type
                    <select
                      className={fieldClass}
                      value={form.category}
                      onChange={(event) => update("category", event.target.value as CategoryId)}
                      required
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={`${labelClass} sm:col-span-2`}>
                    Shop description
                    <textarea
                      className={`${fieldClass} h-24 py-3`}
                      value={form.description}
                      onChange={setField("description")}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Shop phone
                    <input
                      className={fieldClass}
                      type="tel"
                      value={form.shopPhone}
                      onChange={setField("shopPhone")}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Street address
                    <input
                      className={fieldClass}
                      value={form.address}
                      onChange={setField("address")}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    City
                    <input
                      className={fieldClass}
                      value={form.city}
                      onChange={setField("city")}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    State
                    <input
                      className={fieldClass}
                      value={form.state}
                      onChange={setField("state")}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Postal code
                    <input
                      className={fieldClass}
                      inputMode="numeric"
                      value={form.postalCode}
                      onChange={setField("postalCode")}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Opens at
                    <input
                      className={fieldClass}
                      type="time"
                      value={form.openingTime}
                      onChange={setField("openingTime")}
                      required
                    />
                  </label>
                  <label className={labelClass}>
                    Closes at
                    <input
                      className={fieldClass}
                      type="time"
                      value={form.closingTime}
                      onChange={setField("closingTime")}
                      required
                    />
                  </label>
                </div>
              </section>

              <button
                type="submit"
                disabled={
                  submitting || application?.status === "PENDING" || applicationQuery.isLoading
                }
                className="press w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {submitting
                  ? "Submitting…"
                  : application?.status === "PENDING"
                    ? "Application submitted"
                    : "Submit for approval"}
              </button>
            </form>
          ) : null}
        </>
      )}
    </main>
  );
}
