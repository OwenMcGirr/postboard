import useSWR from "swr";
import { usePublerClient } from "./use-publer-client";
import { PostsQueryParams, MediaListParams } from "./publer-api";
import { WritingExample } from "./memory-types";

export function useMe() {
  const client = usePublerClient();
  const { data, error, isLoading } = useSWR("me", () => client.getMe(), {
    revalidateOnFocus: false,
  });
  return { user: data?.user, isLoading, isError: !!error };
}

export function useAccounts() {
  const client = usePublerClient();
  const { data, error, isLoading } = useSWR("accounts", () => client.getAccounts(), {
    revalidateOnFocus: false,
  });
  return { accounts: data ?? [], isLoading, isError: !!error };
}

export function usePosts(params: PostsQueryParams) {
  const client = usePublerClient();
  const { data, error, isLoading, mutate } = useSWR(
    ["posts", params.state ?? "all", params.page ?? 0, (params.accountIds ?? []).join(",")],
    () => client.getPosts(params),
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );
  return { posts: data?.posts ?? [], isLoading, isError: !!error, mutate };
}

export function useMemoryExamples(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? "memory_examples" : null,
    async () => {
      const response = await fetch("/api/memory/examples");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return (await response.json()) as WritingExample[];
    },
    { revalidateOnFocus: false }
  );

  return { examples: data ?? [], isLoading, isError: !!error, mutate };
}

export function useMedia(params?: MediaListParams) {
  const client = usePublerClient();
  const { data, error, isLoading, mutate } = useSWR(
    ["media", params?.page ?? 0, params?.search ?? ""],
    () => client.getMedia(params),
    { revalidateOnFocus: false }
  );
  return { media: data?.media ?? [], total: data?.total ?? 0, isLoading, isError: !!error, mutate };
}

export function useJobStatus(jobId: string | null) {
  const client = usePublerClient();
  const { data, error } = useSWR(
    jobId ? ["job_status", jobId] : null,
    () => client.getJobStatus(jobId!),
    {
      refreshInterval: (d) => (!d || d.status === "pending" ? 1500 : 0),
      revalidateOnFocus: false,
    }
  );
  return { status: data?.status, isError: !!error };
}
