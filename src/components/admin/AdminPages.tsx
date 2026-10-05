import { useEffect, useState, type ReactNode } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Boxes,
  ChevronRight,
  CircleHelp,
  LogOut,
  Package,
  Search,
  Store,
  Settings2,
  Truck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { DEMO_ADMIN_CREDENTIALS, useAdminAuth } from "@/lib/adminAuth";
import { firebaseIsActive } from "@/lib/auth";
import { consumeAuthReturnTo } from "@/lib/auth/returnTo";
import {
  useAdminData,
  type ManagedRole,
  type ManagedUser,
  type ManagedStatus,
} from "@/lib/adminData";
import { DELIVERY_FEE } from "@/lib/cart";
import { formatPrice } from "@/lib/geo";
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  type DeliveryTask,
  type Order,
  type OrderStatus,
  type Product,
  type Shop,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const panelClass = "rounded-2xl border border-border/80 bg-card/45 shadow-sm backdrop-blur-xl";
const fieldClass =
  "h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/60";
const labelClass = "block text-xs font-medium text-foreground";
const buttonClass =
  "press inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent/10";

type Column<Row> = { label: string; render: (row: Row) => ReactNode; className?: string };

function PageHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-soft-violet">
          SHOPRi8 / Admin
        </p>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[0.68rem] font-medium text-soft-violet">
        {firebaseIsActive() ? "Firestore catalogue" : "Local demo data"}
      </span>
    </div>
  );
}

