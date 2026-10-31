import { useLayoutEffect } from "react";
import { useLocation } from "react-router";
import { analytics, type WebAnalytics } from "@/lib/analytics";

export function AnalyticsRouteTracker({ reporter = analytics }: { reporter?: WebAnalytics | null }) {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    reporter?.visit(pathname);
  }, [pathname, reporter]);
  return null;
}
