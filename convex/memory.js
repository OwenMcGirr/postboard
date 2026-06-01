import { queryGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

const PROFILE_KEY = "default";
const AGENT_CONTEXT_KINDS = new Set([
  "project",
  "person",
  "decision",
  "operation",
  "credential_map",
  "writing_context",
  "fact",
  "other",
]);

function toKeywords(text) {
  return Array.from(
    new Set(
      String(text || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 4)
    )
  );
}

function toAgentContextKeywords(note) {
  return toKeywords(
    [
      note.title,
      note.content,
      ...(Array.isArray(note.tags) ? note.tags : []),
      note.url || "",
      note.source,
    ].join(" ")
  );
}

function normalizeTags(tags) {
  return Array.from(
    new Set(
      (Array.isArray(tags) ? tags : [])
        .map((tag) => String(tag || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizeAgentContextArgs(args) {
  const source = String(args.source || "").trim();
  const kind = String(args.kind || "").trim();
  const title = String(args.title || "").trim();
  const content = String(args.content || "").trim();
  const tags = normalizeTags(args.tags);
  const url = typeof args.url === "string" && args.url.trim() ? args.url.trim() : undefined;
  const externalId =
    typeof args.externalId === "string" && args.externalId.trim() ? args.externalId.trim() : undefined;
  const importance = typeof args.importance === "number" ? args.importance : 5;

  if (!source || source.length > 120) {
    throw new Error("source must be a non-empty string up to 120 characters.");
  }
  if (!AGENT_CONTEXT_KINDS.has(kind)) {
    throw new Error("kind is invalid.");
  }
  if (!title || title.length > 200) {
    throw new Error("title must be a non-empty string up to 200 characters.");
  }
  if (!content || content.length > 10000) {
    throw new Error("content must be a non-empty string up to 10000 characters.");
  }
  if (tags.length > 20 || tags.some((tag) => tag.length > 60)) {
    throw new Error("tags must include at most 20 values up to 60 characters each.");
  }
  if (url && url.length > 500) {
    throw new Error("url must be up to 500 characters.");
  }
  if (externalId && externalId.length > 240) {
    throw new Error("externalId must be up to 240 characters.");
  }
  if (importance < 1 || importance > 10) {
    throw new Error("importance must be between 1 and 10.");
  }

  return {
    source,
    kind,
    title,
    content,
    tags,
    url,
    externalId,
    importance,
  };
}

function sourceMatchesBrief(source, briefKeywords) {
  if (briefKeywords.length === 0) {
    return false;
  }

  const haystack = [
    source.target,
    source.title,
    source.summary,
    source.sourceUrl,
    ...(Array.isArray(source.keywords) ? source.keywords : []),
  ]
    .join(" ")
    .toLowerCase();

  return briefKeywords.some((keyword) => haystack.includes(keyword));
}

function agentContextMatchesKeywords(note, keywords) {
  if (keywords.length === 0) {
    return false;
  }

  const haystack = [
    note.title,
    note.content,
    ...(Array.isArray(note.tags) ? note.tags : []),
    note.url || "",
    note.source,
    ...(Array.isArray(note.keywords) ? note.keywords : []),
  ]
    .join(" ")
    .toLowerCase();

  return keywords.some((keyword) => haystack.includes(keyword));
}

function agentContextMatchesSearch(note, queryKeywords) {
  if (queryKeywords.length === 0) {
    return true;
  }

  const haystack = [
    note.title,
    note.content,
    ...(Array.isArray(note.tags) ? note.tags : []),
    note.url || "",
    note.source,
    ...(Array.isArray(note.keywords) ? note.keywords : []),
  ]
    .join(" ")
    .toLowerCase();

  return queryKeywords.every((keyword) => haystack.includes(keyword));
}

function publicAgentContextNote(note, truncateContent = false) {
  const content = truncateContent && note.content.length > 1000 ? `${note.content.slice(0, 1000)}...` : note.content;
  return {
    _id: note._id,
    source: note.source,
    kind: note.kind,
    title: note.title,
    content,
    tags: note.tags,
    url: note.url,
    externalId: note.externalId,
    importance: note.importance,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

async function getProfileDoc(ctx) {
  return await ctx.db
    .query("authorProfiles")
    .withIndex("by_singletonKey", (q) => q.eq("singletonKey", PROFILE_KEY))
    .unique();
}

async function getActiveSessionDoc(ctx) {
  const sessions = await ctx.db
    .query("interviewSessions")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .collect();

  return sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

async function getSessionMessages(ctx, sessionId) {
  return await ctx.db
    .query("interviewMessages")
    .withIndex("by_sessionId_order", (q) => q.eq("sessionId", sessionId))
    .collect();
}

async function replaceMemoryFacts(ctx, facts, now) {
  const existingFacts = await ctx.db.query("memoryFacts").collect();
  for (const fact of existingFacts) {
    await ctx.db.delete(fact._id);
  }

  for (const fact of facts) {
    await ctx.db.insert("memoryFacts", {
      category: fact.category,
      content: fact.content,
      priority: fact.priority,
      updatedAt: now,
    });
  }
}

function normalizeExampleText(text) {
  return String(text || "").trim();
}

async function getExistingWritingExamples(ctx) {
  return await ctx.db.query("writingExamples").collect();
}

export const getProfile = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const profile = await getProfileDoc(ctx);
    return (
      profile ?? {
        displayName: "",
        status: "empty",
        canonicalSummary: "",
        importedFromLocal: false,
        lastInterviewCompletedAt: null,
        updatedAt: null,
      }
    );
  },
});

export const getExamples = queryGeneric({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("writingExamples").withIndex("by_createdAt").order("desc").collect();
  },
});

export const getSettingsState = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const [profile, activeSession, facts, sources, examples] = await Promise.all([
      getProfileDoc(ctx),
      getActiveSessionDoc(ctx),
      ctx.db.query("memoryFacts").withIndex("by_updatedAt").order("desc").collect(),
      ctx.db.query("memorySources").withIndex("by_createdAt").order("desc").collect(),
      ctx.db.query("writingExamples").withIndex("by_createdAt").order("desc").collect(),
    ]);

    let interview = null;
    if (activeSession) {
      const messages = await getSessionMessages(ctx, activeSession._id);
      interview = {
        session: activeSession,
        messages,
      };
    }

    return {
      profile:
        profile ?? {
          displayName: "",
          status: "empty",
          canonicalSummary: "",
          importedFromLocal: false,
          lastInterviewCompletedAt: null,
          updatedAt: null,
        },
      interview,
      facts: facts
        .slice()
        .sort((a, b) => (b.priority === a.priority ? b.updatedAt - a.updatedAt : b.priority - a.priority)),
      sources,
      examples,
    };
  },
});

export const getComposeContext = queryGeneric({
  args: {
    brief: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const briefKeywords = toKeywords(args.brief || "");
    const [profile, facts, sources, examples, agentContextNotes] = await Promise.all([
      getProfileDoc(ctx),
      ctx.db.query("memoryFacts").withIndex("by_updatedAt").order("desc").collect(),
      ctx.db.query("memorySources").withIndex("by_createdAt").order("desc").take(20),
      ctx.db.query("writingExamples").withIndex("by_createdAt").order("desc").take(5),
      ctx.db.query("agentContextNotes").withIndex("by_updatedAt").order("desc").take(100),
    ]);

    const selectedFacts = facts
      .slice()
      .sort((a, b) => (b.priority === a.priority ? b.updatedAt - a.updatedAt : b.priority - a.priority))
      .map((fact) => ({
        category: fact.category,
        content: fact.content,
        priority: fact.priority,
      }));

    const selectedSources = sources
      .filter((source) => sourceMatchesBrief(source, briefKeywords))
      .slice(0, 5)
      .map((source) => ({
        kind: source.kind,
        target: source.target,
        title: source.title,
        summary: source.summary,
        sourceUrl: source.sourceUrl,
        confidence: source.confidence,
      }));

    const selectedAgentContext = agentContextNotes
      .filter((note) => note.kind !== "credential_map")
      .filter((note) => note.importance >= 9 || agentContextMatchesKeywords(note, briefKeywords))
      .sort((a, b) => (b.importance === a.importance ? b.updatedAt - a.updatedAt : b.importance - a.importance))
      .slice(0, 5)
      .map((note) => {
        const publicNote = publicAgentContextNote(note, true);
        return {
          kind: publicNote.kind,
          title: publicNote.title,
          content: publicNote.content,
          tags: publicNote.tags,
          url: publicNote.url,
          source: publicNote.source,
          importance: publicNote.importance,
        };
      });

    return {
      profile: profile
        ? {
            displayName: profile.displayName,
            status: profile.status,
            canonicalSummary: profile.canonicalSummary,
          }
        : null,
      facts: selectedFacts,
      sources: selectedSources,
      agentContext: selectedAgentContext,
      examples: examples.map((example) => ({
        _id: example._id,
        text: example.text,
        label: example.label,
        sourceType: example.sourceType,
        sourcePostId: example.sourcePostId ?? "",
        sourceAccountIds: example.sourceAccountIds ?? [],
        sourceAccountNames: example.sourceAccountNames ?? [],
        publishedAt: example.publishedAt ?? "",
        sourceBrief: example.sourceBrief ?? "",
        createdAt: example.createdAt,
      })),
    };
  },
});

export const ingestAgentContext = mutationGeneric({
  args: {
    source: v.string(),
    kind: v.string(),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    url: v.optional(v.string()),
    externalId: v.optional(v.string()),
    importance: v.float64(),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    const note = normalizeAgentContextArgs(args);
    const keywords = toAgentContextKeywords(note);

    if (note.externalId) {
      const existing = await ctx.db
        .query("agentContextNotes")
        .withIndex("by_externalId", (q) => q.eq("externalId", note.externalId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          source: note.source,
          kind: note.kind,
          title: note.title,
          content: note.content,
          tags: note.tags,
          url: note.url,
          externalId: note.externalId,
          keywords,
          importance: note.importance,
          updatedAt: args.now,
        });

        return {
          id: existing._id,
          created: false,
          updated: true,
        };
      }
    }

    const id = await ctx.db.insert("agentContextNotes", {
      source: note.source,
      kind: note.kind,
      title: note.title,
      content: note.content,
      tags: note.tags,
      url: note.url,
      externalId: note.externalId,
      keywords,
      importance: note.importance,
      createdAt: args.now,
      updatedAt: args.now,
    });

    return {
      id,
      created: true,
      updated: false,
    };
  },
});

export const searchAgentContext = queryGeneric({
  args: {
    q: v.optional(v.string()),
    kind: v.optional(v.string()),
    tag: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 20), 1), 50);
    const queryKeywords = toKeywords(args.q || "");
    const kind = typeof args.kind === "string" && args.kind.trim() ? args.kind.trim() : "";
    const tag = typeof args.tag === "string" && args.tag.trim() ? args.tag.trim().toLowerCase() : "";
    const candidates = await ctx.db
      .query("agentContextNotes")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(200);

    return candidates
      .filter((note) => !kind || note.kind === kind)
      .filter((note) => !tag || note.tags.includes(tag))
      .filter((note) => agentContextMatchesSearch(note, queryKeywords))
      .sort((a, b) => (b.importance === a.importance ? b.updatedAt - a.updatedAt : b.importance - a.importance))
      .slice(0, limit)
      .map((note) => publicAgentContextNote(note));
  },
});

