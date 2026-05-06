const { z } = require("zod");
const { anyApi, createConvexClient, getConvexUrl } = require("./convex-client");
const { runCodex } = require("./codex");

const INTERVIEW_QUESTIONS = [
  {
    id: "identity",
    prompt: "Who are you, what do you do, and what should the app call you?",
  },
  {
    id: "build",
    prompt: "What are you building or working on right now? Include products, company names, projects, or themes you want referenced accurately.",
  },
  {
    id: "audience",
    prompt: "Who are you writing for? Be specific about the audience you want these posts to resonate with.",
  },
  {
    id: "channels",
    prompt: "Where do you usually post, and how does your style differ by platform if at all?",
  },
  {
    id: "topics",
    prompt: "What subjects do you want to post about regularly?",
  },
  {
    id: "opinions",
    prompt: "What opinions, takes, or recurring beliefs do you want the writing to lean into?",
  },
  {
    id: "tone",
    prompt: "How should your writing feel? Describe the tone, rhythm, and personality you want.",
  },
  {
    id: "avoid",
    prompt: "What should the app avoid saying or sounding like? Mention cliches, phrases, tones, or formatting you dislike.",
  },
  {
    id: "examples",
    prompt: "Give a few examples of posts, writers, or styles you like or dislike, and why.",
  },
];

const InterviewSummarySchema = z.object({
  displayName: z.string().default(""),
  canonicalSummary: z.string().min(1),
  facts: z
    .array(
      z.object({
        category: z.string().min(1),
        content: z.string().min(1),
        priority: z.number().min(1).max(10),
      })
    )
    .default([]),
});

const ResearchFindingSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sourceUrl: z.string().url(),
  confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()).default([]),
});

function now() {
  return Date.now();
}

function requireConvex() {
  const client = createConvexClient();
  if (!client) {
    const error = new Error("Convex is not configured. Set CONVEX_URL and VITE_CONVEX_URL.");
    error.status = 503;
    throw error;
  }
  return client;
}

function getInterviewQuestion(questionId) {
  return INTERVIEW_QUESTIONS.find((question) => question.id === questionId) ?? null;
}

function getNextQuestion(questionId) {
  const index = INTERVIEW_QUESTIONS.findIndex((question) => question.id === questionId);
  if (index < 0 || index === INTERVIEW_QUESTIONS.length - 1) {
    return null;
  }
  return INTERVIEW_QUESTIONS[index + 1];
}

function buildComposePrompt(messages, memory) {
  const memorySections = [];

  if (memory?.profile?.canonicalSummary) {
    memorySections.push(`Author profile:\n${memory.profile.canonicalSummary}`);
  }

  if (Array.isArray(memory?.facts) && memory.facts.length > 0) {
    memorySections.push(
      `Known facts:\n${memory.facts.map((fact) => `- [${fact.category}] ${fact.content}`).join("\n")}`
    );
  }

  if (Array.isArray(memory?.examples) && memory.examples.length > 0) {
    memorySections.push(
      `Writing examples:\n${memory.examples
        .map((example, index) => `${index + 1}. ${example.text}`)
        .join("\n\n")}`
    );
  }

  if (Array.isArray(memory?.sources) && memory.sources.length > 0) {
    memorySections.push(
      `Optional research notes:\n${memory.sources
        .map(
          (source) =>
            `- ${source.title}: ${source.summary} (${source.sourceUrl}, confidence ${source.confidence})`
        )
        .join("\n")}`
    );
  }

  const conversation = messages
    .map((message) => `${message.role === "assistant" ? "Draft" : "User"}: ${message.content}`)
    .join("\n\n");

  return `You write social media posts on behalf of the user.

Return only the finished post text.
Do not ask follow-up questions.
Do not explain your choices.
Do not mention memory, research, or sources.
Write with personality when the source material supports it.
Avoid generic startup cliches and press-release language.
If the user is refining an existing draft, rewrite the full post instead of commenting on it.

${memorySections.length > 0 ? `${memorySections.join("\n\n")}\n\n` : ""}Conversation:
${conversation}`;
}

