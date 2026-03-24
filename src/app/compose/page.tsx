import { useState, useRef } from "react";
import { Sparkles, RefreshCw, Send, X, CheckCircle, XCircle, Loader } from "lucide-react";
import { useAccounts, useJobStatus } from "@/lib/hooks";
import { usePublerClient } from "@/lib/use-publer-client";
import { streamPost, Message } from "@/lib/ai-client";

type Stage = "brief" | "compose" | "schedule" | "done";

export default function ComposePage() {
  const client = usePublerClient();
  const { accounts, isLoading: accountsLoading } = useAccounts();

  const [stage, setStage] = useState<Stage>("brief");
  const [brief, setBrief] = useState("");
  const [postText, setPostText] = useState("");
  const [refinement, setRefinement] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiError, setAiError] = useState("");

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const { status } = useJobStatus(jobId);
  const abortRef = useRef(false);

  function generate(userMessage: string, isRefinement = false) {
    const previousPostText = postText;
    abortRef.current = false;
    setAiError("");
    setStreaming(true);
    if (!isRefinement) {
      setPostText("");
    }
    setStage("compose");

    const content = isRefinement
      ? `Refine the post above. Instruction: ${userMessage}`
      : userMessage;

    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);

    let buffer = "";
    streamPost(
      newMessages,
      (chunk) => {
        if (abortRef.current) return;
        buffer += chunk;
        setPostText(buffer);
      },
      () => {
        setStreaming(false);
        setMessages((prev) => [...prev, { role: "assistant", content: buffer }]);
      },
      (err) => {
        setStreaming(false);
        setAiError(err.message || "AI generation failed.");
        if (isRefinement) {
          setPostText(previousPostText);
        }
      }
    );
  }

  function handleBriefSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brief.trim()) return;
    generate(brief.trim());
  }

  function handleRefine(e: React.FormEvent) {
    e.preventDefault();
    if (!refinement.trim() || streaming) return;
    const instruction = refinement.trim();
    setRefinement("");
    generate(instruction, true);
  }

  function reset() {
    abortRef.current = true;
    setStage("brief");
    setBrief("");
    setPostText("");
    setRefinement("");
    setMessages([]);
    setSelectedAccounts([]);
    setScheduledAt("");
    setJobId(null);
    setSubmitError("");
    setAiError("");
    setStreaming(false);
  }

  async function scheduleAt(isoTimestamp: string) {
    if (!postText.trim() || selectedAccounts.length === 0) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const selectedAccountObjects = accounts.filter((a) => selectedAccounts.includes(a.id));
      const networks = Object.fromEntries(
        [...new Set(selectedAccountObjects.map((a) => a.provider))].map((provider) => [
          provider,
          { type: "status", text: postText.trim() },
        ])
      );

      const result = await client.schedulePost({
        bulk: {
          state: "scheduled",
          posts: [
            {
              networks,
              accounts: selectedAccounts.map((id) => ({
                id,
                scheduled_at: isoTimestamp,
              })),
            },
          ],
        },
      });
      setJobId(result.job_id);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to schedule");
    } finally {
      setSubmitting(false);
    }
  }

  async function schedule() {
    if (!scheduledAt) return;
    await scheduleAt(new Date(scheduledAt).toISOString());
  }

  async function postNow() {
    await scheduleAt(new Date(Date.now() + 2 * 60 * 1000).toISOString());
  }

  if (status === "complete") {
    return (
      <div className="max-w-2xl">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Post scheduled!</h2>
          <p className="text-gray-400 text-sm mb-6">Your post has been queued successfully.</p>
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Write another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compose</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {stage === "brief" && "Describe what you want to post about."}
            {stage === "compose" && "Edit, refine, then schedule when you're happy."}
            {stage === "schedule" && "Choose your accounts and time."}
          </p>
        </div>
        {stage !== "brief" && (
          <button onClick={reset} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Brief input */}
      {stage === "brief" && (
        <form onSubmit={handleBriefSubmit} className="space-y-3">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            autoFocus
            placeholder="e.g. Share some thoughts on how Timberlogs helps developers catch bugs faster..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleBriefSubmit(e); }}
          />
          <button
            type="submit"
            disabled={!brief.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generate post
          </button>
        </form>
      )}

      {/* Generated post */}
      {stage !== "brief" && (
        <div className="space-y-4">
          {aiError && (
            <p className="text-sm text-red-400 flex items-center gap-1.5">
              <XCircle className="w-4 h-4 shrink-0" />
              {aiError}
            </p>
          )}

          <div className="relative">
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={10}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors resize-none"
            />
            {streaming && (
              <div className="absolute bottom-3 right-3">
                <div className="w-2 h-4 bg-sky-400 animate-pulse rounded-sm" />
              </div>
            )}
            <p className="text-xs text-gray-600 mt-1 text-right">{postText.length} chars</p>
          </div>

          {/* Refinement */}
          {!streaming && stage === "compose" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {[
                  "Flesh it out",
                  "Make it shorter",
                  "Add a hook",
                  "More casual",
                  "More professional",
                  "Add a CTA",
                  "Remove emojis",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => generate(q, true)}
                    className="px-3 py-1.5 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white rounded-full border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <form onSubmit={handleRefine} className="flex gap-2">
                <input
                  type="text"
                  value={refinement}
                  onChange={(e) => setRefinement(e.target.value)}
                  placeholder="Custom instruction..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!refinement.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refine
                </button>
              </form>
            </div>
          )}

          {/* Action buttons */}
          {!streaming && (
            <div className="flex gap-3">
              <button
                onClick={() => setStage("schedule")}
                className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
                Schedule this post
              </button>
              <button
                onClick={() => { setMessages([]); generate(brief); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Regenerate
              </button>
            </div>
          )}
        </div>
      )}

      {/* Schedule panel */}
      {stage === "schedule" && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Accounts</label>
            {accountsLoading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <label key={account.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(account.id)}
                      onChange={() =>
                        setSelectedAccounts((prev) =>
                          prev.includes(account.id)
                            ? prev.filter((a) => a !== account.id)
                            : [...prev, account.id]
                        )
                      }
                      className="rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-sky-500"
                    />
                    {account.picture && (
                      <img src={account.picture} alt="" className="w-6 h-6 rounded-full" />
                    )}
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                      {account.name}
                      <span className="text-gray-500 ml-1 text-xs capitalize">({account.provider})</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Schedule for</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-400 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> {submitError}
            </p>
          )}
          {jobId && (status === "pending" || !status) && (
            <p className="text-sm text-sky-400 flex items-center gap-1.5">
              <Loader className="w-4 h-4 animate-spin" /> Scheduling...
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={schedule}
              disabled={!postText.trim() || selectedAccounts.length === 0 || !scheduledAt || submitting || !!jobId}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              Confirm & schedule
            </button>
            <button
              onClick={postNow}
              disabled={!postText.trim() || selectedAccounts.length === 0 || submitting || !!jobId}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              Post now
            </button>
            <button
              onClick={() => setStage("compose")}
              className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Back to edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
