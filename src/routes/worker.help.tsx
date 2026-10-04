import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CircleHelp, Mail, MessageCircle, Phone } from "lucide-react";

export const Route = createFileRoute("/worker/help")({
  head: () => ({
    meta: [
      { title: "Help & Support — SHOPRi8 Delivery" },
      { name: "description", content: "Delivery guidelines and contact options." },
    ],
  }),
  component: WorkerHelp,
});

const FAQS = [
  {
    question: "How do I start working on a task?",
    answer:
      "Open Tasks, pick an available task and use Start Pickup. The customer sees the status change live.",
  },
  {
    question: "Which statuses can I set?",
    answer:
      "You control Picked Up and Out for Delivery. Delivered is confirmed by the system or the recipient.",
  },
  {
    question: "How do I go unavailable?",
    answer:
      "Use the Work status switch on your Dashboard to stop receiving new tasks. Your current task stays with you.",
  },
  {
    question: "What happens to my data when I sign out?",
    answer: "Signing out only ends your worker session. Your task history is kept.",
  },
];

const CONTACTS = [
  { icon: Mail, label: "Email", value: "delivery@shopri8.com" },
  { icon: Phone, label: "Helpline", value: "+91 80 4000 5678" },
  { icon: MessageCircle, label: "Rider chat", value: "Available 24x7" },
];

function WorkerHelp() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <Link
          to="/worker/more"
          className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to More
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Help & Support
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Quick answers for delivering with SHOPRi8.
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
