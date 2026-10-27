import { createContext, useContext, useSyncExternalStore } from "react";
import { BrowserSession } from "./session";
export const SessionContext = createContext<BrowserSession | null>(null);
export function useSession() {
  const manager = useContext(SessionContext);
  if (!manager) throw new Error("Missing session provider");
  const state = useSyncExternalStore(manager.subscribe, manager.snapshot);
  return { ...state, manager };
}
