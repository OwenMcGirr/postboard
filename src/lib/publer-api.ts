export const PUBLER_BASE_URL = "/api";

export interface PublerUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface PublerWorkspace {
  id: string;
  name: string;
  role?: string;
  picture?: string;
}

export interface PublerAccount {
  id: string;
  name: string;
  provider: string;
  type?: string;
  picture?: string;
  status?: string;
}

export interface PublerMediaThumbnail {
  id?: string;
  small?: string;
  real?: string;
}

export interface PublerMedia {
  id: string;
  type: string;
  name?: string;
  caption?: string;
  path: string;
  thumbnail?: string;
  thumbnails?: PublerMediaThumbnail[] | Record<string, string>;
  created_at?: string;
  updated_at?: string;
  favorite?: boolean;
  in_library?: boolean;
  width?: number;
  height?: number;
  source?: string | null;
  validity?: Record<string, unknown>;
}

export interface PublerPost {
  id: string;
  text?: string;
  state: "scheduled" | "published" | "draft";
  scheduled_at?: string;
  created_at?: string;
  account_id?: string;
  accounts?: PublerAccount[];
  media?: PublerMedia[];
}

export interface PublerJobStatus {
  status: "pending" | "complete" | "failed";
  payload?: Record<string, unknown>;
}

export interface SchedulePostMedia {
  id: string;
  type: "photo" | "video";
  caption?: string;
  thumbnails?: PublerMediaThumbnail[];
  default_thumbnail?: number;
  title?: string;
}

export interface SchedulePostPayload {
  bulk: {
    state: string;
    posts: Array<{
      networks: Record<
        string,
        {
          type: "status" | "photo" | "video";
          text: string;
          media?: SchedulePostMedia[];
        }
      >;
      accounts: Array<{ id: string; scheduled_at: string }>;
    }>;
  };
}

export interface PostsQueryParams {
  state?: "scheduled" | "published" | "draft";
  page?: number;
  accountIds?: string[];
}

export interface MediaListParams {
  ids?: string[];
  page?: number;
  types?: string[];
  used?: boolean[];
  source?: string[];
  search?: string;
}

export class PublerApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "PublerApiError";
  }
}