function stripCodeFence(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```[a-zA-Z0-9_-]*\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function deriveInterviewSummary(messages) {
  const transcript = messages
    .map((message) => `${message.role === "assistant" ? "Question" : "Answer"}: ${message.content}`)
    .join("\n\n");

  const prompt = `You are converting an onboarding interview into a durable writing memory for a social media drafting app.

Return JSON only with this shape:
{
  "displayName": "string",
  "canonicalSummary": "string",
  "facts": [
    { "category": "identity|build|audience|channels|topics|opinions|tone|avoid|examples", "content": "string", "priority": 1-10 }
  ]
}

Rules:
- canonicalSummary should be a concise but rich writing profile in first person if possible
- facts should be concrete and reusable
- include style constraints and things to avoid
- do not include markdown code fences
- do not include commentary before or after the JSON

Interview transcript:
${transcript}`;

  const result = await runCodex({
    prompt,
    model: process.env.CODEX_MODEL,
    allowSearch: false,
    timeoutMs: Number(process.env.CODEX_TIMEOUT_MS || 60000),
  });

  return InterviewSummarySchema.parse(JSON.parse(stripCodeFence(result.text)));
}

async function runResearchPreview(target) {
  const prompt = `Research this person or brand for a writing-memory profile.

Target:
${target}

Search the web and return JSON only with this shape:
{
  "findings": [
    {
      "title": "short title",
      "summary": "one or two factual sentences that would help an AI write about this person accurately",
      "sourceUrl": "https://...",
      "confidence": 0.0,
      "keywords": ["keyword", "keyword"]
    }
  ]
}

Rules:
- include only factual findings that are useful for writing context
- no speculation
- no markdown code fences
- no text outside the JSON
- prefer a small number of high-signal findings`;

  const result = await runCodex({
    prompt,
    model: process.env.CODEX_MODEL,
    allowSearch: true,
    timeoutMs: Number(process.env.CODEX_TIMEOUT_MS || 90000),
  });

  const parsed = JSON.parse(stripCodeFence(result.text));
  return z.object({ findings: z.array(ResearchFindingSchema).default([]) }).parse(parsed).findings;
}

async function deriveResearchMemory(target, findings) {
  const sourceBlock = findings
    .map(
      (finding, index) =>
        `${index + 1}. ${finding.title}\nSummary: ${finding.summary}\nSource: ${finding.sourceUrl}\nConfidence: ${finding.confidence}`
    )
    .join("\n\n");

  const prompt = `You are creating an initial author-memory profile for a social media drafting app.

Target:
${target}

Use only the factual findings below. Do not invent personal traits, opinions, or style preferences unless they are supported by the findings.

Return JSON only with this shape:
{
  "displayName": "string",
  "canonicalSummary": "string",
  "facts": [
    { "category": "identity|build|audience|channels|topics|opinions|tone|avoid|examples", "content": "string", "priority": 1-10 }
  ]
}

Rules:
- canonicalSummary should be useful immediately as a writing-memory seed
- stay cautious and factual when the source material is thin
- omit unsupported categories instead of guessing
- no markdown code fences
- no commentary before or after the JSON

Findings:
${sourceBlock}`;

  const result = await runCodex({
    prompt,
    model: process.env.CODEX_MODEL,
    allowSearch: false,
    timeoutMs: Number(process.env.CODEX_TIMEOUT_MS || 60000),
  });

  return InterviewSummarySchema.parse(JSON.parse(stripCodeFence(result.text)));
}

async function getSettingsState() {
  const client = requireConvex();
  return await client.query(anyApi.memory.getSettingsState, {});
}

async function getProfile() {
  const client = requireConvex();
  return await client.query(anyApi.memory.getProfile, {});
}

async function getExamples() {
  const client = requireConvex();
  return await client.query(anyApi.memory.getExamples, {});
}

async function startInterview() {
  const client = requireConvex();
  const firstQuestion = INTERVIEW_QUESTIONS[0];
  await client.mutation(anyApi.memory.startInterviewSession, {
    questionId: firstQuestion.id,
    prompt: firstQuestion.prompt,
    now: now(),
  });
  return { firstQuestion };
}

async function answerInterview({ sessionId, questionId, answer }) {
  const client = requireConvex();
  const nextQuestion = getNextQuestion(questionId);

  await client.mutation(anyApi.memory.appendInterviewAnswer, {
    sessionId,
    questionId,
    answer,
    nextQuestionId: nextQuestion?.id,
    nextPrompt: nextQuestion?.prompt,
    now: now(),
  });

  return {
    nextQuestion,
    readyToComplete: !nextQuestion,
  };
}

async function completeInterview({ sessionId }) {
  const client = requireConvex();
  const state = await client.query(anyApi.memory.getSettingsState, {});
  const interview = state?.interview;
  if (!interview || interview.session._id !== sessionId) {
    const error = new Error("No active interview session found.");
    error.status = 404;
    throw error;
  }

  const summary = await deriveInterviewSummary(interview.messages);

  await client.mutation(anyApi.memory.completeInterviewSession, {
    sessionId,
    displayName: summary.displayName,
    canonicalSummary: summary.canonicalSummary,
    facts: summary.facts,
    now: now(),
  });

  return summary;
}

async function updateCanonicalSummary({ canonicalSummary, displayName }) {
  const client = requireConvex();
  return await client.mutation(anyApi.memory.updateCanonicalSummary, {
    canonicalSummary,
    displayName,
    now: now(),
  });
}

async function importLegacyProfile(profile) {
  const client = requireConvex();
  return await client.mutation(anyApi.memory.importLegacyProfile, {
    profile,
    now: now(),
  });
}

async function saveWritingExample({ text, label, sourceBrief }) {
  const client = requireConvex();
  return await client.mutation(anyApi.memory.saveWritingExample, {
    text,
    label,
    sourceBrief,
    now: now(),
  });
}

async function previewResearch(target) {
  return await runResearchPreview(target);
}

async function saveResearch({ target, findings }) {
  const client = requireConvex();
  return await client.mutation(anyApi.memory.saveResearchFindings, {
    target,
    findings,
    now: now(),
  });
}

async function populateMemoryFromResearch(target) {
  const client = requireConvex();
  const findings = await runResearchPreview(target);
  if (findings.length === 0) {
    const error = new Error("Codex search did not return any usable findings for that target.");
    error.status = 502;
    throw error;
  }

  const summary = await deriveResearchMemory(target, findings);

  const result = await client.mutation(anyApi.memory.populateMemoryFromResearch, {
    target,
    displayName: summary.displayName,
    canonicalSummary: summary.canonicalSummary,
    facts: summary.facts,
    findings,
    now: now(),
  });

  return {
    ...result,
    findings,
    summary,
  };
}

async function getComposeContext(brief) {
  const url = getConvexUrl();
  if (!url) {
    return {
      profile: null,
      facts: [],
      sources: [],
      examples: [],
    };
  }

  const client = createConvexClient();
  return await client.query(anyApi.memory.getComposeContext, {
    brief,
  });
}

module.exports = {
  INTERVIEW_QUESTIONS,
  answerInterview,
  buildComposePrompt,
  completeInterview,
  getComposeContext,
  getExamples,
  getProfile,
  getSettingsState,
  importLegacyProfile,
  populateMemoryFromResearch,
  previewResearch,
  saveResearch,
  saveWritingExample,
  startInterview,
  updateCanonicalSummary,
};
