import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, LogOut, Mail, MapPin, Phone, ShieldCheck, Store, User } from "lucide-react";
import { toast } from "sonner";
import { useRetailerAuth } from "@/lib/retailerAuth";
import { useRetailerStore } from "@/lib/retailerStore";
import { CATEGORY_BY_ID } from "@/data/demo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/retailer/profile")({
  head: () => ({
    meta: [
      { title: "Retailer Profile — SHOPRi8" },
      { name: "description", content: "Retailer merchant profile and shop credentials" },
    ],
  }),
  component: RetailerProfile,
});

function RetailerProfile() {
  const navigate = useNavigate();
  const { user, logout } = useRetailerAuth();
  const { shop } = useRetailerStore();

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out successfully", {
      description: "You have been logged out of the Retailer Portal.",
    });
    navigate({ to: "/retailer/login" });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Retailer Profile
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Merchant account information and registered shop credentials
        </p>
      </div>

      {/* Account Profile Card */}
      <div className="rounded-3xl border border-border/80 bg-card/50 p-6 backdrop-blur-sm shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-soft-violet">
            <User className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-foreground truncate">
                {user?.displayName || user?.name || "Retailer Partner"}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[0.65rem] font-semibold text-soft-violet">
                <ShieldCheck className="h-3 w-3" />
                Verified Retailer
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
          </div>
        </div>

        <div className="divide-y divide-border/40 border-t border-border/50 pt-2 text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-soft-violet" /> Email
            </span>
            <span className="font-medium text-foreground">
              {user?.email || "retailer@shop.com"}
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-soft-violet" /> Phone
            </span>
            <span className="font-medium text-foreground">
              {user?.phoneNumber || user?.phone || "+91 98765 43210"}
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-soft-violet" /> Capability
            </span>
            <span className="rounded bg-muted/60 px-2 py-0.5 text-[0.65rem] font-semibold text-foreground">
              {user?.capabilities?.join(", ") || "retailer"}
            </span>
          </div>
        </div>
      </div>

      {/* Linked Shop Card */}
      {shop && (
        <div className="rounded-3xl border border-border/80 bg-card/50 p-6 backdrop-blur-sm shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-soft-violet">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-foreground truncate">{shop.name}</h3>
              <p className="text-[0.7rem] text-muted-foreground">
                {CATEGORY_BY_ID[shop.category]?.name || shop.category}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold",
                shop.status === "ACTIVE"
                  ? "bg-success/20 text-success"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {shop.status === "ACTIVE" ? "Open" : "Closed"}
            </span>
          </div>

          <div className="divide-y divide-border/40 border-t border-border/50 pt-2 text-xs">
            <div className="py-2.5 flex items-start justify-between gap-3">
              <span className="text-muted-foreground flex items-center gap-2 shrink-0">
                <MapPin className="h-4 w-4 text-soft-violet" /> Address
              </span>
              <span className="font-medium text-foreground text-right">{shop.address}</span>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-soft-violet" /> Operating Hours
              </span>
              <span className="font-medium text-foreground">
                {shop.openingTime} – {shop.closingTime}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sign Out Action */}
      <div className="pt-2">
        <button
          onClick={handleLogout}
          className="press flex w-full items-center justify-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 py-3 text-xs font-semibold text-destructive shadow-sm transition-all hover:bg-destructive/20"
        >
          <LogOut className="h-4 w-4" />
          Sign Out of Retailer Account
        </button>
      </div>

      {/* Meta Footer */}
      <div className="text-center pt-2">
        <p className="text-[0.7rem] text-muted-foreground">
          SHOPRi8 Hyperlocal Commerce Platform · Retailer Portal v1.0
        </p>
      </div>
    </div>
  );
}
