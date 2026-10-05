import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import {
  useAllRetailerApplications,
  retailerApplicationQueryKeys,
} from "@/hooks/useRetailerApplications";
import { firebaseIsActive } from "@/lib/auth";
import { useAdminAuth } from "@/lib/adminAuth";
import { retailerApplicationRepository } from "@/lib/repositories";

const panelClass = "rounded-2xl border border-border/80 bg-card/45 shadow-sm backdrop-blur-xl";
const fieldClass =
  "mt-1.5 h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/60";

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "APPROVED"
      ? "border-success/25 bg-success/10 text-success"
      : status === "REJECTED"
        ? "border-destructive/25 bg-destructive/10 text-destructive"
        : "border-warning/25 bg-warning/10 text-warning";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold ${tone}`}
    >
      {status}
    </span>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm">{children}</p>
    </div>
  );
}

export function AdminRetailerApplicationsPage() {
  const { user } = useAdminAuth();
  const client = useQueryClient();
  const applicationsQuery = useAllRetailerApplications();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);

  const review = async (applicantUid: string, decision: "approve" | "reject") => {
    if (!user) return;
    setSavingUid(applicantUid);
    try {
      if (decision === "approve") {
        const result = await retailerApplicationRepository.approve(applicantUid, user.id);
        if (!result.ok) throw new Error(result.message);
        toast.success("Retailer application approved", {
          description: "Retailer access and the shop were created for the applicant’s account.",
        });
      } else {
        const result = await retailerApplicationRepository.reject(
          applicantUid,
          user.id,
          reasons[applicantUid] ?? "",
        );
        if (!result.ok) throw new Error(result.message);
        toast.success("Application rejected", {
          description: "The applicant can update their details and submit again.",
        });
      }
      await client.invalidateQueries({ queryKey: retailerApplicationQueryKeys.all });
      await client.invalidateQueries({
        queryKey: retailerApplicationQueryKeys.mine(applicantUid),
      });
    } catch (cause) {
      toast.error(`Could not ${decision} application`, {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setSavingUid(null);
    }
  };

  const applications = applicationsQuery.data ?? [];
  const pendingCount = applications.filter(
    (application) => application.status === "PENDING",
  ).length;

  return (
    <div className="space-y-5">
      <header>
        <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-soft-violet">
          SHOPRi8 / Admin
        </p>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Retailer applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review shop details before enabling retailer access.
        </p>
      </header>
      {!firebaseIsActive() ? (
        <p className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-muted-foreground">
          Retailer applications are available in Firebase mode. Demo mode does not grant portal
          capabilities.
        </p>
      ) : applicationsQuery.isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Loading retailer applications…
        </p>
      ) : applicationsQuery.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          Could not load retailer applications: {applicationsQuery.error.message}
        </p>
      ) : !applications.length ? (
        <div className={`${panelClass} px-5 py-12 text-center`}>
          <p className="text-sm font-medium">No retailer applications have been submitted.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {pendingCount} pending · {applications.length} total
          </p>
          <div className="space-y-4">
            {applications.map((application) => (
              <article key={application.id} className={`${panelClass} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Applicant</p>
                    <h2 className="font-display text-lg font-semibold">
                      {application.applicantName}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {application.applicantEmail} · {application.applicantPhone}
                    </p>
                  </div>
                  <StatusBadge status={application.status} />
                </div>
                <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
                  <Detail label="Shop">{application.shopName}</Detail>
                  <Detail label="Shop type">{application.category.replaceAll("-", " ")}</Detail>
                  <Detail label="Shop phone">{application.shopPhone}</Detail>
                  <Detail label="Address">
                    {application.address}, {application.city}, {application.state}{" "}
                    {application.postalCode}
                  </Detail>
                  <Detail label="Opening hours">
                    {application.openingTime}–{application.closingTime}
                  </Detail>
                  <Detail label="Customer UID">{application.applicantUid}</Detail>
                  <div className="sm:col-span-2">
                    <Detail label="Description">{application.description}</Detail>
                  </div>
                  {application.rejectionReason ? (
                    <div className="sm:col-span-2">
                      <Detail label="Rejection reason">{application.rejectionReason}</Detail>
                    </div>
                  ) : null}
                  {application.shopId ? (
                    <Detail label="Created shop ID">{application.shopId}</Detail>
                  ) : null}
                </div>
                {application.status === "PENDING" ? (
                  <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                    <label className="block text-xs font-medium text-foreground">
                      Rejection reason (required to reject)
                      <textarea
                        value={reasons[application.applicantUid] ?? ""}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [application.applicantUid]: event.target.value,
                          }))
                        }
                        className={`${fieldClass} h-20 py-2`}
                        placeholder="Explain what information needs to be corrected."
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={savingUid !== null}
                        onClick={() => void review(application.applicantUid, "approve")}
                        className="press inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {savingUid === application.applicantUid ? "Saving…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={
                          savingUid !== null ||
                          (reasons[application.applicantUid] ?? "").trim().length < 5
                        }
                        onClick={() => void review(application.applicantUid, "reject")}
                        className="press rounded-xl border border-destructive/30 px-4 py-2.5 text-sm font-semibold text-destructive disabled:opacity-50"
                      >
                        Reject with reason
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
