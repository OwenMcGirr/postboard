const { spawn } = require("node:child_process");
const path = require("node:path");

function getCodexBinary() {
  return path.join(
    process.cwd(),
    "node_modules",
    "@openai",
    "codex",
    "bin",
    "codex.js"
  );
}

function extractJsonEvents(output) {
  const events = [];
  for (const line of String(output || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }

    try {
      events.push(JSON.parse(trimmed));
    } catch {}
  }
  return events;
}

function getLastAgentMessage(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === "item.completed" && event.item?.type === "agent_message") {
      return String(event.item.text || "").trim();
    }
  }
  return "";
}

function normalizeModel(model) {
  return String(model || "").trim();
}

function getLastErrorMessage(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === "error" && event.message) {
      try {
        const parsed = JSON.parse(event.message);
        const nestedMessage = parsed?.error?.message;
        if (typeof nestedMessage === "string" && nestedMessage.trim()) {
          return nestedMessage.trim();
        }
      } catch {}

      return String(event.message).trim();
    }
  }

  return "";
}

function buildArgs({ prompt, model, allowSearch }) {
  const args = [
    ...(allowSearch ? ["--search"] : []),
    "exec",
    "--skip-git-repo-check",
    "--ignore-rules",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "--color",
    "never",
    "--json",
  ];
  const selectedModel = normalizeModel(model);
  if (selectedModel) {
    args.push("-m", selectedModel);
  }
  args.push(prompt);
  return args;
}

function runCodex({ prompt, model, allowSearch = false, timeoutMs = 60000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [getCodexBinary(), ...buildArgs({ prompt, model, allowSearch })], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      if (timedOut) {
        reject(new Error("Codex inference timed out."));
        return;
      }

      const events = extractJsonEvents(stdout);
      const text = getLastAgentMessage(events);
      const eventError = getLastErrorMessage(events);

      if (code !== 0 && !text) {
        reject(new Error(eventError || String(stderr || stdout || `Codex exited with code ${code}`)));
        return;
      }

      if (!text) {
        reject(new Error("Codex returned an empty response."));
        return;
      }

      resolve({
        text,
        stdout,
        stderr,
        events,
      });
    });
  });
}

module.exports = {
  runCodex,
};
