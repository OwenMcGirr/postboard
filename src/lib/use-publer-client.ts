import { useMemo } from "react";
import { PublerClient } from "./publer-client";

const TOKEN = import.meta.env.VITE_PUBLER_TOKEN as string;
const WORKSPACE_ID = import.meta.env.VITE_PUBLER_WORKSPACE_ID as string;

export function usePublerClient(): PublerClient {
  return useMemo(() => new PublerClient(TOKEN, WORKSPACE_ID), []);
}
