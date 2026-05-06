import { useEffect, useState } from "react";
import { anyApi } from "convex/server";
import { useQuery } from "convex/react";
import { Brain, CheckCircle, Loader, Search, Sparkles } from "lucide-react";
import {
  answerInterview,
  completeInterview,
  importLegacyProfile,
  previewResearch,
  saveResearch,
  startInterview,
  updateCanonicalSummary,
} from "@/lib/memory-client";
import { isMemoryConfigured } from "@/lib/convex";
import { ResearchFinding, SettingsState } from "@/lib/memory-types";
import {
  getUserProfile,
  hasUserProfileMigrationRun,
  markUserProfileMigrated,
} from "@/lib/user-profile";

export default function SettingsPage() {
  if (!isMemoryConfigured()) {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-gray-400 text-sm mt-0.5">Memory is not configured yet.</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-2">
          <p className="text-sm font-medium text-amber-200">Convex is required for memory.</p>
          <p className="text-sm text-amber-100/80">
            Set <code>CONVEX_URL</code> on the server and <code>VITE_CONVEX_URL</code> for the client,
            then reload the app.
          </p>
        </div>
      </div>
    );
  }

  return <MemorySettingsPage />;
}

function MemorySettingsPage() {
  const state = useQuery((anyApi).memory.getSettingsState) as SettingsState | undefined;
  const [summaryDraft, setSummaryDraft] = useState("");
  const [answer, setAnswer] = useState("");
  const [researchTarget, setResearchTarget] = useState("");
  const [researchPreviewResults, setResearchPreviewResults] = useState<ResearchFinding[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const profile = state?.profile;
  const interview = state?.interview;
  const examples = state?.examples ?? [];
  const facts = state?.facts ?? [];
  const sources = state?.sources ?? [];

  useEffect(() => {
    setSummaryDraft(profile?.canonicalSummary ?? "");
  }, [profile?.canonicalSummary]);

  useEffect(() => {
    if (!state || hasUserProfileMigrationRun()) {
      return;
    }

    const legacyProfile = getUserProfile().trim();
    if (!legacyProfile || profile?.canonicalSummary.trim()) {
      markUserProfileMigrated();
      return;
    }

    void (async () => {
      try {
        await importLegacyProfile(legacyProfile);
      } finally {
        markUserProfileMigrated();
      }
    })();
  }, [profile?.canonicalSummary, state]);

  const currentQuestionId = interview?.messages?.length
    ? [...interview.messages].reverse().find((message) => message.role === "assistant")?.questionId ?? ""
    : "";

  async function runAction(name: string, fn: () => Promise<void>) {
    setBusyAction(name);
    setError("");
    setSaved("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Memory</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Teach Postboard who you are, how you sound, and what should carry forward into drafts.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-400">{saved}</p>}

      <section className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Author memory</p>
            <p className="text-xs text-gray-400 mt-1">
              {profile?.status === "ready"
                ? "Your canonical profile, structured facts, and saved examples are active."
                : "Start the interview to build the first version of your author memory."}
            </p>
          </div>
          <button
            onClick={() => runAction("start-interview", async () => {
              await startInterview();
              setSaved("Interview started.");
            })}
            disabled={busyAction === "start-interview"}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
          >
            {busyAction === "start-interview" ? <Loader className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {interview ? "Restart interview" : "Start interview"}
          </button>
        </div>

        {interview ? (
          <div className="space-y-4">
            <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-950/80 p-4">
              {interview.messages.map((message) => (
                <div
                  key={message._id}
                  className={`rounded-xl px-4 py-3 text-sm ${
                    message.role === "assistant"
                      ? "bg-gray-900 text-gray-100"
                      : "ml-auto max-w-[90%] bg-sky-500/15 text-sky-100"
                  }`}
                >
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">
                    {message.role === "assistant" ? "Interview" : "You"}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!interview || !answer.trim() || !currentQuestionId) return;
                void runAction("answer-interview", async () => {
                  const result = await answerInterview(interview.session._id, currentQuestionId, answer.trim());
                  setAnswer("");
                  if (result.readyToComplete) {
                    await completeInterview(interview.session._id);
                    setSaved("Interview completed and memory updated.");
                  }
                });
              }}
              className="space-y-3"
            >
              <textarea
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                rows={4}
                placeholder="Write your answer..."
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 transition-colors focus:border-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!answer.trim() || busyAction === "answer-interview"}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
              >
                {busyAction === "answer-interview" ? <Loader className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Send answer
              </button>
            </form>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-800 bg-gray-950/80 p-4 text-sm text-gray-300">
            {profile?.canonicalSummary
              ? "The interview is idle. You can restart it whenever your positioning or style changes."
              : "No interview transcript yet."}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-white">Canonical writing profile</p>
          <p className="text-xs text-gray-400 mt-1">
            This is the summary injected into compose requests before Codex drafts the post.
          </p>
        </div>
        <textarea
          value={summaryDraft}
          onChange={(event) => setSummaryDraft(event.target.value)}
          rows={8}
          placeholder="Complete the interview, or write your own canonical profile here."
          className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white placeholder-gray-500 transition-colors focus:border-sky-500 focus:outline-none"
        />
        <button
          onClick={() =>
            runAction("save-summary", async () => {
              await updateCanonicalSummary(summaryDraft, profile?.displayName ?? "");
              setSaved("Canonical profile saved.");
            })
          }
          disabled={busyAction === "save-summary"}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
        >
          {busyAction === "save-summary" ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Save profile
        </button>
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-white">Research me online</p>
          <p className="text-xs text-gray-400 mt-1">
            This runs a one-off Codex web search and lets you save only the findings you want in memory.
          </p>
        </div>
        <div className="flex gap-3">
          <input
            value={researchTarget}
            onChange={(event) => setResearchTarget(event.target.value)}
            placeholder="Name, company, handle, website, or search target"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-500 transition-colors focus:border-sky-500 focus:outline-none"
          />
          <button
            onClick={() =>
              runAction("preview-research", async () => {
                const result = await previewResearch(researchTarget.trim());
                setResearchPreviewResults(result.findings);
                setSaved(`Fetched ${result.findings.length} research finding${result.findings.length === 1 ? "" : "s"}.`);
              })
            }
            disabled={!researchTarget.trim() || busyAction === "preview-research"}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
          >
            {busyAction === "preview-research" ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Research
          </button>
        </div>

        {researchPreviewResults.length > 0 && (
          <div className="space-y-3">
            {researchPreviewResults.map((finding) => (
              <div key={`${finding.sourceUrl}-${finding.title}`} className="rounded-xl border border-gray-800 bg-gray-950/80 p-4">
                <p className="text-sm font-medium text-white">{finding.title}</p>
                <p className="mt-1 text-sm text-gray-300">{finding.summary}</p>
                <a
                  href={finding.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-sky-400 hover:text-sky-300"
                >
                  {finding.sourceUrl}
                </a>
              </div>
            ))}
            <button
              onClick={() =>
                runAction("save-research", async () => {
                  await saveResearch(researchTarget.trim(), researchPreviewResults);
                  setResearchPreviewResults([]);
                  setSaved("Research findings saved to memory.");
                })
              }
              disabled={busyAction === "save-research"}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              {busyAction === "save-research" ? <Loader className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Save findings
            </button>
          </div>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-sm font-medium text-white mb-3">Structured facts</p>
          <div className="space-y-2">
            {facts.length > 0 ? (
              facts.map((fact) => (
                <div key={fact._id} className="rounded-lg border border-gray-800 bg-gray-950/80 px-3 py-2 text-sm">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">{fact.category}</p>
                  <p className="mt-1 text-gray-200">{fact.content}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No structured facts saved yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-sm font-medium text-white mb-3">Saved writing examples</p>
          <div className="space-y-2">
            {examples.length > 0 ? (
              examples.map((example) => (
                <div key={example._id} className="rounded-lg border border-gray-800 bg-gray-950/80 px-3 py-2 text-sm text-gray-200">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">{example.label}</p>
                  <p className="mt-1 whitespace-pre-wrap">{example.text}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">Save approved drafts from Compose to build stronger examples.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
        <p className="text-sm font-medium text-white mb-3">Research notes</p>
        <div className="space-y-2">
          {sources.length > 0 ? (
            sources.map((source) => (
              <div key={source._id} className="rounded-lg border border-gray-800 bg-gray-950/80 px-3 py-2 text-sm">
                <p className="font-medium text-white">{source.title}</p>
                <p className="mt-1 text-gray-300">{source.summary}</p>
                <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-sky-400 hover:text-sky-300">
                  {source.sourceUrl}
                </a>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No research findings have been saved yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
