import { useState } from "react";
import { CheckCircle, XCircle, Loader, Send } from "lucide-react";
import { useAccounts, useJobStatus } from "@/lib/hooks";
import { usePublerClient } from "@/lib/use-publer-client";

export default function ComposePage() {
  const client = usePublerClient();
  const { accounts, isLoading: accountsLoading } = useAccounts();

  const [text, setText] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { status } = useJobStatus(jobId);

  function toggleAccount(id: string) {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  async function submit() {
    if (!client || !text.trim() || selectedAccounts.length === 0 || !scheduledAt) return;
    setSubmitting(true);
    setError("");
    setJobId(null);
    try {
      const result = await client.schedulePost({
        bulk: {
          state: "scheduled",
          posts: [
            {
              networks: { linkedin: { type: "status", text: text.trim() } },
              accounts: selectedAccounts.map((id) => ({
                id,
                scheduled_at: new Date(scheduledAt).toISOString(),
              })),
            },
          ],
        },
      });
      setJobId(result.job_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule post");
    } finally {
      setSubmitting(false);
    }
  }

  const isDone = status === "completed" || status === "failed";

  if (isDone && status === "completed") {
    return (
      <div className="max-w-lg">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-white mb-1">Post scheduled!</h2>
          <p className="text-gray-400 text-sm mb-4">Your post has been queued successfully.</p>
          <button
            onClick={() => { setText(""); setSelectedAccounts([]); setScheduledAt(""); setJobId(null); }}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Compose another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-1">Compose</h1>
      <p className="text-gray-400 text-sm mb-8">Schedule a post to your connected accounts.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Post text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={3000}
            placeholder="What do you want to share?"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors resize-none"
          />
          <p className="text-xs text-gray-600 mt-1 text-right">{text.length}/3000</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Accounts</label>
          {accountsLoading ? (
            <p className="text-sm text-gray-500">Loading accounts...</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-gray-500">No accounts found.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <label key={account.id} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(account.id)}
                    onChange={() => toggleAccount(account.id)}
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
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 flex items-center gap-1.5">
            <XCircle className="w-4 h-4" /> {error}
          </p>
        )}

        {jobId && status === "pending" && (
          <p className="text-sm text-sky-400 flex items-center gap-1.5">
            <Loader className="w-4 h-4 animate-spin" /> Scheduling post...
          </p>
        )}

        {status === "failed" && (
          <p className="text-sm text-red-400 flex items-center gap-1.5">
            <XCircle className="w-4 h-4" /> Post failed to schedule.
          </p>
        )}

        <button
          onClick={submit}
          disabled={!text.trim() || selectedAccounts.length === 0 || !scheduledAt || submitting || !!jobId}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Send className="w-4 h-4" />
          Schedule post
        </button>
      </div>
    </div>
  );
}