export const getAgentContextExport = queryGeneric({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 100), 1), 500);
    const notes = await ctx.db
      .query("agentContextNotes")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(limit);

    return notes.map((note) => publicAgentContextNote(note));
  },
});

export const startInterviewSession = mutationGeneric({
  args: {
    questionId: v.string(),
    prompt: v.string(),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    const activeSessions = await ctx.db
      .query("interviewSessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    for (const session of activeSessions) {
      await ctx.db.patch(session._id, {
        status: "abandoned",
        updatedAt: args.now,
      });
    }

    const sessionId = await ctx.db.insert("interviewSessions", {
      status: "active",
      currentQuestionId: args.questionId,
      questionCount: 1,
      createdAt: args.now,
      updatedAt: args.now,
    });

    await ctx.db.insert("interviewMessages", {
      sessionId,
      role: "assistant",
      questionId: args.questionId,
      content: args.prompt,
      order: 0,
      createdAt: args.now,
    });

    return { sessionId };
  },
});

export const appendInterviewAnswer = mutationGeneric({
  args: {
    sessionId: v.id("interviewSessions"),
    questionId: v.string(),
    answer: v.string(),
    nextQuestionId: v.optional(v.string()),
    nextPrompt: v.optional(v.string()),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    const messages = await getSessionMessages(ctx, args.sessionId);
    const nextOrder = messages.length;

    await ctx.db.insert("interviewMessages", {
      sessionId: args.sessionId,
      role: "user",
      questionId: args.questionId,
      content: args.answer,
      order: nextOrder,
      createdAt: args.now,
    });

    if (args.nextQuestionId && args.nextPrompt) {
      await ctx.db.insert("interviewMessages", {
        sessionId: args.sessionId,
        role: "assistant",
        questionId: args.nextQuestionId,
        content: args.nextPrompt,
        order: nextOrder + 1,
        createdAt: args.now,
      });
    }

    await ctx.db.patch(args.sessionId, {
      currentQuestionId: args.nextQuestionId ?? null,
      questionCount: messages.length + (args.nextQuestionId && args.nextPrompt ? 2 : 1),
      updatedAt: args.now,
    });

    return { ok: true };
  },
});

