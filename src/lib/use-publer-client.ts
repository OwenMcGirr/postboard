import { useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { PublerClient } from "./publer-client";

export function usePublerClient(): PublerClient | null {
  const { token, workspaceId } = useAuth();
  return useMemo(
    () => (token && workspaceId ? new PublerClient(token, workspaceId) : null),
    [token, workspaceId]
  );
}
