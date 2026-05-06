const express = require("express");
const multer = require("multer");
const path = require("path");
const { runCodex } = require("./server/codex");
const {
  answerInterview,
  buildComposePrompt,
  completeInterview,
  getComposeContext,
  getExamples,
  getProfile,
  getSettingsState,
  importPostsAsExamples,
  importLegacyProfile,
  populateMemoryFromResearch,
  previewResearch,
  saveResearch,
  saveWritingExample,
  startInterview,
  updateCanonicalSummary,
} = require("./server/memory");

const app = express();
const upload = multer();
const isDev = process.argv.includes("--dev");
const port = Number(process.env.PORT || (isDev ? 3001 : 3000));
const publerBaseUrl = process.env.PUBLER_API_BASE || "https://app.publer.com/api/v1";

const publerToken = process.env.PUBLER_TOKEN || "";
const publerWorkspaceId = process.env.PUBLER_WORKSPACE_ID || "";

const basicAuthUser = process.env.BASIC_AUTH_USERNAME || "postboard";
const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD || "";

function requireEnv(name, value) {
  if (!value) {
    const err = new Error(`${name} is not configured.`);
    err.status = 500;
    throw err;
  }
}

function basicAuth(req, res, next) {
  if (!basicAuthPassword) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (header) {
    const [scheme, encoded] = header.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      const username = separator >= 0 ? decoded.slice(0, separator) : "";
      const password = separator >= 0 ? decoded.slice(separator + 1) : "";
      if (password === basicAuthPassword && username === basicAuthUser) {
        next();
        return;
      }
    }
  }

  res.set("WWW-Authenticate", 'Basic realm="Postboard"');
  res.status(401).send("Unauthorized");
}

async function readErrorMessage(response) {
  const text = await response.text();
  if (!text) {
    return `HTTP ${response.status}`;
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.message === "string") {
      return parsed.message;
    }
  } catch {}

  return text;
}

async function publerRequest(endpoint, options = {}) {
  requireEnv("PUBLER_TOKEN", publerToken);
  requireEnv("PUBLER_WORKSPACE_ID", publerWorkspaceId);

  const { skipContentType = false, headers = {}, ...fetchOptions } = options;
  const requestHeaders = {
    Authorization: `Bearer-API ${publerToken}`,
    "Publer-Workspace-Id": publerWorkspaceId,
    ...headers,
  };

  if (!skipContentType) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(`${publerBaseUrl}${endpoint}`, {
    ...fetchOptions,
    headers: requestHeaders,
  });

  if (!response.ok) {
    const err = new Error(await readErrorMessage(response));
    err.status = response.status;
    throw err;
  }

  return response;
}

function sendError(res, err) {
  const status = typeof err?.status === "number" ? err.status : 500;
  const message = err instanceof Error ? err.message : "Unexpected server error";
  res.status(status).json({ message });
}

app.disable("x-powered-by");
app.use(basicAuth);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", express.json({ limit: "1mb" }));

