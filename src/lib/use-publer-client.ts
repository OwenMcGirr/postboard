import { useMemo } from "react";
import { PublerClient } from "./publer-client";

export function usePublerClient(): PublerClient {
  return useMemo(() => new PublerClient(), []);
}
