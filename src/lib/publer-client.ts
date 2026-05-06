import {
  PUBLER_BASE_URL,
  PublerApiError,
  PublerJobStatus,
  PublerMedia,
  PublerPost,
  PublerUser,
  PublerWorkspace,
  PublerAccount,
  SchedulePostPayload,
  PostsQueryParams,
  MediaListParams,
} from "./publer-api";

export class PublerClient {
  constructor(
    private readonly baseUrl: string = PUBLER_BASE_URL
  ) {}

  private async request<T>(
    path: string,
    options?: RequestInit & { skipContentType?: boolean }
  ): Promise<T> {
    const { skipContentType, ...fetchOptions } = options ?? {};
    const headers: Record<string, string> = {
      ...(skipContentType ? {} : { "Content-Type": "application/json" }),
      ...(fetchOptions.headers as Record<string, string>),
    };

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOptions,
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new PublerApiError(
        res.status,
        (err as { message?: string }).message ?? `HTTP ${res.status}`
      );
    }

    if (res.status === 204) return null as T;
    return res.json();
  }

  getMe() {
    return this.request<{ user: PublerUser }>("/users/me");
  }

  getWorkspaces() {
    return this.request<PublerWorkspace[]>("/workspaces");
  }

  getAccounts() {
    return this.request<PublerAccount[]>("/accounts");
  }

  getPosts(params?: PostsQueryParams) {
    const query = new URLSearchParams();
    if (params?.state) query.set("state", params.state);
    if (params?.page != null) query.set("page", String(params.page));
    if (params?.accountIds?.length) query.set("account_ids", params.accountIds.join(","));
    const qs = query.toString();
    return this.request<{ posts: PublerPost[] }>(`/posts${qs ? `?${qs}` : ""}`);
  }

  schedulePost(payload: SchedulePostPayload) {
    return this.request<{ job_id: string }>("/posts/schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  getJobStatus(jobId: string) {
    return this.request<PublerJobStatus>(`/job_status/${jobId}`);
  }

  getMedia(params?: MediaListParams) {
    const query = new URLSearchParams();
    if (params?.page != null) query.set("page", String(params.page));
    if (params?.search) query.set("search", params.search);
    if (params?.types?.length) query.set("types", params.types.join(","));
    const qs = query.toString();
    return this.request<{ media: PublerMedia[]; total: number }>(
      `/media${qs ? `?${qs}` : ""}`
    );
  }

  deletePosts(postIds: string[]) {
    const query = postIds.map((id) => `post_ids[]=${encodeURIComponent(id)}`).join("&");
    return this.request<{ deleted_ids: string[] }>(`/posts?${query}`, {
      method: "DELETE",
    });
  }

  uploadMedia(formData: FormData) {
    return this.request<PublerMedia>("/media", {
      method: "POST",
      body: formData,
      skipContentType: true,
    });
  }
}