app.get("/api/memory/profile", async (_req, res) => {
  try {
    res.json(await getProfile());
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/memory/examples", async (_req, res) => {
  try {
    res.json(await getExamples());
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/memory/settings_state", async (_req, res) => {
  try {
    res.json(await getSettingsState());
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/memory/profile", async (req, res) => {
  try {
    const canonicalSummary =
      typeof req.body?.canonicalSummary === "string" ? req.body.canonicalSummary : "";
    const displayName =
      typeof req.body?.displayName === "string" ? req.body.displayName : undefined;
    res.json(await updateCanonicalSummary({ canonicalSummary, displayName }));
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/memory/import_local_profile", async (req, res) => {
  try {
    const profile = typeof req.body?.profile === "string" ? req.body.profile : "";
    res.json(await importLegacyProfile(profile));
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/memory/interview/start", async (_req, res) => {
  try {
    res.json(await startInterview());
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/memory/interview/message", async (req, res) => {
  try {
    const sessionId = req.body?.sessionId;
    const questionId = typeof req.body?.questionId === "string" ? req.body.questionId : "";
    const answer = typeof req.body?.answer === "string" ? req.body.answer : "";

    if (!sessionId || !questionId || !answer.trim()) {
      res.status(400).json({ message: "sessionId, questionId, and answer are required." });
      return;
    }

    res.json(
      await answerInterview({
        sessionId,
        questionId,
        answer: answer.trim(),
      })
    );
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/memory/interview/complete", async (req, res) => {
  try {
    const sessionId = req.body?.sessionId;
    if (!sessionId) {
      res.status(400).json({ message: "sessionId is required." });
      return;
    }

    res.json(await completeInterview({ sessionId }));
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/memory/research", async (req, res) => {
  try {
    const target = typeof req.body?.target === "string" ? req.body.target.trim() : "";
    const persist = req.body?.persist === true;
    const findings = Array.isArray(req.body?.findings) ? req.body.findings : [];

    if (!target) {
      res.status(400).json({ message: "target is required." });
      return;
    }

    if (!persist) {
      res.json({ findings: await previewResearch(target) });
      return;
    }

    res.json(await saveResearch({ target, findings }));
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/memory/research_bootstrap", async (req, res) => {
  try {
    const target = typeof req.body?.target === "string" ? req.body.target.trim() : "";

    if (!target) {
      res.status(400).json({ message: "target is required." });
      return;
    }

    res.json(await populateMemoryFromResearch(target));
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/memory/examples", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const label = typeof req.body?.label === "string" ? req.body.label.trim() : "Approved example";
    const sourceBrief =
      typeof req.body?.sourceBrief === "string" ? req.body.sourceBrief.trim() : undefined;

    if (!text) {
      res.status(400).json({ message: "text is required." });
      return;
    }

    res.json(await saveWritingExample({ text, label, sourceBrief }));
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/memory/examples/import_posts", async (req, res) => {
  try {
    const posts = Array.isArray(req.body?.posts) ? req.body.posts : [];
    if (posts.length === 0) {
      res.status(400).json({ message: "posts is required." });
      return;
    }

    const normalizedPosts = posts
      .map((post) => ({
        id: typeof post?.id === "string" ? post.id.trim() : "",
        text: typeof post?.text === "string" ? post.text : "",
        accountIds: Array.isArray(post?.accountIds)
          ? post.accountIds
              .filter((value) => typeof value === "string" && value.trim())
              .map((value) => value.trim())
          : [],
        accountNames: Array.isArray(post?.accountNames)
          ? post.accountNames
              .filter((value) => typeof value === "string" && value.trim())
              .map((value) => value.trim())
          : [],
        publishedAt: typeof post?.publishedAt === "string" ? post.publishedAt : undefined,
      }))
      .filter((post) => post.id && post.text.trim());

    if (normalizedPosts.length === 0) {
      res.status(400).json({ message: "No valid posts were provided." });
      return;
    }

    res.json(await importPostsAsExamples(normalizedPosts));
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/me", async (_req, res) => {
  try {
    const response = await publerRequest("/users/me");
    res.json(await response.json());
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/accounts", async (_req, res) => {
  try {
    const response = await publerRequest("/accounts");
    res.json(await response.json());
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/posts", async (req, res) => {
  try {
    const query = new URLSearchParams();
    if (typeof req.query.state === "string") query.set("state", req.query.state);
    if (typeof req.query.page === "string") query.set("page", req.query.page);
    const accountIds =
      typeof req.query.account_ids === "string"
        ? req.query.account_ids
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
    const qs = query.toString();
    const response = await publerRequest(`/posts${qs ? `?${qs}` : ""}`);
    const payload = await response.json();

    if (accountIds.length === 0 || !Array.isArray(payload?.posts)) {
      res.json(payload);
      return;
    }

    const filteredPosts = payload.posts.filter((post) => {
      if (typeof post?.account_id === "string" && accountIds.includes(post.account_id)) {
        return true;
      }

      return (
        Array.isArray(post?.accounts) &&
        post.accounts.some(
          (account) => account && typeof account.id === "string" && accountIds.includes(account.id)
        )
      );
    });

    res.json({
      ...payload,
      posts: filteredPosts,
      total: filteredPosts.length,
    });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete("/api/posts", async (req, res) => {
  try {
    const ids = req.query["post_ids[]"];
    const values = Array.isArray(ids) ? ids : typeof ids === "string" ? [ids] : [];
    const qs = values.map((id) => `post_ids[]=${encodeURIComponent(id)}`).join("&");
    const response = await publerRequest(`/posts${qs ? `?${qs}` : ""}`, {
      method: "DELETE",
    });
    res.json(await response.json());
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/posts/schedule", async (req, res) => {
  try {
    const response = await publerRequest("/posts/schedule", {
      method: "POST",
      body: JSON.stringify(req.body),
    });
    res.json(await response.json());
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/job_status/:jobId", async (req, res) => {
  try {
    const response = await publerRequest(`/job_status/${req.params.jobId}`);
    res.json(await response.json());
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/media", async (req, res) => {
  try {
    const query = new URLSearchParams();
    if (typeof req.query.page === "string") query.set("page", req.query.page);
    if (typeof req.query.search === "string") query.set("search", req.query.search);
    if (typeof req.query.types === "string" && req.query.types) query.set("types", req.query.types);
    const qs = query.toString();
    const response = await publerRequest(`/media${qs ? `?${qs}` : ""}`);
    res.json(await response.json());
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/media", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No file uploaded." });
      return;
    }

    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);

    const inLibrary = typeof req.body.in_library === "string" ? req.body.in_library : "true";
    form.append("in_library", inLibrary);

    const response = await publerRequest("/media", {
      method: "POST",
      body: form,
      skipContentType: true,
    });
    res.json(await response.json());
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/ai/compose", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message && message.role === "user" && typeof message.content === "string");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    const memory = await getComposeContext(latestUserMessage?.content || "");
    const prompt = buildComposePrompt(messages, memory);
    const result = await runCodex({
      prompt,
      model: process.env.CODEX_MODEL,
      allowSearch: false,
      timeoutMs: Number(process.env.CODEX_TIMEOUT_MS || 60000),
    });
    res.write(result.text);
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      sendError(res, err);
      return;
    }

    res.end();
  }
});

if (!isDev) {
  const distDir = path.join(__dirname, "dist");
  app.use(express.static(distDir));
  app.use((_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Postboard server listening on http://localhost:${port}`);
});
