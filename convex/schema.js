import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  authorProfiles: defineTable({
    singletonKey: v.string(),
    displayName: v.string(),
    status: v.string(),
    canonicalSummary: v.string(),
    importedFromLocal: v.boolean(),
    lastInterviewCompletedAt: v.optional(v.float64()),
    updatedAt: v.float64(),
  }).index("by_singletonKey", ["singletonKey"]),

  interviewSessions: defineTable({
    status: v.string(),
    currentQuestionId: v.union(v.string(), v.null()),
    questionCount: v.float64(),
    createdAt: v.float64(),
    updatedAt: v.float64(),
    completedAt: v.optional(v.float64()),
  })
    .index("by_status", ["status"])
    .index("by_updatedAt", ["updatedAt"]),

  interviewMessages: defineTable({
    sessionId: v.id("interviewSessions"),
    role: v.string(),
    questionId: v.optional(v.string()),
    content: v.string(),
    order: v.float64(),
    createdAt: v.float64(),
  }).index("by_sessionId_order", ["sessionId", "order"]),

  memoryFacts: defineTable({
    category: v.string(),
    content: v.string(),
    priority: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_category", ["category"])
    .index("by_updatedAt", ["updatedAt"]),

  memorySources: defineTable({
    kind: v.string(),
    target: v.string(),
    title: v.string(),
    summary: v.string(),
    sourceUrl: v.string(),
    confidence: v.float64(),
    keywords: v.array(v.string()),
    createdAt: v.float64(),
  })
    .index("by_target", ["target"])
    .index("by_createdAt", ["createdAt"]),

  agentContextNotes: defineTable({
    source: v.string(),
    kind: v.string(),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    url: v.optional(v.string()),
    externalId: v.optional(v.string()),
    keywords: v.array(v.string()),
    importance: v.float64(),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_kind", ["kind"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_importance", ["importance"]),

  writingExamples: defineTable({
    text: v.string(),
    label: v.string(),
    sourceType: v.string(),
    sourcePostId: v.optional(v.string()),
    sourceAccountIds: v.optional(v.array(v.string())),
    sourceAccountNames: v.optional(v.array(v.string())),
    publishedAt: v.optional(v.string()),
    sourceBrief: v.optional(v.string()),
    createdAt: v.float64(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_sourcePostId", ["sourcePostId"]),

  releaseAnnouncements: defineTable({
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
    detectedAt: v.float64(),
    scheduledAt: v.optional(v.string()),
    status: v.string(),
    postText: v.optional(v.string()),
    publerJobId: v.optional(v.string()),
    error: v.optional(v.string()),
    attempts: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_status", ["status"])
    .index("by_detectedAt", ["detectedAt"])
    .index("by_org", ["org"]),

  releaseWatchRuns: defineTable({
    startedAt: v.float64(),
    finishedAt: v.optional(v.float64()),
    status: v.string(),
    orgs: v.array(v.string()),
    reposChecked: v.float64(),
    releasesSeen: v.float64(),
    announcementsCreated: v.float64(),
    announcementsSkipped: v.float64(),
    announcementsFailed: v.float64(),
    error: v.optional(v.string()),
  })
    .index("by_startedAt", ["startedAt"])
    .index("by_status", ["status"]),
});
