import type { ReactNode } from "react";
import { AuthorizationContext, useAuthorizationQuery } from "@/lib/iclass";

export function AuthorizationProvider({ children }: { children: ReactNode }) {
  const authorization = useAuthorizationQuery();
  return (
    <AuthorizationContext.Provider value={authorization}>
      {children}
    </AuthorizationContext.Provider>
  );
}
