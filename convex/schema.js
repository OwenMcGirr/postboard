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

  writingExamples: defineTable({
    text: v.string(),
    label: v.string(),
    sourceBrief: v.optional(v.string()),
    createdAt: v.float64(),
  }).index("by_createdAt", ["createdAt"]),
});
