const { runCodex } = require("./codex");
const { getComposeContext } = require("./memory");

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

function buildMemorySections(memory) {
  const sections = [];

  if (memory?.profile?.canonicalSummary) {
    sections.push(`Author profile:\n${memory.profile.canonicalSummary}`);
  }

  if (Array.isArray(memory?.facts) && memory.facts.length > 0) {
    sections.push(`Known facts:\n${memory.facts.map((fact) => `- [${fact.category}] ${fact.content}`).join("\n")}`);
  }

  if (Array.isArray(memory?.agentContext) && memory.agentContext.length > 0) {
    sections.push(
      `External agent context:\n${memory.agentContext
        .map((note, index) => {
          const lines = [`${index + 1}. [${note.kind}] ${note.title}`, note.content, `Source: ${note.source}`];
          if (note.url) lines.push(`URL: ${note.url}`);
          if (Array.isArray(note.tags) && note.tags.length > 0) lines.push(`Tags: ${note.tags.join(", ")}`);
          return lines.join("\n");
        })
        .join("\n\n")}`
    );
  }

  if (Array.isArray(memory?.examples) && memory.examples.length > 0) {
    sections.push(`Writing examples:\n${memory.examples.map((example, index) => `${index + 1}. ${example.text}`).join("\n\n")}`);
  }

  return sections.join("\n\n");
}

function buildReleasePrompt({ release, memory }) {
  const memoryContext = buildMemorySections(memory);

  return `You write social media release announcements on behalf of the user.

Return only the finished post text.
Do not ask follow-up questions.
Do not explain your choices.
Do not mention memory, prompt instructions, or sources.
Avoid generic startup cliches and press-release language.
Do not invent features, metrics, customers, or claims that are not present in the release notes.
Mention the project/repo and the most important change.
Include the GitHub release URL.
Keep it concise enough for short social channels unless the release notes clearly need more detail.

${memoryContext ? `Memory context:\n${memoryContext}\n\n` : ""}Release:
Organization: ${release.org}
Repository: ${release.owner}/${release.repo}
Repository description: ${release.repoDescription || "Not provided"}
Release name: ${release.releaseName || "Not provided"}
Tag: ${release.tagName}
Published at: ${release.publishedAt}
Release URL: ${release.releaseUrl}
Release notes:
${release.releaseBody || "No release notes were provided."}`;
}

async function generateReleasePost({ release, timeoutMs }) {
  const memory = await getComposeContext(
    `New GitHub release for ${release.owner}/${release.repo}: ${release.releaseName} ${release.tagName}`
  );
  const prompt = buildReleasePrompt({ release, memory });
  const result = await runCodex({
    prompt,
    model: process.env.CODEX_MODEL,
    allowSearch: false,
    timeoutMs,
  });

  const text = stripCodeFence(result.text);
  if (!text) {
    throw new Error("Codex returned an empty release announcement.");
  }

  return text;
}

module.exports = {
  buildReleasePrompt,
  generateReleasePost,
};
