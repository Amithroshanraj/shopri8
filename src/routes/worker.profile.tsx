import { createFileRoute } from "@tanstack/react-router";
import { Bike, Check, Footprints, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useWorkerAuth, type DeliveryMode } from "@/lib/workerAuth";

export const Route = createFileRoute("/worker/profile")({
  head: () => ({ meta: [{ title: "Delivery Worker Profile — SHOPRi8" }] }),
  component: WorkerProfile,
});

const MODES: { name: DeliveryMode; icon: typeof Bike }[] = [
  { name: "Walking", icon: Footprints },
  { name: "Bicycle", icon: Bike },
  { name: "Two-Wheeler", icon: Bike },
];

function WorkerProfile() {
  const { user, updateProfile } = useWorkerAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.displayName ?? "");
  const [phone, setPhone] = useState(user?.phoneNumber ?? "");
  const [modes, setModes] = useState<DeliveryMode[]>(user?.deliveryModes ?? []);

  useEffect(() => {
    setName(user?.displayName ?? "");
    setPhone(user?.phoneNumber ?? "");
    setModes(user?.deliveryModes ?? []);
  }, [user]);

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      updateProfile({ displayName: name, phoneNumber: phone, deliveryModes: modes });
      setEditing(false);
      toast.success("Profile saved on this device");
    } catch (error) {
      toast.error("Could not save profile", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const toggleMode = (mode: DeliveryMode) => {
    setModes((current) =>
      current.includes(mode) ? current.filter((item) => item !== mode) : [...current, mode],
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase text-soft-violet">Account</p>
        <h1 className="mt-1 font-display text-2xl font-bold">Worker Profile</h1>
      </header>

      <section className="rounded-2xl border border-border/70 bg-card/55 p-5 shadow-sm backdrop-blur-sm sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-soft-violet">
            <UserRound className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-semibold">{user?.displayName}</h2>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="press rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
            >
              Edit Profile
            </button>
          )}
        </div>
        <dl className="mt-5 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
              Worker ID
            </dt>
            <dd className="mt-1 font-mono text-sm">{user?.workerId}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] font-semibold uppercase text-muted-foreground">Phone</dt>
            <dd className="mt-1 text-sm">{user?.phoneNumber || "Not provided"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/55 p-5 shadow-sm backdrop-blur-sm sm:p-6">
        <h2 className="font-display text-base font-semibold">Delivery Capability</h2>
        <p className="mt-1 text-xs text-muted-foreground">Ways you can fulfill local deliveries.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {MODES.map(({ name: mode, icon: Icon }) => {
            const enabled = modes.includes(mode);
            return (
              <button
                key={mode}
                type="button"
                disabled={!editing}
                aria-pressed={enabled}
                onClick={() => toggleMode(mode)}
                className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left text-xs font-medium ${enabled ? "border-primary/40 bg-primary/10 text-foreground" : "border-border bg-background/40 text-muted-foreground"} disabled:cursor-default`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-soft-violet" />
                  {mode}
                </span>
                {enabled && <Check className="h-4 w-4 text-success" />}
              </button>
            );
          })}
        </div>
      </section>

      {editing && (
        <form
          onSubmit={save}
          className="space-y-4 rounded-2xl border border-border/70 bg-card/55 p-5 shadow-sm sm:p-6"
        >
          <div>
            <label htmlFor="worker-name" className="mb-1.5 block text-xs font-medium">
              Display Name
            </label>
            <input
              id="worker-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="w-full rounded-xl border border-input bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="worker-phone" className="mb-1.5 block text-xs font-medium">
              Phone
            </label>
            <input
              id="worker-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-xl border border-input bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="press flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="press flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Save Profile
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
