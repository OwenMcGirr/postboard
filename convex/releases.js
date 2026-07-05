import { queryGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

function truncateError(error) {
  const text = String(error || "").trim();
  return text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
}

export const getAnnouncementByExternalId = queryGeneric({
  args: {
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("releaseAnnouncements")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
  },
});

export const getRecentAnnouncements = queryGeneric({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 50), 1), 200);
    return await ctx.db.query("releaseAnnouncements").withIndex("by_detectedAt").order("desc").take(limit);
  },
});

export const getLatestWatchRuns = queryGeneric({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 20), 1), 100);
    return await ctx.db.query("releaseWatchRuns").withIndex("by_startedAt").order("desc").take(limit);
  },
});

export const recordWatchRunStarted = mutationGeneric({
  args: {
    orgs: v.array(v.string()),
    startedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("releaseWatchRuns", {
      startedAt: args.startedAt,
      status: "running",
      orgs: args.orgs,
      reposChecked: 0,
      releasesSeen: 0,
      announcementsCreated: 0,
      announcementsSkipped: 0,
      announcementsFailed: 0,
    });
  },
});

export const recordWatchRunFinished = mutationGeneric({
  args: {
    runId: v.id("releaseWatchRuns"),
    finishedAt: v.float64(),
    status: v.string(),
    counts: v.object({
      reposChecked: v.float64(),
      releasesSeen: v.float64(),
      announcementsCreated: v.float64(),
      announcementsSkipped: v.float64(),
      announcementsFailed: v.float64(),
    }),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      finishedAt: args.finishedAt,
      status: args.status,
      reposChecked: args.counts.reposChecked,
      releasesSeen: args.counts.releasesSeen,
      announcementsCreated: args.counts.announcementsCreated,
      announcementsSkipped: args.counts.announcementsSkipped,
      announcementsFailed: args.counts.announcementsFailed,
      error: args.error ? truncateError(args.error) : undefined,
    });

    return { ok: true };
  },
});

export const reserveAnnouncement = mutationGeneric({
  args: {
    release: v.object({
      externalId: v.string(),
      org: v.string(),
      owner: v.string(),
      repo: v.string(),
      releaseId: v.float64(),
      tagName: v.string(),
      releaseName: v.string(),
      releaseUrl: v.string(),
      releaseBody: v.optional(v.string()),
      publishedAt: v.string(),
    }),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("releaseAnnouncements")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.release.externalId))
      .unique();

    if (existing) {
      return {
        reserved: false,
        id: existing._id,
        status: existing.status,
      };
    }

    const id = await ctx.db.insert("releaseAnnouncements", {
      ...args.release,
      detectedAt: args.now,
      status: "reserved",
      attempts: 1,
      updatedAt: args.now,
    });

    return {
      reserved: true,
      id,
      status: "reserved",
    };
  },
});

export const markAnnouncementScheduled = mutationGeneric({
  args: {
    announcementId: v.id("releaseAnnouncements"),
    postText: v.string(),
    publerJobId: v.string(),
    scheduledAt: v.string(),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.announcementId, {
      status: "scheduled",
      postText: args.postText,
      publerJobId: args.publerJobId,
      scheduledAt: args.scheduledAt,
      error: undefined,
      updatedAt: args.now,
    });

    return { ok: true };
  },
});

export const markAnnouncementFailed = mutationGeneric({
  args: {
    announcementId: v.id("releaseAnnouncements"),
    error: v.string(),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.announcementId, {
      status: "failed",
      error: truncateError(args.error),
      updatedAt: args.now,
    });

    return { ok: true };
  },
});

export const markAnnouncementSkipped = mutationGeneric({
  args: {
    announcementId: v.id("releaseAnnouncements"),
    reason: v.string(),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.announcementId, {
      status: "skipped",
      error: truncateError(args.reason),
      updatedAt: args.now,
    });

    return { ok: true };
  },
});