function AdminDataError({ message }: { message: string | null }) {
  return message ? (
    <p
      role="alert"
      className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      Could not load or save catalogue data: {message}
    </p>
  ) : null;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const tone = ["DELIVERED", "ACTIVE", "PAID", "COD_COLLECTED"].includes(normalized)
    ? "border-success/25 bg-success/10 text-success"
    : ["REJECTED", "CANCELLED", "DELIVERY_FAILED", "FAILED", "INACTIVE", "OUT_OF_STOCK"].includes(
          normalized,
        )
      ? "border-destructive/25 bg-destructive/10 text-destructive"
      : ["READY_FOR_PICKUP", "AVAILABLE", "PLACED", "PENDING", "COD_PENDING"].includes(normalized)
        ? "border-warning/25 bg-warning/10 text-warning"
        : "border-primary/25 bg-primary/10 text-soft-violet";
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold",
        tone,
      )}
    >
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className={`${panelClass} px-5 py-12 text-center`}>
      <CircleHelp className="mx-auto h-7 w-7 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">Try changing or clearing your filters.</p>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block min-w-[220px] flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${fieldClass} pl-9`}
      />
    </label>
  );
}

function ResponsiveTable<Row extends { id: string }>({
  rows,
  columns,
  mobileCard,
}: {
  rows: Row[];
  columns: Column<Row>[];
  mobileCard: (row: Row) => ReactNode;
}) {
  if (!rows.length) return <EmptyState message="No results match your filters." />;
  return (
    <>
      <div className={`${panelClass} hidden overflow-x-auto md:block`}>
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 text-[0.68rem] uppercase tracking-wide text-muted-foreground">
              {columns.map((column) => (
                <th key={column.label} className={cn("px-4 py-3 font-semibold", column.className)}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border/50 last:border-0 hover:bg-white/[0.025]"
              >
                {columns.map((column) => (
                  <td
                    key={column.label}
                    className={cn("px-4 py-3.5 align-middle", column.className)}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={row.id}>{mobileCard(row)}</div>
        ))}
      </div>
    </>
  );
}

function ActionLink({
  to,
  params,
  children = "View",
}: {
  to: string;
  params?: Record<string, string>;
  children?: ReactNode;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      className="inline-flex items-center gap-1 text-xs font-semibold text-soft-violet hover:text-accent"
    >
      {children} <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Not recorded"
    : date.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function isShopOpen(shop: Shop) {
  if (!shop.openingTime || !shop.closingTime) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openHour = 0, openMinute = 0] = shop.openingTime.split(":").map(Number);
  const [closeHour = 0, closeMinute = 0] = shop.closingTime.split(":").map(Number);
  const opensAt = openHour * 60 + openMinute;
  const closesAt = closeHour * 60 + closeMinute;
  return closesAt < opensAt
    ? currentMinutes >= opensAt || currentMinutes < closesAt
    : currentMinutes >= opensAt && currentMinutes < closesAt;
}

function shopFor(data: ReturnType<typeof useAdminData>, shopId: string) {
  return data.shops.find((shop) => shop.id === shopId);
}

function customerName(order: Order) {
  return order.deliveryAddress.recipientName || "Customer";
}

export function AdminLoginPage() {
  const { login, isAuthenticated, loading, error } = useAdminAuth();
  const navigate = useNavigate();
  // The demo credentials panel is hidden on the Firebase backend.
  const isDemo = !firebaseIsActive();
  const [email, setEmail] = useState<string>(isDemo ? DEMO_ADMIN_CREDENTIALS.email : "");
  const [password, setPassword] = useState<string>(isDemo ? DEMO_ADMIN_CREDENTIALS.password : "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate({ to: "/admin/dashboard", replace: true });
  }, [isAuthenticated, navigate]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      navigate({ to: consumeAuthReturnTo("admin", "/admin/dashboard") as never, replace: true });
    } catch {
      // The hook exposes the message for the form.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="app-ambience flex min-h-screen items-center justify-center px-4 py-10">
      <section className={`${panelClass} w-full max-w-md p-6 sm:p-8`}>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-soft-violet">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-lg font-bold">SHOPRi8</p>
            <p className="text-xs text-muted-foreground">Administrator access</p>
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold">Admin sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to manage the local demo environment.
        </p>
        <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
          <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={fieldClass}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <button
            disabled={loading || submitting}
            className="press w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading || submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <div className="mt-5 rounded-xl border border-warning/20 bg-warning/5 p-3 text-xs text-muted-foreground">
          {isDemo ? (
            <>
              <p className="font-semibold text-warning">Demo authentication</p>
              <p className="mt-1">
                {DEMO_ADMIN_CREDENTIALS.email} / {DEMO_ADMIN_CREDENTIALS.password}
              </p>
              <p className="mt-2">This client-side demo login is not production-secure.</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-soft-violet">Administrator access</p>
              <p className="mt-1">Only accounts with the admin capability can open this portal.</p>
            </>
          )}
        </div>
        <a
          href="/auth?step=roles"
          className="mt-5 inline-block text-xs font-semibold text-soft-violet"
        >
          ← Change role
        </a>
      </section>
    </main>
  );
}

export function AdminDashboardPage() {
  const data = useAdminData();
  const pending = data.orders.filter((order) =>
    ["PLACED", "RETAILER_REVIEW"].includes(order.orderStatus),
  ).length;
  const preparing = data.orders.filter((order) =>
    ["ACCEPTED", "PREPARING"].includes(order.orderStatus),
  ).length;
  const ready = data.orders.filter((order) => order.orderStatus === "READY_FOR_PICKUP").length;
  const outForDelivery = data.orders.filter(
    (order) => order.orderStatus === "OUT_FOR_DELIVERY",
  ).length;
  const completed = data.orders.filter((order) => order.orderStatus === "DELIVERED").length;
  const activeTasks = data.tasks.filter(
    (task) => !["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(task.status),
  ).length;
  const metrics = [
    { label: "Customers", value: data.customers.length, icon: Users, href: "/admin/users" },
    { label: "Retailers", value: data.retailers.length, icon: Store, href: "/admin/retailers" },
    { label: "Shops", value: data.shops.length, icon: Boxes, href: "/admin/shops" },
    { label: "Products", value: data.products.length, icon: Package, href: "/admin/products" },
    { label: "Orders", value: data.orders.length, icon: Package, href: "/admin/orders" },
    { label: "Active delivery tasks", value: activeTasks, icon: Truck, href: "/admin/delivery" },
  ];
  const operations = [
    { label: "Pending orders", value: pending },
    { label: "Orders preparing", value: preparing },
    { label: "Ready for pickup", value: ready },
    { label: "Out for delivery", value: outForDelivery },
    { label: "Completed", value: completed },
  ];
  const recentOrders = data.orders.slice(0, 6);
  const recentTasks = [...data.tasks]
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 5);
  const shortcuts = [
    ["Manage users", "/admin/users"],
    ["Manage retailers", "/admin/retailers"],
    ["Manage shops", "/admin/shops"],
    ["Manage products", "/admin/products"],
    ["View orders", "/admin/orders"],
    ["Delivery tasks", "/admin/delivery"],
  ];

  return (
    <>
      <PageHeading title="Admin Dashboard" subtitle="Manage and monitor the SHOPRi8 ecosystem." />
      <AdminDataError message={data.error} />
      {data.loading ? (
        <p className="mb-4 text-xs text-muted-foreground">Refreshing platform data...</p>
      ) : null}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            to={href as never}
            className={`${panelClass} p-4 transition-colors hover:border-primary/30`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-soft-violet" />
            </div>
            <p className="mt-3 font-display text-2xl font-bold">{value}</p>
          </Link>
        ))}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className={`${panelClass} p-4 sm:p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Order operations</h2>
              <p className="text-xs text-muted-foreground">Counts from available local orders</p>
            </div>
            <Package className="h-4 w-4 text-soft-violet" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {operations.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-border/60 bg-background/35 p-3"
              >
                <p className="text-[0.65rem] leading-4 text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-lg font-semibold">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={`${panelClass} p-4 sm:p-5`}>
          <h2 className="font-display text-base font-semibold">Quick actions</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {shortcuts.map(([label, href]) => (
              <Link
                key={href}
                to={href as never}
                className="flex min-h-10 items-center justify-between gap-1 rounded-xl border border-border/60 bg-background/35 px-3 py-2 text-xs font-medium hover:border-primary/30"
              >
                {label}
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-soft-violet" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className={`${panelClass} p-4 sm:p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Recent orders</h2>
            <ActionLink to="/admin/orders">All orders</ActionLink>
          </div>
          <ResponsiveTable
            rows={recentOrders}
            columns={[
              {
                label: "Order",
                render: (order) => <span className="font-mono text-xs">{order.id}</span>,
              },
              { label: "Customer", render: customerName },
              { label: "Shop", render: (order) => order.shopName },
              { label: "Amount", render: (order) => formatPrice(order.totalAmount) },
              { label: "Payment", render: (order) => order.paymentMethod },
              { label: "Status", render: (order) => <StatusBadge status={order.orderStatus} /> },
              { label: "Date", render: (order) => formatDate(order.createdAt) },
              {
                label: "",
                render: (order) => (
                  <ActionLink to="/admin/orders/$orderId" params={{ orderId: order.id }} />
                ),
              },
            ]}
            mobileCard={(order) => (
              <div className={`${panelClass} p-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs">{order.id}</p>
                    <p className="mt-1 text-sm font-semibold">
                      {customerName(order)} · {order.shopName}
                    </p>
                  </div>
                  <StatusBadge status={order.orderStatus} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {order.paymentMethod} · {formatDate(order.createdAt)}
                  </span>
                  <strong className="text-foreground">{formatPrice(order.totalAmount)}</strong>
                </div>
                <div className="mt-3">
                  <ActionLink to="/admin/orders/$orderId" params={{ orderId: order.id }} />
                </div>
              </div>
            )}
          />
        </div>
        <div className={`${panelClass} p-4 sm:p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Delivery activity</h2>
            <ActionLink to="/admin/delivery">All tasks</ActionLink>
          </div>
          <ResponsiveTable
            rows={recentTasks}
            columns={[
              {
                label: "Order",
                render: (task) => <span className="font-mono text-xs">{task.orderId}</span>,
              },
              {
                label: "Worker",
                render: (task) =>
                  task.deliveryWorkerId
                    ? (data.workers.find((worker) => worker.id === task.deliveryWorkerId)?.name ??
                      "Worker")
                    : "Unassigned",
              },
              {
                label: "Route",
                render: (task) => `${shopFor(data, task.shopId)?.name ?? "Shop"} → delivery`,
              },
              { label: "Status", render: (task) => <StatusBadge status={task.status} /> },
              {
                label: "",
                render: (task) => (
                  <ActionLink to="/admin/delivery/$taskId" params={{ taskId: task.id }} />
                ),
              },
            ]}
            mobileCard={(task) => <TaskCard task={task} data={data} />}
          />
        </div>
      </section>
    </>
  );
}

function TaskCard({ task, data }: { task: DeliveryTask; data: ReturnType<typeof useAdminData> }) {
  const worker = task.deliveryWorkerId
    ? data.workers.find((item) => item.id === task.deliveryWorkerId)
    : undefined;
  return (
    <div className={`${panelClass} p-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs">{task.orderId}</p>
          <p className="mt-1 text-sm font-semibold">{worker?.name ?? "Unassigned"}</p>
        </div>
        <StatusBadge status={task.status} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {shopFor(data, task.shopId)?.name ?? "Shop"} → {task.deliveryLocation.latitude.toFixed(3)},{" "}
        {task.deliveryLocation.longitude.toFixed(3)}
      </p>
      <div className="mt-3">
        <ActionLink to="/admin/delivery/$taskId" params={{ taskId: task.id }} />
      </div>
    </div>
  );
}

const ROLE_TABS = ["All", "Customer", "Retailer", "Delivery Worker", "Admin"] as const;

export function AdminUsersPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const data = useAdminData();
  const { user: admin } = useAdminAuth();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof ROLE_TABS)[number]>("All");
  const [status, setStatus] = useState("All statuses");
  const rows: ManagedUser[] = [
    ...data.users,
    ...(admin
      ? [
          {
            id: admin.id,
            name: admin.displayName,
            email: admin.email,
            phone: "",
            role: "Admin" as const,
            status: "ACTIVE" as const,
          },
        ]
      : []),
  ];
  const filtered = rows.filter((item) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      !needle || `${item.name} ${item.email} ${item.phone}`.toLowerCase().includes(needle);
    return (
      matchesQuery &&
      (role === "All" || item.role === role) &&
      (status === "All statuses" || item.status === status.toUpperCase())
    );
  });
  const toggle = (item: ManagedUser) => {
    const next = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    data.updateControls({ userStatus: { ...data.controls.userStatus, [item.id]: next } });
  };
  const columns: Column<ManagedUser>[] = [
    { label: "Name", render: (item) => <span className="font-semibold">{item.name}</span> },
    { label: "Email", render: (item) => item.email || "Not provided" },
    { label: "Phone", render: (item) => item.phone || "Not provided" },
    { label: "Role", render: (item) => item.role },
    { label: "Status", render: (item) => <StatusBadge status={item.status} /> },
    { label: "Created", render: (item) => formatDate(item.createdAt) },
    {
      label: "Actions",
      render: (item) => (
        <div className="flex items-center gap-3">
          <ActionLink to="/admin/users/$userId" params={{ userId: item.id }} />
          <button
            onClick={() => toggle(item)}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </button>
        </div>
      ),
    },
  ];
  if (pathname !== "/admin/users") return <Outlet />;
  return (
    <>
      <PageHeading
        title="Users"
        subtitle="Accounts derived from the available local orders and demo roles."
      />
      <div className={`${panelClass} mb-4 p-4`}>
        <div className="flex flex-wrap gap-2">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setRole(tab)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold",
                role === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-background/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, email, phone" />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={`${fieldClass} max-w-[180px]`}
          >
            <option>All statuses</option>
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </select>
        </div>
      </div>
      <ResponsiveTable
        rows={filtered}
        columns={columns}
        mobileCard={(item) => (
          <div className={`${panelClass} p-4`}>
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.email || item.phone || "Contact not recorded"}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span>{item.role}</span>
              <div className="flex gap-3">
                <ActionLink to="/admin/users/$userId" params={{ userId: item.id }} />
                <button
                  onClick={() => toggle(item)}
                  className="font-semibold text-muted-foreground"
                >
                  {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          </div>
        )}
      />
    </>
  );
}

export function AdminRetailersPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const data = useAdminData();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const rows = data.retailers.filter((retailer) => {
    const status = data.controls.retailerStatus[retailer.id] ?? retailer.status;
    return (
      (filter === "All" || status === filter.toUpperCase()) &&
      `${retailer.name} ${retailer.email} ${data.shops.find((shop) => shop.ownerId === retailer.id)?.name ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  });
  const toggle = async (retailer: ManagedUser) => {
    const next: ManagedStatus =
      (data.controls.retailerStatus[retailer.id] ?? retailer.status) === "ACTIVE"
        ? "INACTIVE"
        : "ACTIVE";
    const shop = data.shops.find((item) => item.ownerId === retailer.id);
    try {
      if (shop) await data.updateShop(shop.id, { status: next });
      data.updateControls({
        retailerStatus: { ...data.controls.retailerStatus, [retailer.id]: next },
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update retailer status.");
    }
  };
  const columns: Column<ManagedUser>[] = [
    { label: "Retailer", render: (item) => <span className="font-semibold">{item.name}</span> },
    { label: "Email", render: (item) => item.email || "Not provided" },
    { label: "Phone", render: (item) => item.phone || "Not provided" },
    {
      label: "Shop",
      render: (item) =>
        data.shops.find((shop) => shop.ownerId === item.id)?.name ?? "No shop linked",
    },
    {
      label: "Status",
      render: (item) => (
        <StatusBadge status={data.controls.retailerStatus[item.id] ?? item.status} />
      ),
    },
    { label: "Created", render: (item) => formatDate(item.createdAt) },
    {
      label: "Actions",
      render: (item) => (
        <div className="flex gap-3">
          <ActionLink to="/admin/retailers/$retailerId" params={{ retailerId: item.id }} />
          <button
            onClick={() => toggle(item)}
            className="text-xs font-semibold text-muted-foreground"
          >
            {(data.controls.retailerStatus[item.id] ?? item.status) === "ACTIVE"
              ? "Deactivate"
              : "Activate"}
          </button>
        </div>
      ),
    },
  ];
  if (pathname !== "/admin/retailers") return <Outlet />;
  return (
    <>
      <PageHeading
        title="Retailers"
        subtitle="Retailer records currently represented by local shop ownership data."
      />
      <AdminDataError message={data.error} />
      <div className={`${panelClass} mb-4 flex flex-wrap gap-3 p-4`}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search retailer or shop" />
        <div className="flex gap-2">
          {["All", "Active", "Inactive"].map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold",
                filter === item
                  ? "bg-primary text-primary-foreground"
                  : "bg-background/40 text-muted-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveTable
        rows={rows}
        columns={columns}
        mobileCard={(item) => (
          <div className={`${panelClass} p-4`}>
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.email || "Email not recorded"}
                </p>
              </div>
              <StatusBadge status={data.controls.retailerStatus[item.id] ?? item.status} />
            </div>
            <p className="mt-2 text-xs">
              {data.shops.find((shop) => shop.ownerId === item.id)?.name ?? "No shop linked"}
            </p>
            <div className="mt-3 flex gap-4">
              <ActionLink to="/admin/retailers/$retailerId" params={{ retailerId: item.id }} />
              <button onClick={() => toggle(item)} className="text-xs font-semibold">
                {(data.controls.retailerStatus[item.id] ?? item.status) === "ACTIVE"
                  ? "Deactivate"
                  : "Activate"}
              </button>
            </div>
          </div>
        )}
      />
    </>
  );
}

export function AdminShopsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const data = useAdminData();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All statuses");
  const [openState, setOpenState] = useState("All hours");
  const rows = data.shops.filter((shop) => {
    const currentStatus = data.controls.shopStatus[shop.id] ?? shop.status;
    const retailerName =
      data.retailers.find((retailer) => retailer.id === shop.ownerId)?.name ?? "";
    const currentlyOpen = isShopOpen(shop);
    return (
      `${shop.name} ${retailerName} ${shop.address}`.toLowerCase().includes(query.toLowerCase()) &&
      (category === "All categories" || shop.category === category) &&
      (status === "All statuses" || currentStatus === status.toUpperCase()) &&
      (openState === "All hours" || (openState === "Open now" ? currentlyOpen : !currentlyOpen))
    );
  });
  const toggle = async (shop: Shop) => {
    const next: ManagedStatus =
      (data.controls.shopStatus[shop.id] ?? shop.status) === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await data.updateShop(shop.id, { status: next });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update shop status.");
    }
  };
  const columns: Column<Shop>[] = [
    { label: "Shop", render: (shop) => <span className="font-semibold">{shop.name}</span> },
    { label: "Category", render: (shop) => shop.category.replaceAll("-", " ") },
    { label: "Retailer", render: (shop) => shop.name },
    { label: "Location", render: (shop) => shop.address },
    {
      label: "Hours",
      render: (shop) => `${shop.openingTime ?? "Not set"}–${shop.closingTime ?? "Not set"}`,
    },
    {
      label: "Open now",
      render: (shop) => <StatusBadge status={isShopOpen(shop) ? "OPEN" : "CLOSED"} />,
    },
    {
      label: "Status",
      render: (shop) => <StatusBadge status={data.controls.shopStatus[shop.id] ?? shop.status} />,
    },
    {
      label: "Actions",
      render: (shop) => (
        <div className="flex gap-3">
          <ActionLink to="/admin/shops/$shopId" params={{ shopId: shop.id }} />
          <button
            onClick={() => toggle(shop)}
            className="text-xs font-semibold text-muted-foreground"
          >
            {(data.controls.shopStatus[shop.id] ?? shop.status) === "ACTIVE"
              ? "Deactivate"
              : "Activate"}
          </button>
        </div>
      ),
    },
  ];
  const categories = [...new Set(data.shops.map((shop) => shop.category))];
  if (pathname !== "/admin/shops") return <Outlet />;
  return (
    <>
      <PageHeading
        title="Shops"
        subtitle="Review shops, ownership, opening hours, and availability."
      />
      <AdminDataError message={data.error} />
      <div className={`${panelClass} mb-4 flex flex-wrap gap-3 p-4`}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search shop or address" />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={`${fieldClass} max-w-[220px]`}
        >
          <option>All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("-", " ")}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={`${fieldClass} max-w-[180px]`}
        >
          <option>All statuses</option>
          <option>ACTIVE</option>
          <option>INACTIVE</option>
        </select>
        <select
          value={openState}
          onChange={(event) => setOpenState(event.target.value)}
          className={`${fieldClass} max-w-[180px]`}
        >
          <option>All hours</option>
          <option>Open now</option>
          <option>Closed now</option>
        </select>
      </div>
      <ResponsiveTable
        rows={rows}
        columns={columns}
        mobileCard={(shop) => (
          <div className={`${panelClass} p-4`}>
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-semibold">{shop.name}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {shop.category.replaceAll("-", " ")}
                </p>
              </div>
              <StatusBadge status={data.controls.shopStatus[shop.id] ?? shop.status} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{shop.address}</p>
            <p className="mt-1 text-xs">
              {shop.openingTime ?? "Not set"}–{shop.closingTime ?? "Not set"}
            </p>
            <div className="mt-2">
              <StatusBadge status={isShopOpen(shop) ? "OPEN" : "CLOSED"} />
            </div>
            <div className="mt-3 flex gap-4">
              <ActionLink to="/admin/shops/$shopId" params={{ shopId: shop.id }} />
              <button onClick={() => toggle(shop)} className="text-xs font-semibold">
                {(data.controls.shopStatus[shop.id] ?? shop.status) === "ACTIVE"
                  ? "Deactivate"
                  : "Activate"}
              </button>
            </div>
          </div>
        )}
      />
    </>
  );
}

export function AdminProductsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const data = useAdminData();
  const [query, setQuery] = useState("");
  const [shopId, setShopId] = useState("All shops");
  const [category, setCategory] = useState("All categories");
  const [availability, setAvailability] = useState("All availability");
  const rows = data.products.filter((product) => {
    const available = data.controls.productAvailability[product.id] ?? product.availability;
    const stockState =
      product.stock <= 0 ? "Out of Stock" : product.stock <= 5 ? "Low Stock" : "In Stock";
    return (
      product.name.toLowerCase().includes(query.toLowerCase()) &&
      (shopId === "All shops" || product.shopId === shopId) &&
      (category === "All categories" || product.category === category) &&
      (availability === "All availability" ||
        (availability === "Available"
          ? available
          : availability === "Unavailable"
            ? !available
            : availability === stockState))
    );
  });
  const toggle = async (product: Product) => {
    const next = !(data.controls.productAvailability[product.id] ?? product.availability);
    try {
      await data.updateProduct(product.id, { availability: next });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not update product availability.",
      );
    }
  };
  const categories = [...new Set(data.products.map((product) => product.category))];
  const columns: Column<Product>[] = [
    {
      label: "Product",
      render: (product) => <span className="font-semibold">{product.name}</span>,
    },
    { label: "Shop", render: (product) => shopFor(data, product.shopId)?.name ?? product.shopId },
    { label: "Category", render: (product) => product.category.replaceAll("-", " ") },
    { label: "Price", render: (product) => formatPrice(product.price) },
    { label: "Stock", render: (product) => product.stock },
    {
      label: "Availability",
      render: (product) => (
        <StatusBadge
          status={
            (data.controls.productAvailability[product.id] ?? product.availability)
              ? "ACTIVE"
              : "INACTIVE"
          }
        />
      ),
    },
    {
      label: "Stock state",
      render: (product) =>
        product.stock <= 0 ? "Out of Stock" : product.stock <= 5 ? "Low Stock" : "In Stock",
    },
    {
      label: "Actions",
      render: (product) => (
        <div className="flex gap-3">
          <ActionLink to="/admin/products/$productId" params={{ productId: product.id }} />
          <button
            onClick={() => toggle(product)}
            className="text-xs font-semibold text-muted-foreground"
          >
            {(data.controls.productAvailability[product.id] ?? product.availability)
              ? "Deactivate"
              : "Activate"}
          </button>
        </div>
      ),
    },
  ];
  if (pathname !== "/admin/products") return <Outlet />;
  return (
    <>
      <PageHeading
        title="Products"
        subtitle={
          firebaseIsActive()
            ? "Catalogue and stock overview from Firestore."
            : "Catalogue and stock overview from the shared demo product model."
        }
      />
      <AdminDataError message={data.error} />
      <div className={`${panelClass} mb-4 flex flex-wrap gap-3 p-4`}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search product name" />
        <select
          value={shopId}
          onChange={(event) => setShopId(event.target.value)}
          className={`${fieldClass} max-w-[220px]`}
        >
          <option>All shops</option>
          {data.shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={`${fieldClass} max-w-[220px]`}
        >
          <option>All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("-", " ")}
            </option>
          ))}
        </select>
        <select
          value={availability}
          onChange={(event) => setAvailability(event.target.value)}
          className={`${fieldClass} max-w-[200px]`}
        >
          <option>All availability</option>
          <option>Available</option>
          <option>Unavailable</option>
          <option>In Stock</option>
          <option>Low Stock</option>
          <option>Out of Stock</option>
        </select>
      </div>
      <ResponsiveTable
        rows={rows}
        columns={columns}
        mobileCard={(product) => (
          <div className={`${panelClass} p-4`}>
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-semibold">{product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {shopFor(data, product.shopId)?.name ?? product.shopId}
                </p>
              </div>
              <StatusBadge
                status={
                  (data.controls.productAvailability[product.id] ?? product.availability)
                    ? "ACTIVE"
                    : "INACTIVE"
                }
              />
            </div>
            <div className="mt-3 flex justify-between text-xs">
              <span>
                {formatPrice(product.price)} · Stock {product.stock}
              </span>
              <span className="capitalize">{product.category.replaceAll("-", " ")}</span>
            </div>
            <div className="mt-3 flex gap-4">
              <ActionLink to="/admin/products/$productId" params={{ productId: product.id }} />
              <button onClick={() => toggle(product)} className="text-xs font-semibold">
                {(data.controls.productAvailability[product.id] ?? product.availability)
                  ? "Deactivate"
                  : "Activate"}
              </button>
            </div>
          </div>
        )}
      />
    </>
  );
}
const ORDER_FILTERS = [
  "All",
  ...ORDER_STATUS_FLOW,
  "REJECTED",
  "CANCELLED",
  "DELIVERY_FAILED",
] as const;