export const completeInterviewSession = mutationGeneric({
  args: {
    sessionId: v.id("interviewSessions"),
    displayName: v.string(),
    canonicalSummary: v.string(),
    facts: v.array(
      v.object({
        category: v.string(),
        content: v.string(),
        priority: v.float64(),
      })
    ),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    await replaceMemoryFacts(ctx, args.facts, args.now);

    const profile = await getProfileDoc(ctx);
    if (profile) {
      await ctx.db.patch(profile._id, {
        displayName: args.displayName,
        status: "ready",
        canonicalSummary: args.canonicalSummary,
        importedFromLocal: profile.importedFromLocal,
        lastInterviewCompletedAt: args.now,
        updatedAt: args.now,
      });
    } else {
      await ctx.db.insert("authorProfiles", {
        singletonKey: PROFILE_KEY,
        displayName: args.displayName,
        status: "ready",
        canonicalSummary: args.canonicalSummary,
        importedFromLocal: false,
        lastInterviewCompletedAt: args.now,
        updatedAt: args.now,
      });
    }

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      currentQuestionId: null,
      completedAt: args.now,
      updatedAt: args.now,
    });

    return { ok: true };
  },
});

export const populateMemoryFromResearch = mutationGeneric({
  args: {
    target: v.string(),
    displayName: v.string(),
    canonicalSummary: v.string(),
    facts: v.array(
      v.object({
        category: v.string(),
        content: v.string(),
        priority: v.float64(),
      })
    ),
    findings: v.array(
      v.object({
        title: v.string(),
        summary: v.string(),
        sourceUrl: v.string(),
        confidence: v.float64(),
        keywords: v.array(v.string()),
      })
    ),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    await replaceMemoryFacts(ctx, args.facts, args.now);

    const activeSessions = await ctx.db
      .query("interviewSessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    for (const session of activeSessions) {
      await ctx.db.patch(session._id, {
        status: "abandoned",
        currentQuestionId: null,
        updatedAt: args.now,
      });
    }

    const existingSources = await ctx.db.query("memorySources").collect();
    for (const source of existingSources) {
      if (source.kind === "research") {
        await ctx.db.delete(source._id);
      }
    }

    for (const finding of args.findings) {
      await ctx.db.insert("memorySources", {
        kind: "research",
        target: args.target,
        title: finding.title,
        summary: finding.summary,
        sourceUrl: finding.sourceUrl,
        confidence: finding.confidence,
        keywords: finding.keywords,
        createdAt: args.now,
      });
    }

    const profile = await getProfileDoc(ctx);
    if (profile) {
      await ctx.db.patch(profile._id, {
        displayName: args.displayName,
        status: "ready",
        canonicalSummary: args.canonicalSummary,
        importedFromLocal: false,
        updatedAt: args.now,
      });
    } else {
      await ctx.db.insert("authorProfiles", {
        singletonKey: PROFILE_KEY,
        displayName: args.displayName,
        status: "ready",
        canonicalSummary: args.canonicalSummary,
        importedFromLocal: false,
        updatedAt: args.now,
      });
    }

    return {
      saved: args.findings.length,
      factCount: args.facts.length,
    };
  },
});

