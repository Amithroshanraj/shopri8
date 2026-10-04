import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CircleHelp, Mail, MessageCircle, Phone } from "lucide-react";

export const Route = createFileRoute("/retailer/help")({
  head: () => ({
    meta: [
      { title: "Help & Support — SHOPRi8 Retailer" },
      { name: "description", content: "Answers and contact options for SHOPRi8 retailers." },
    ],
  }),
  component: RetailerHelp,
});

const FAQS = [
  {
    question: "How do I change a product's stock?",
    answer:
      "Open Products, switch to the Inventory tab, then use the + and - controls on a product row. Changes save immediately.",
  },
  {
    question: "When is a product marked Low Stock?",
    answer: "A product is Low Stock at five units or fewer, and Out of Stock at zero units.",
  },
  {
    question: "Which order statuses can I set?",
    answer:
      "New orders can be accepted or rejected. Accepted orders move to Preparing, then Ready for Pickup. Pickup and delivery are handled by the delivery team.",
  },
  {
    question: "How do I change my shop hours?",
    answer:
      "Go to More, then Shop Settings to update your opening and closing times and your open or closed status.",
  },
  {
    question: "Where are my orders after I sign out?",
    answer:
      "Signing out only ends your retailer session. Your products, stock and orders are kept.",
  },
];

const CONTACTS = [
  { icon: Mail, label: "Email", value: "retailer@shopri8.com" },
  { icon: Phone, label: "Phone", value: "+91 80 4000 1234" },
  { icon: MessageCircle, label: "Partner chat", value: "Available 9am - 9pm" },
];

function RetailerHelp() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <Link
          to="/retailer/more"
          className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to More
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Help & Support
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Quick answers for running your shop on SHOPRi8.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl glass-1">
        {FAQS.map(({ question, answer }) => (
          <details
            key={question}
            className="group border-b border-border/60 px-4 py-3.5 last:border-b-0"
          >
            <summary className="flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground marker:content-none">
              <CircleHelp
                className="h-4 w-4 shrink-0 text-soft-violet"
                strokeWidth={1.8}
                aria-hidden
              />
              <span className="flex-1">{question}</span>
            </summary>
            <p className="mt-2 pl-7 text-xs leading-5 text-muted-foreground">{answer}</p>
          </details>
        ))}
      </section>

      <section>
        <h2 className="mb-2 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Contact
        </h2>
        <div className="overflow-hidden rounded-2xl glass-1">
          {CONTACTS.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-b-0"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-soft-violet">
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{value}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
