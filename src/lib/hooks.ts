import useSWR from "swr";
import { usePublerClient } from "./use-publer-client";
import { PostsQueryParams, MediaListParams } from "./publer-api";

export function useMe() {
  const client = usePublerClient();
  const { data, error, isLoading } = useSWR(
    client ? "me" : null,
    () => client!.getMe(),
    { revalidateOnFocus: false }
  );
  return { user: data?.user, isLoading, isError: !!error };
}

export function useWorkspaces() {
  const client = usePublerClient();
  const { data, error, isLoading } = useSWR(
    client ? "workspaces" : null,
    () => client!.getWorkspaces(),
    { revalidateOnFocus: false }
  );
  return { workspaces: data?.workspaces ?? [], isLoading, isError: !!error };
}

export function useAccounts() {
  const client = usePublerClient();
  const { data, error, isLoading } = useSWR(
    client ? "accounts" : null,
    () => client!.getAccounts(),
    { revalidateOnFocus: false }
  );
  return { accounts: data?.accounts ?? [], isLoading, isError: !!error };
}

export function usePosts(params: PostsQueryParams | null) {
  const client = usePublerClient();
  const key = client && params !== null ? ["posts", params.state ?? "all", params.page ?? 0] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => client!.getPosts(params!),
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );
  return { posts: data?.posts ?? [], isLoading, isError: !!error, mutate };
}

export function useMedia(params?: MediaListParams) {
  const client = usePublerClient();
  const key = client ? ["media", params?.page ?? 0, params?.search ?? ""] : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => client!.getMedia(params),
    { revalidateOnFocus: false }
  );
  return { media: data?.media ?? [], total: data?.total ?? 0, isLoading, isError: !!error, mutate };
}

export function useJobStatus(jobId: string | null) {
  const client = usePublerClient();
  const { data, error } = useSWR(
    client && jobId ? ["job_status", jobId] : null,
    () => client!.getJobStatus(jobId!),
    {
      refreshInterval: (d) => (!d || d.status === "pending" ? 2000 : 0),
      revalidateOnFocus: false,
    }
  );
  return { status: data?.status, isError: !!error };
}