export const updateCanonicalSummary = mutationGeneric({
  args: {
    canonicalSummary: v.string(),
    displayName: v.optional(v.string()),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    const profile = await getProfileDoc(ctx);
    if (profile) {
      await ctx.db.patch(profile._id, {
        canonicalSummary: args.canonicalSummary,
        displayName: args.displayName ?? profile.displayName,
        status: args.canonicalSummary.trim() ? "ready" : profile.status,
        updatedAt: args.now,
      });
      return { ok: true };
    }

    await ctx.db.insert("authorProfiles", {
      singletonKey: PROFILE_KEY,
      displayName: args.displayName ?? "",
      status: args.canonicalSummary.trim() ? "ready" : "empty",
      canonicalSummary: args.canonicalSummary,
      importedFromLocal: false,
      updatedAt: args.now,
    });

    return { ok: true };
  },
});

export const importLegacyProfile = mutationGeneric({
  args: {
    profile: v.string(),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    const trimmed = args.profile.trim();
    if (!trimmed) {
      return { imported: false };
    }

    const profile = await getProfileDoc(ctx);
    if (profile && profile.canonicalSummary.trim()) {
      return { imported: false };
    }

    if (profile) {
      await ctx.db.patch(profile._id, {
        canonicalSummary: trimmed,
        status: "ready",
        importedFromLocal: true,
        updatedAt: args.now,
      });
    } else {
      await ctx.db.insert("authorProfiles", {
        singletonKey: PROFILE_KEY,
        displayName: "",
        status: "ready",
        canonicalSummary: trimmed,
        importedFromLocal: true,
        updatedAt: args.now,
      });
    }

    return { imported: true };
  },
});

