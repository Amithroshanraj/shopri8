import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/**
 * Sign out lives under More rather than in the bottom bar. Callers pass the
 * role's own logout so only that role's session is removed — products, orders,
 * shops and every other stored module are left untouched.
 */
export function RoleSignOut({
  onSignOut,
  redirectTo,
  label = "Sign Out",
  className,
}: {
  onSignOut: () => void;
  redirectTo: string;
  label?: string;
  className?: string;
}) {
  const navigate = useNavigate();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "press flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10",
            className,
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {label}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of your account?</AlertDialogTitle>
          <AlertDialogDescription>
            You will need to sign in again. Your stored shop, product and order data is kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onSignOut();
              navigate({ to: redirectTo as never, replace: true });
            }}
          >
            Sign Out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
