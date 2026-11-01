import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { useSession } from "@/auth/context";
import { api } from "./api";
import type { Authorization } from "./types";

export const authorizationKey = (id: string) =>
  ["private", id, "authorization"] as const;
export const scheduleKey = (id: string, date: string) =>
  ["private", id, "schedule", date] as const;

export const AuthorizationContext = createContext<ReturnType<typeof useAuthorizationQuery> | null>(null);

export function useAuthorization() {
  const authorization = useContext(AuthorizationContext);
  if (!authorization) throw new Error("Missing authorization provider");
  return authorization;
}

export function useAuthorizationQuery() {
  const session = useSession();
  return useQuery({
    queryKey: authorizationKey(session.profile?.id ?? ""),
    queryFn: ({ signal }) =>
      api<Authorization>("/v1/iclass/authorization", session.manager, { signal }),
    enabled: session.phase === "ready",
    staleTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}
