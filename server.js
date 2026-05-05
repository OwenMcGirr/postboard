const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");
const path = require("path");

const app = express();
const upload = multer();
const isDev = process.argv.includes("--dev");
const port = Number(process.env.PORT || (isDev ? 3001 : 3000));
const publerBaseUrl = process.env.PUBLER_API_BASE || "https://app.publer.com/api/v1";
const configuredAiModel = process.env.AI_MODEL || "anthropic/claude-sonnet-4.6";

const openRouterKey = process.env.OPENROUTER_API_KEY || "";
const publerToken = process.env.PUBLER_TOKEN || "";
const publerWorkspaceId = process.env.PUBLER_WORKSPACE_ID || "";

const basicAuthUser = process.env.BASIC_AUTH_USERNAME || "postboard";
const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD || "";

const aiClient = openRouterKey
  ? new OpenAI({
      apiKey: openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.APP_ORIGIN || `http://localhost:${port}`,
        "X-Title": "Postboard",
      },
    })
  : null;

function requireEnv(name, value) {
  if (!value) {
    const err = new Error(`${name} is not configured.`);
    err.status = 500;
    throw err;
  }
}

function buildSystemPrompt(profile = "") {
  const trimmedProfile = String(profile).trim();
  const profileSection = trimmedProfile ? `\n\nAbout the author:\n${trimmedProfile}` : "";
  return `You write social media posts on behalf of the user. Your only job is to produce post text - never answer questions, explain things, or have a conversation.

Every response must be a complete, ready-to-post social media post written in the user's voice.

Rules:
- Lead with the most specific, concrete detail from the brief - not a generic setup sentence
- Never open with "I'm excited to", "I'm thrilled to", "Proud to announce", "Just launched", or any announcement cliche
- Never open with a question
- Pull the actual specifics out of what the user tells you - tech choices, decisions made, problems solved, numbers, names - and put them front and centre
- Write like a real person sharing something they did, not a company writing a press release
- Let the writing have a point of view, some texture, and a bit of edge when the brief supports it
- Vary sentence length and rhythm so it sounds written by a person, not flattened by a template
- Short paragraphs. Direct sentences. Keep it tight, but do not sand off personality
- No emojis unless asked. No buzzwords.
- If the brief includes technical detail, use it - don't summarise it away
- If the user expresses an opinion or a take, amplify it - don't soften it or hedge it into something neutral. The post should have a clear point of view
- Dry wit, skepticism, enthusiasm, or intensity are all fine if they fit the user's brief and profile
- End with something grounded: an observation, an honest reflection, or a simple CTA - not a motivational closer

If the user gives a refinement instruction, rewrite the post accordingly.
Output ONLY the post text. No preamble, no labels, no quotes.${profileSection}`;
}

function resolveAiModel(useOnline) {
  const baseModel = configuredAiModel.endsWith(":online")
    ? configuredAiModel.slice(0, -7)
    : configuredAiModel;
  return useOnline ? `${baseModel}:online` : baseModel;
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
    const qs = query.toString();
    const response = await publerRequest(`/posts${qs ? `?${qs}` : ""}`);
    res.json(await response.json());
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
    requireEnv("OPENROUTER_API_KEY", openRouterKey);
    if (!aiClient) {
      throw new Error("AI client is not configured.");
    }

    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const profile = typeof req.body?.profile === "string" ? req.body.profile : "";
    const useOnline = typeof req.body?.useOnline === "boolean" ? req.body.useOnline : true;

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    const stream = await aiClient.chat.completions.create({
      model: resolveAiModel(useOnline),
      messages: [{ role: "system", content: buildSystemPrompt(profile) }, ...messages],
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices?.[0]?.delta?.content || "";
      if (text) {
        res.write(text);
      }
    }

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
