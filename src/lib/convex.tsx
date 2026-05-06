import { ReactNode, useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

export function getConvexUrl() {
  return String(import.meta.env.VITE_CONVEX_URL || "").trim();
}

export function isMemoryConfigured() {
  return Boolean(getConvexUrl());
}

export function AppProviders({ children }: { children: ReactNode }) {
  const url = getConvexUrl();
  const client = useMemo(() => (url ? new ConvexReactClient(url) : null), [url]);

  if (!client) {
    return <>{children}</>;
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
