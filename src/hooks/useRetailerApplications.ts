import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { retailerApplicationRepository } from "@/lib/repositories";
import { isBrowser, isFirebaseActive } from "@/lib/firebase";
import { refreshIdentity } from "@/lib/auth";

function unwrap<T>(result: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

export const retailerApplicationQueryKeys = {
  all: ["retailerApplications"] as const,
  mine: (uid: string) => ["retailerApplications", uid] as const,
};

export function useMyRetailerApplication(uid: string | undefined) {
  const [sessionRefreshError, setSessionRefreshError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: retailerApplicationQueryKeys.mine(uid ?? ""),
    queryFn: async () => {
      if (!uid) return null;
      return unwrap(await retailerApplicationRepository.get(uid));
    },
    enabled: !!uid && isFirebaseActive && isBrowser,
    staleTime: 0,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (query.data?.status !== "APPROVED") return;
    let cancelled = false;
    void refreshIdentity()
      .then(() => setSessionRefreshError(null))
      .catch((cause: unknown) => {
        if (!cancelled) {
          setSessionRefreshError(
            cause instanceof Error ? cause.message : "Could not refresh your account access.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query.data?.status]);

  return { ...query, sessionRefreshError };
}

export function useAllRetailerApplications(enabled = true) {
  return useQuery({
    queryKey: retailerApplicationQueryKeys.all,
    queryFn: async () => unwrap(await retailerApplicationRepository.list()),
    enabled: enabled && isFirebaseActive && isBrowser,
    staleTime: 10_000,
  });
}
