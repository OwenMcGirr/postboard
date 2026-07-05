export interface ReleaseAnnouncement {
  _id: string;
  externalId: string;
  org: string;
  owner: string;
  repo: string;
  releaseId: number;
  tagName: string;
  releaseName: string;
  releaseUrl: string;
  releaseBody?: string;
  publishedAt: string;
  detectedAt: number;
  scheduledAt?: string;
  status: "reserved" | "scheduled" | "skipped" | "failed" | string;
  postText?: string;
  publerJobId?: string;
  error?: string;
  attempts: number;
  updatedAt: number;
}

export interface ReleaseWatchRun {
  _id: string;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "completed" | "completed_with_failures" | "failed" | string;
  orgs: string[];
  reposChecked: number;
  releasesSeen: number;
  announcementsCreated: number;
  announcementsSkipped: number;
  announcementsFailed: number;
  error?: string;
}