export function AdminOrdersPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const data = useAdminData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof ORDER_FILTERS)[number]>("All");
  const rows = data.orders.filter(
    (order) =>
      (filter === "All" || order.orderStatus === filter) &&
      `${order.id} ${customerName(order)} ${order.shopName}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const columns: Column<Order>[] = [
    { label: "Order", render: (order) => <span className="font-mono text-xs">{order.id}</span> },
    { label: "Customer", render: customerName },
    { label: "Shop", render: (order) => order.shopName },
    { label: "Amount", render: (order) => formatPrice(order.totalAmount) },
    { label: "Payment", render: (order) => order.paymentMethod },
    { label: "Payment status", render: (order) => <StatusBadge status={order.paymentStatus} /> },
    { label: "Order status", render: (order) => <StatusBadge status={order.orderStatus} /> },
    { label: "Date", render: (order) => formatDate(order.createdAt) },
    {
      label: "",
      render: (order) => <ActionLink to="/admin/orders/$orderId" params={{ orderId: order.id }} />,
    },
  ];
  if (pathname !== "/admin/orders") return <Outlet />;
  return (
    <>
      <PageHeading
        title="Orders"
        subtitle="Monitor the same local order lifecycle used by customers and retailers."
      />
      <div className={`${panelClass} mb-4 flex flex-wrap gap-3 p-4`}>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search order, customer, or shop"
        />
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as (typeof ORDER_FILTERS)[number])}
          className={`${fieldClass} max-w-[260px]`}
        >
          <option value="All">All statuses</option>
          {ORDER_FILTERS.slice(1).map((item) => (
            <option key={item} value={item}>
              {ORDER_STATUS_LABEL[item as OrderStatus] ?? item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setQuery("");
            setFilter("All");
          }}
          className={buttonClass}
        >
          Clear filters
        </button>
      </div>
      <ResponsiveTable
        rows={rows}
        columns={columns}
        mobileCard={(order) => (
          <div className={`${panelClass} p-4`}>
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-mono text-xs">{order.id}</p>
                <p className="mt-1 text-sm font-semibold">
                  {customerName(order)} · {order.shopName}
                </p>
              </div>
              <StatusBadge status={order.orderStatus} />
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {formatPrice(order.totalAmount)} · {order.paymentMethod}
              </span>
              <span>{order.paymentStatus}</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
            <div className="mt-3">
              <ActionLink to="/admin/orders/$orderId" params={{ orderId: order.id }} />
            </div>
          </div>
        )}
      />
    </>
  );
}

const TASK_FILTERS = [
  "All",
  "AVAILABLE",
  "DELIVERY_ASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "CANCELLED",
] as const;

export function AdminDeliveryPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const data = useAdminData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof TASK_FILTERS)[number]>("All");
  const rows = data.tasks.filter(
    (task) =>
      (filter === "All" || task.status === filter) &&
      `${task.id} ${task.orderId} ${task.deliveryWorkerId ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const columns: Column<DeliveryTask>[] = [
    { label: "Task", render: (task) => <span className="font-mono text-xs">{task.id}</span> },
    { label: "Order", render: (task) => task.orderId },
    {
      label: "Worker",
      render: (task) =>
        task.deliveryWorkerId
          ? (data.workers.find((worker) => worker.id === task.deliveryWorkerId)?.name ??
            task.deliveryWorkerId)
          : "Unassigned",
    },
    { label: "Shop", render: (task) => shopFor(data, task.shopId)?.name ?? task.shopId },
    {
      label: "Route",
      render: (task) =>
        `${task.pickupLocation.latitude.toFixed(3)}, ${task.pickupLocation.longitude.toFixed(3)} → ${task.deliveryLocation.latitude.toFixed(3)}, ${task.deliveryLocation.longitude.toFixed(3)}`,
    },
    { label: "Distance", render: (task) => `${task.distance.toFixed(1)} km` },
    { label: "Fee", render: (task) => formatPrice(task.deliveryFee) },
    { label: "Status", render: (task) => <StatusBadge status={task.status} /> },
    { label: "Created", render: (task) => formatDate(task.createdAt) },
    {
      label: "",
      render: (task) => <ActionLink to="/admin/delivery/$taskId" params={{ taskId: task.id }} />,
    },
  ];
  const workerStats = data.workers.map((worker) => ({
    worker,
    assigned: data.tasks.filter((task) => task.deliveryWorkerId === worker.id),
    completed: data.tasks.filter(
      (task) => task.deliveryWorkerId === worker.id && task.status === "DELIVERED",
    ).length,
  }));
  if (pathname !== "/admin/delivery") return <Outlet />;
  return (
    <>
      <PageHeading
        title="Delivery management"
        subtitle="Inspect available tasks, assignments, and worker activity."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {workerStats.map(({ worker, assigned, completed }) => (
          <div key={worker.id} className={`${panelClass} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{worker.name}</p>
                <p className="text-xs text-muted-foreground">
                  {worker.email || "Email not recorded"} · {worker.phone || "Phone not recorded"}
                </p>
              </div>
              <StatusBadge status={worker.status} />
            </div>
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span>
                {
                  assigned.filter(
                    (task) => !["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(task.status),
                  ).length
                }{" "}
                active tasks
              </span>
              <span>{completed} completed</span>
            </div>
          </div>
        ))}
      </div>
      <div className={`${panelClass} mb-4 flex flex-wrap gap-3 p-4`}>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search task, order, or worker ID"
        />
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as (typeof TASK_FILTERS)[number])}
          className={`${fieldClass} max-w-[250px]`}
        >
          <option value="All">All task statuses</option>
          {TASK_FILTERS.slice(1).map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setQuery("");
            setFilter("All");
          }}
          className={buttonClass}
        >
          Clear filters
        </button>
      </div>
      <ResponsiveTable
        rows={rows}
        columns={columns}
        mobileCard={(task) => <TaskCard task={task} data={data} />}
      />
    </>
  );
}

interface DemoSettings {
  platformName: string;
  deliveryFee: number;
  orderMinimum: number;
  workerRadiusKm: number;
}

const SETTINGS_KEY = "shopri8.admin.settings.v1";
const DEFAULT_SETTINGS: DemoSettings = {
  platformName: "SHOPRi8",
  deliveryFee: DELIVERY_FEE,
  orderMinimum: 0,
  workerRadiusKm: 5,
};

export function AdminSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<DemoSettings>) });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);
  const updateNumber = (key: "deliveryFee" | "orderMinimum" | "workerRadiusKm", value: string) =>
    setSettings((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }));
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaved(true);
    toast.success("Demo settings saved");
  };
  return (
    <>
      <PageHeading
        title="Platform settings"
        subtitle="Local configuration values for review; these values are not currently consumed by checkout or dispatch."
      />
      <form onSubmit={save} className={`${panelClass} max-w-3xl p-5 sm:p-6`}>
        <div className="mb-5">
          <h2 className="font-display text-base font-semibold">Platform settings</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved in this browser only. No production behavior changes.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs text-muted-foreground">
            Platform name
            <input
              value={settings.platformName}
              onChange={(event) =>
                setSettings((current) => ({ ...current, platformName: event.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">
            Default delivery fee (₹)
            <input
              type="number"
              min="0"
              value={settings.deliveryFee}
              onChange={(event) => updateNumber("deliveryFee", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">
            Order minimum (₹)
            <input
              type="number"
              min="0"
              value={settings.orderMinimum}
              onChange={(event) => updateNumber("orderMinimum", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">
            Worker delivery radius (km)
            <input
              type="number"
              min="0"
              step="0.5"
              value={settings.workerRadiusKm}
              onChange={(event) => updateNumber("workerRadiusKm", event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button className="press rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            Save local settings
          </button>
          {saved ? (
            <span className="flex items-center gap-1 text-xs text-success">
              <Check className="h-4 w-4" />
              Saved
            </span>
          ) : null}
        </div>
      </form>
      <div className={`${panelClass} mt-4 max-w-3xl p-4 text-xs text-muted-foreground`}>
        <p className="font-semibold text-foreground">Not active application configuration</p>
        <p className="mt-1">
          These demo values are intentionally informational. Checkout continues to use its existing
          delivery fee, order minimum is not enforced, and worker radius does not filter tasks.
        </p>
      </div>
    </>
  );
}

export function AdminProfilePage() {
  const navigate = useNavigate();
  const { user, updateDisplayName, logout } = useAdminAuth();
  const [name, setName] = useState(user?.displayName ?? "");
  const [saved, setSaved] = useState(false);
  useEffect(() => setName(user?.displayName ?? ""), [user?.displayName]);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      updateDisplayName(name);
      setSaved(true);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update profile");
    }
  };
  return (
    <>
      <PageHeading
        title="Admin profile"
        subtitle="Manage the name shown in this local Admin portal."
      />
      <form onSubmit={submit} className={`${panelClass} max-w-2xl p-5 sm:p-6`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs text-muted-foreground">
            Display name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">
            Email
            <input readOnly value={user?.email ?? ""} className={`${fieldClass} opacity-70`} />
          </label>
        </div>
        <div className="mt-4">
          <StatusBadge status="ADMIN" />
        </div>
        <button className="press mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          Save profile
        </button>
        {saved ? <span className="ml-3 text-xs text-success">Saved locally</span> : null}
      </form>
      <button
        type="button"
        onClick={() => {
          logout();
          window.location.assign("/");
        }}
        className="press mt-4 inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </>
  );
}

export function AdminDetailPage({
  section,
}: {
  section: "users" | "retailers" | "shops" | "products" | "orders" | "delivery";
}) {
  const data = useAdminData();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const id = decodeURIComponent(pathname.split("/").pop() ?? "");

  if (data.loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading record...</p>;
  }
  if (data.error) {
    return (
      <div className={`${panelClass} p-5`}>
        <AdminDataError message={data.error} />
      </div>
    );
  }

  const order = section === "orders" ? data.orders.find((item) => item.id === id) : undefined;
  const task = section === "delivery" ? data.tasks.find((item) => item.id === id) : undefined;
  const shop = section === "shops" ? data.shops.find((item) => item.id === id) : undefined;
  const product = section === "products" ? data.products.find((item) => item.id === id) : undefined;
  const managedUser = section === "users" ? data.users.find((item) => item.id === id) : undefined;
  const retailer =
    section === "retailers" ? data.retailers.find((item) => item.id === id) : undefined;

  if (section === "orders" && !order)
    return <NotFound title="Order not found." back="/admin/orders" />;
  if (section === "delivery" && !task)
    return <NotFound title="Delivery task not found." back="/admin/delivery" />;
  if (section === "shops" && !shop) return <NotFound title="Shop not found." back="/admin/shops" />;
  if (section === "products" && !product)
    return <NotFound title="Product not found." back="/admin/products" />;
  if (section === "users" && !managedUser)
    return <NotFound title="User not found." back="/admin/users" />;
  if (section === "retailers" && !retailer)
    return <NotFound title="Retailer not found." back="/admin/retailers" />;

  if (order) return <OrderDetails order={order} />;
  if (task) return <TaskDetails task={task} data={data} />;
  if (shop) return <ShopDetails shop={shop} data={data} />;
  if (product) return <ProductDetails product={product} data={data} />;
  if (managedUser) return <UserDetails user={managedUser} data={data} />;
  if (retailer) return <RetailerDetails retailer={retailer} data={data} />;
  return <NotFound title="Record not found." back="/admin/dashboard" />;
}

function NotFound({ title, back }: { title: string; back: string }) {
  return (
    <div className={`${panelClass} px-5 py-12 text-center`}>
      <CircleHelp className="mx-auto h-8 w-8 text-muted-foreground" />
      <h1 className="mt-3 font-display text-xl font-semibold">{title}</h1>
      <ActionLink to={back} />
    </div>
  );
}

function DetailHeader({
  title,
  subtitle,
  back,
}: {
  title: string;
  subtitle?: string;
  back: string;
}) {
  return (
    <>
      <ActionLink to={back}>Back</ActionLink>
      <div className="mb-5 mt-3">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
    </>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm">{children || "Not recorded"}</div>
    </div>
  );
}

function OrderDetails({ order }: { order: Order }) {
  const data = useAdminData();
  const shop = shopFor(data, order.shopId);
  const retailer = data.retailers.find((item) => item.id === shop?.ownerId);
  const history = order.statusHistory.length
    ? order.statusHistory
    : [{ status: order.orderStatus, at: order.updatedAt }];
  return (
    <>
      <DetailHeader
        title={order.id}
        subtitle={`Placed ${formatDate(order.createdAt)}`}
        back="/admin/orders"
      />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <section className={`${panelClass} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display font-semibold">Order status</h2>
              <StatusBadge status={order.orderStatus} />
            </div>
            <ol className="space-y-3">
              {history.map((entry, index) => (
                <li key={`${entry.status}-${entry.at}-${index}`} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-soft-violet">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {ORDER_STATUS_LABEL[entry.status] ?? entry.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.at).toLocaleString("en-IN")}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              Admin is monitoring-only here; lifecycle changes remain with the retailer and delivery
              workflow.
            </p>
          </section>
          <section className={`${panelClass} p-5`}>
            <h2 className="mb-4 font-display font-semibold">Items</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-start justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatPrice(item.price)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatPrice(item.quantity * item.price)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-border/60 pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery</span>
                <span>{formatPrice(order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatPrice(order.totalAmount)}</span>
              </div>
            </div>
          </section>
        </div>
        <div className="space-y-4">
          <section className={`${panelClass} grid gap-4 p-5 sm:grid-cols-2`}>
            <h2 className="sm:col-span-2 font-display font-semibold">Customer</h2>
            <DetailField label="Name">{customerName(order)}</DetailField>
            <DetailField label="Phone">{order.deliveryAddress.phone}</DetailField>
            <h2 className="sm:col-span-2 mt-2 border-t border-border/60 pt-4 font-display font-semibold">
              Shop
            </h2>
            <DetailField label="Shop">{order.shopName}</DetailField>
            <DetailField label="Retailer">{retailer?.name}</DetailField>
          </section>
          <section className={`${panelClass} grid gap-4 p-5 sm:grid-cols-2`}>
            <h2 className="sm:col-span-2 font-display font-semibold">Delivery</h2>
            <DetailField label="Recipient">{order.deliveryAddress.recipientName}</DetailField>
            <DetailField label="Phone">{order.deliveryAddress.phone}</DetailField>
            <DetailField label="Address">{order.deliveryAddress.address}</DetailField>
            <DetailField label="House / flat">{order.deliveryAddress.houseNumber}</DetailField>
            <DetailField label="Landmark">{order.deliveryAddress.landmark}</DetailField>
          </section>
          <section className={`${panelClass} grid gap-4 p-5 sm:grid-cols-2`}>
            <h2 className="sm:col-span-2 font-display font-semibold">Payment</h2>
            <DetailField label="Method">{order.paymentMethod}</DetailField>
            <DetailField label="Payment status">
              <StatusBadge status={order.paymentStatus} />
            </DetailField>
            <DetailField label="Amount">{formatPrice(order.totalAmount)}</DetailField>
          </section>
        </div>
      </div>
    </>
  );
}

function TaskDetails({
  task,
  data,
}: {
  task: DeliveryTask;
  data: ReturnType<typeof useAdminData>;
}) {
  const order = data.orders.find((item) => item.id === task.orderId);
  const shop = shopFor(data, task.shopId);
  const worker = task.deliveryWorkerId
    ? data.workers.find((item) => item.id === task.deliveryWorkerId)
    : undefined;
  const timeline =
    order?.statusHistory.filter((entry) =>
      [
        "READY_FOR_PICKUP",
        "DELIVERY_ASSIGNED",
        "PICKED_UP",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "DELIVERY_FAILED",
      ].includes(entry.status),
    ) ?? [];
  return (
    <>
      <DetailHeader title={task.id} subtitle={`Order ${task.orderId}`} back="/admin/delivery" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${panelClass} grid gap-4 p-5 sm:grid-cols-2`}>
          <h2 className="sm:col-span-2 font-display font-semibold">Task details</h2>
          <DetailField label="Status">
            <StatusBadge status={task.status} />
          </DetailField>
          <DetailField label="Worker">{worker?.name ?? "Unassigned"}</DetailField>
          <DetailField label="Shop">{shop?.name}</DetailField>
          <DetailField label="Distance">{task.distance.toFixed(1)} km</DetailField>
          <DetailField label="Delivery fee">{formatPrice(task.deliveryFee)}</DetailField>
          <DetailField label="Created">
            {task.createdAt ? new Date(task.createdAt).toLocaleString("en-IN") : undefined}
          </DetailField>
          <DetailField label="Updated">
            {task.updatedAt ? new Date(task.updatedAt).toLocaleString("en-IN") : undefined}
          </DetailField>
        </section>
        <section className={`${panelClass} grid gap-4 p-5 sm:grid-cols-2`}>
          <h2 className="sm:col-span-2 font-display font-semibold">Locations</h2>
          <DetailField label="Pickup">
            {shop?.address}
            <br />
            {task.pickupLocation.latitude.toFixed(5)}, {task.pickupLocation.longitude.toFixed(5)}
          </DetailField>
          <DetailField label="Delivery">
            {order?.deliveryAddress.address}
            <br />
            {task.deliveryLocation.latitude.toFixed(5)},{" "}
            {task.deliveryLocation.longitude.toFixed(5)}
          </DetailField>
          <DetailField label="Recipient">{order?.deliveryAddress.recipientName}</DetailField>
          <DetailField label="Phone">{order?.deliveryAddress.phone}</DetailField>
        </section>
        <section className={`${panelClass} p-5 lg:col-span-2`}>
          <h2 className="mb-4 font-display font-semibold">Delivery timeline</h2>
          {timeline.length ? (
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {timeline.map((entry, index) => (
                <li
                  key={`${entry.status}-${index}`}
                  className="rounded-xl border border-border/60 bg-background/30 p-3"
                >
                  <p className="text-sm font-medium">
                    {ORDER_STATUS_LABEL[entry.status] ?? entry.status}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(entry.at).toLocaleString("en-IN")}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No delivery milestones recorded.</p>
          )}
          {task.status === "DELIVERY_FAILED" ? (
            <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-xs font-semibold text-destructive">Delivery failed</p>
              <p className="mt-2 text-sm">{task.failureReason || "No failure reason recorded."}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {task.failureNotes || "No additional notes."}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}

function ShopDetails({ shop, data }: { shop: Shop; data: ReturnType<typeof useAdminData> }) {
  const retailer = data.retailers.find((item) => item.id === shop.ownerId);
  const products = data.products.filter((item) => item.shopId === shop.id);
  const orders = data.orders.filter((item) => item.shopId === shop.id);
  const active = data.controls.shopStatus[shop.id] ?? shop.status;
  const toggle = async () => {
    const next: ManagedStatus = active === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await data.updateShop(shop.id, { status: next });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update shop status.");
    }
  };
  return (
    <>
      <DetailHeader
        title={shop.name}
        subtitle={shop.category.replaceAll("-", " ")}
        back="/admin/shops"
      />
      <section className={`${panelClass} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge status={active} />
          <button onClick={toggle} className={buttonClass}>
            {active === "ACTIVE" ? "Deactivate shop" : "Activate shop"}
          </button>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Description">{shop.description}</DetailField>
          <DetailField label="Retailer">{retailer?.name}</DetailField>
          <DetailField label="Address">{shop.address}</DetailField>
          <DetailField label="Coordinates">
            {shop.latitude === undefined || shop.longitude === undefined
              ? "Not provided"
              : `${shop.latitude.toFixed(5)}, ${shop.longitude.toFixed(5)}`}
          </DetailField>
          <DetailField label="Opening time">{shop.openingTime ?? "Not set"}</DetailField>
          <DetailField label="Closing time">{shop.closingTime ?? "Not set"}</DetailField>
        </div>
        <div className="mt-6 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Products</p>
            <p className="mt-1 text-xl font-semibold">{products.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Orders</p>
            <p className="mt-1 text-xl font-semibold">{orders.length}</p>
          </div>
        </div>
      </section>
    </>
  );
}

function ProductDetails({
  product,
  data,
}: {
  product: Product;
  data: ReturnType<typeof useAdminData>;
}) {
  const [price, setPrice] = useState(String(product.price));
  const [stock, setStock] = useState(String(product.stock));
  const available = data.controls.productAvailability[product.id] ?? product.availability;
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await data.updateProduct(product.id, {
        price: Math.max(0, Number(price) || 0),
        stock: Math.max(0, Number(stock) || 0),
      });
      toast.success("Product updated.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update product.");
    }
  };
  const toggle = async () => {
    const next = !available;
    try {
      await data.updateProduct(product.id, { availability: next });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not update product availability.",
      );
    }
  };
  return (
    <>
      <DetailHeader
        title={product.name}
        subtitle={shopFor(data, product.shopId)?.name ?? product.shopId}
        back="/admin/products"
      />
      <form onSubmit={save} className={`${panelClass} max-w-3xl p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <StatusBadge status={available ? "ACTIVE" : "INACTIVE"} />
          <button type="button" onClick={toggle} className={buttonClass}>
            {available ? "Deactivate" : "Activate"}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Category">{product.category.replaceAll("-", " ")}</DetailField>
          <DetailField label="Unit">{product.unit}</DetailField>
          <label className="space-y-1.5 text-xs text-muted-foreground">
            Price (₹)
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5 text-xs text-muted-foreground">
            Stock
            <input
              type="number"
              min="0"
              step="1"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              className={fieldClass}
            />
          </label>
          <DetailField label="Description">{product.description}</DetailField>
          <DetailField label="Availability">
            {product.stock <= 0 ? "Out of Stock" : product.stock <= 5 ? "Low Stock" : "In Stock"}
          </DetailField>
        </div>
        <button className="press mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          Save catalogue changes
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          Price and stock persist through the existing retailer store for its managed products.
          Other seeded catalogue entries remain demo fixtures.
        </p>
      </form>
    </>
  );
}

function UserDetails({ user, data }: { user: ManagedUser; data: ReturnType<typeof useAdminData> }) {
  const customerOrders =
    user.role === "Customer" ? data.orders.filter((order) => order.customerId === user.id) : [];
  const shop =
    user.role === "Retailer" ? data.shops.find((item) => item.ownerId === user.id) : undefined;
  const tasks =
    user.role === "Delivery Worker"
      ? data.tasks.filter((task) => task.deliveryWorkerId === user.id)
      : [];
  const active = data.controls.userStatus[user.id] ?? user.status;
  const toggle = () =>
    data.updateControls({
      userStatus: {
        ...data.controls.userStatus,
        [user.id]: active === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      },
    });
  return (
    <>
      <DetailHeader title={user.name} subtitle={user.role} back="/admin/users" />
      <section className={`${panelClass} p-5`}>
        <div className="flex items-center justify-between">
          <StatusBadge status={active} />
          <button onClick={toggle} className={buttonClass}>
            {active === "ACTIVE" ? "Deactivate" : "Activate"}
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Role">{user.role}</DetailField>
          <DetailField label="Email">{user.email}</DetailField>
          <DetailField label="Phone">{user.phone}</DetailField>
          <DetailField label="Created">{formatDate(user.createdAt)}</DetailField>
          <DetailField label="Account status">{active}</DetailField>
        </div>
        {user.role === "Customer" ? (
          <div className="mt-6 border-t border-border/60 pt-4">
            <h2 className="font-display font-semibold">Recent orders</h2>
            <div className="mt-3 space-y-2">
              {customerOrders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 p-3"
                >
                  <span className="font-mono text-xs">{order.id}</span>
                  <StatusBadge status={order.orderStatus} />
                  <ActionLink to="/admin/orders/$orderId" params={{ orderId: order.id }} />
                </div>
              ))}
              {!customerOrders.length ? (
                <p className="text-sm text-muted-foreground">
                  No local orders recorded for this customer.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        {shop ? (
          <div className="mt-6 border-t border-border/60 pt-4">
            <h2 className="font-display font-semibold">Retailer shop</h2>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-border/50 p-3">
              <span>{shop.name}</span>
              <ActionLink to="/admin/shops/$shopId" params={{ shopId: shop.id }} />
            </div>
          </div>
        ) : null}
        {user.role === "Delivery Worker" ? (
          <div className="mt-6 border-t border-border/60 pt-4">
            <h2 className="font-display font-semibold">Delivery activity</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tasks.length} tasks · {tasks.filter((task) => task.status === "DELIVERED").length}{" "}
              completed
            </p>
          </div>
        ) : null}
      </section>
    </>
  );
}

function RetailerDetails({
  retailer,
  data,
}: {
  retailer: ManagedUser;
  data: ReturnType<typeof useAdminData>;
}) {
  const shop = data.shops.find((item) => item.ownerId === retailer.id);
  const products = shop ? data.products.filter((product) => product.shopId === shop.id) : [];
  const orders = shop ? data.orders.filter((order) => order.shopId === shop.id) : [];
  const active = data.controls.retailerStatus[retailer.id] ?? retailer.status;
  const toggle = async () => {
    const next: ManagedStatus = active === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      if (shop) await data.updateShop(shop.id, { status: next });
      data.updateControls({
        retailerStatus: { ...data.controls.retailerStatus, [retailer.id]: next },
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update retailer shop.");
    }
  };
  return (
    <>
      <DetailHeader title={retailer.name} subtitle="Retailer profile" back="/admin/retailers" />
      <section className={`${panelClass} p-5`}>
        <div className="flex items-center justify-between">
          <StatusBadge status={active} />
          <button onClick={toggle} className={buttonClass}>
            {active === "ACTIVE" ? "Deactivate retailer" : "Activate retailer"}
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Email">{retailer.email}</DetailField>
          <DetailField label="Phone">{retailer.phone}</DetailField>
          <DetailField label="Shop">{shop?.name}</DetailField>
          <DetailField label="Shop status">
            {shop ? (data.controls.shopStatus[shop.id] ?? shop.status) : undefined}
          </DetailField>
          <DetailField label="Products">{products.length}</DetailField>
          <DetailField label="Orders">{orders.length}</DetailField>
        </div>
        {shop ? (
          <div className="mt-5">
            <ActionLink to="/admin/shops/$shopId" params={{ shopId: shop.id }}>
              View shop
            </ActionLink>
          </div>
        ) : null}
        <div className="mt-6 border-t border-border/60 pt-4">
          <h2 className="font-display font-semibold">Recent orders</h2>
          <div className="mt-3 space-y-2">
            {orders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 p-3"
              >
                <span className="font-mono text-xs">{order.id}</span>
                <StatusBadge status={order.orderStatus} />
                <ActionLink to="/admin/orders/$orderId" params={{ orderId: order.id }} />
              </div>
            ))}
            {!orders.length ? (
              <p className="text-sm text-muted-foreground">No local orders for this shop.</p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