export const saveResearchFindings = mutationGeneric({
  args: {
    target: v.string(),
    findings: v.array(
      v.object({
        title: v.string(),
        summary: v.string(),
        sourceUrl: v.string(),
        confidence: v.float64(),
        keywords: v.array(v.string()),
      })
    ),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    for (const finding of args.findings) {
      await ctx.db.insert("memorySources", {
        kind: "research",
        target: args.target,
        title: finding.title,
        summary: finding.summary,
        sourceUrl: finding.sourceUrl,
        confidence: finding.confidence,
        keywords: finding.keywords,
        createdAt: args.now,
      });
    }

    return { saved: args.findings.length };
  },
});

export const saveWritingExample = mutationGeneric({
  args: {
    text: v.string(),
    label: v.string(),
    sourceBrief: v.optional(v.string()),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("writingExamples", {
      text: args.text,
      label: args.label,
      sourceType: "manual_draft",
      sourceBrief: args.sourceBrief,
      createdAt: args.now,
    });

    return { id };
  },
});

export const importWritingExamplesFromPosts = mutationGeneric({
  args: {
    posts: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        accountIds: v.array(v.string()),
        accountNames: v.array(v.string()),
        publishedAt: v.optional(v.string()),
      })
    ),
    now: v.float64(),
  },
  handler: async (ctx, args) => {
    const existingExamples = await getExistingWritingExamples(ctx);
    const existingSourcePostIds = new Set(
      existingExamples
        .map((example) => example.sourcePostId)
        .filter((value) => typeof value === "string" && value.trim())
    );
    const existingTexts = new Set(
      existingExamples
        .map((example) => normalizeExampleText(example.text))
        .filter(Boolean)
    );

    let imported = 0;
    let skipped = 0;

    for (const post of args.posts) {
      const normalizedText = normalizeExampleText(post.text);
      const sourcePostId = String(post.id || "").trim();

      if (!normalizedText || normalizedText.length < 20) {
        skipped += 1;
        continue;
      }

      if ((sourcePostId && existingSourcePostIds.has(sourcePostId)) || existingTexts.has(normalizedText)) {
        skipped += 1;
        continue;
      }

      await ctx.db.insert("writingExamples", {
        text: normalizedText,
        label: "Imported from past posts",
        sourceType: "imported_post",
        sourcePostId,
        sourceAccountIds: post.accountIds,
        sourceAccountNames: post.accountNames,
        publishedAt: post.publishedAt,
        createdAt: args.now,
      });

      imported += 1;
      if (sourcePostId) {
        existingSourcePostIds.add(sourcePostId);
      }
      existingTexts.add(normalizedText);
    }

    return {
      imported,
      skipped,
    };
  },
});
