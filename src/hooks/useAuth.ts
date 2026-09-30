import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeToAuth } from "@/lib/firebase/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      subscribeToAuth((u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );
  return { user, loading };
}
