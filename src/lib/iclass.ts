import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/auth/context";
import { api } from "./api";
import type { Authorization } from "./types";

export const authorizationKey = (id: string) =>
  ["private", id, "authorization"] as const;
export const scheduleKey = (id: string, date: string) =>
  ["private", id, "schedule", date] as const;

export function useAuthorization() {
  const session = useSession();
  return useQuery({
    queryKey: authorizationKey(session.profile?.id ?? ""),
    queryFn: ({ signal }) =>
      api<Authorization>("/v1/iclass/authorization", session.manager, { signal }),
    enabled: session.phase === "ready",
    staleTime: 0,
    retry: false,
  });
}
