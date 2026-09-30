import { cn } from "@/lib/utils";

/**
 * Temporary text wordmark. The final SHOPRi8 logo is not designed yet —
 * replace this component when the brand mark lands.
 */
export function Wordmark({
  className,
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="font-display text-xl font-bold tracking-tight">
        <span className="text-foreground">SHOP</span>
        <span className="text-gradient">Ri8</span>
      </span>
      {showTagline ? (
        <span className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
          Shop Nearby. Live Local.
        </span>
      ) : null}
    </div>
  );
}
