import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Calendar, Trash2, Bookmark, CheckCircle } from "lucide-react";
import { useAccounts, useMemoryExamples, usePosts } from "@/lib/hooks";
import { usePublerClient } from "@/lib/use-publer-client";
import { PublerAccount, PublerPost } from "@/lib/publer-api";
import { importPostsAsExamples } from "@/lib/memory-client";
import { isMemoryConfigured } from "@/lib/convex";

type StateFilter = "scheduled" | "published" | "draft";

const FILTERS: { label: string; value: StateFilter }[] = [
  { label: "Published", value: "published" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Draft", value: "draft" },
];

const STATE_COLORS: Record<StateFilter, string> = {
  scheduled: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  published: "bg-green-500/10 text-green-400 border-green-500/20",
  draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

function normalizePostText(text?: string) {
  return String(text || "").trim();
}

function PostCard({
  post,
  onDelete,
  canImport,
  selected,
  savedToMemory,
  importDisabled,
  onToggleSelect,
  onSaveToMemory,
}: {
  post: PublerPost;
  onDelete: (id: string) => Promise<void>;
  canImport: boolean;
  selected: boolean;
  savedToMemory: boolean;
  importDisabled: boolean;
  onToggleSelect: () => void;
  onSaveToMemory: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    await onDelete(post.id);
    setDeleting(false);
  }

  async function handleSaveToMemory() {
    setSaving(true);
    await onSaveToMemory();
    setSaving(false);
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          {canImport && (
            <input
              type="checkbox"
              checked={selected}
              disabled={savedToMemory || importDisabled}
              onChange={onToggleSelect}
              className="mt-1 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-sky-500 disabled:opacity-40"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
              {post.text ?? "(no text)"}
            </p>
            {Array.isArray(post.accounts) && post.accounts.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {post.accounts.map((account) => account.name).join(", ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canImport && savedToMemory && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${STATE_COLORS[post.state]}`}>
            {post.state}
          </span>
          {canImport && !savedToMemory && (
            <button
              onClick={handleSaveToMemory}
              disabled={importDisabled || saving}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-40"
            >
              <Bookmark className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Save"}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            onBlur={() => setConfirmDelete(false)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors disabled:opacity-40 ${
              confirmDelete
                ? "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30"
                : "text-gray-500 border-gray-700 hover:text-red-400 hover:border-red-500/40"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmDelete ? "Confirm" : "Delete"}
          </button>
        </div>
      </div>
      {(post.scheduled_at || post.created_at) && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(post.scheduled_at ?? post.created_at ?? "").toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default function PostsPage() {
  const client = usePublerClient();
  const memoryEnabled = isMemoryConfigured();
  const [filter, setFilter] = useState<StateFilter>("published");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { posts, isLoading, isError, mutate } = usePosts({ state: filter, accountIds: selectedAccountIds });
  const { examples, mutate: mutateExamples } = useMemoryExamples(memoryEnabled);

  useEffect(() => {
    setSelectedPostIds([]);
    setFeedback("");
    setError("");
  }, [filter, selectedAccountIds.join(",")]);

  const savedSourcePostIds = useMemo(
    () =>
      new Set(
        examples
          .map((example) => example.sourcePostId)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      ),
    [examples]
  );

  const savedTexts = useMemo(
    () => new Set(examples.map((example) => normalizePostText(example.text)).filter(Boolean)),
    [examples]
  );

  const importablePosts = useMemo(
    () =>
      posts.filter((post) => {
        const text = normalizePostText(post.text);
        return text.length >= 20;
      }),
    [posts]
  );

  const importablePostMap = useMemo(
    () => new Map(importablePosts.map((post) => [post.id, post])),
    [importablePosts]
  );

  function postIsSaved(post: PublerPost) {
    return savedSourcePostIds.has(post.id) || savedTexts.has(normalizePostText(post.text));
  }

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  }

  function toggleSelectedPost(postId: string) {
    setSelectedPostIds((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  }

  async function handleDelete(id: string) {
    await client.deletePosts([id]);
    mutate();
  }

  async function savePosts(postsToImport: PublerPost[]) {
    if (postsToImport.length === 0) return;
    setImporting(true);
    setFeedback("");
    setError("");

    try {
      const result = await importPostsAsExamples(
        postsToImport.map((post) => ({
          id: post.id,
          text: post.text ?? "",
          accountIds: Array.isArray(post.accounts) ? post.accounts.map((account) => account.id) : [],
          accountNames: Array.isArray(post.accounts) ? post.accounts.map((account) => account.name) : [],
          publishedAt: post.created_at,
        }))
      );

      setSelectedPostIds([]);
      setFeedback(
        `Imported ${result.imported} post${result.imported === 1 ? "" : "s"} and skipped ${result.skipped}.`
      );
      await mutateExamples();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import posts into memory.");
    } finally {
      setImporting(false);
    }
  }

  const selectedImportablePosts = selectedPostIds
    .map((postId) => importablePostMap.get(postId))
    .filter((post): post is PublerPost => Boolean(post));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-sm text-gray-400 mt-1">
            Browse past posts and save strong published examples into memory.
          </p>
        </div>
        <button
          onClick={() => {
            mutate();
            mutateExamples();
          }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === value
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                : "text-gray-400 hover:text-white border border-transparent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-6 space-y-3">
        <div>
          <p className="text-sm font-medium text-white">Accounts</p>
          <p className="text-xs text-gray-500 mt-1">Filter published posts by the accounts you want the AI to learn from.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedAccountIds([])}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectedAccountIds.length === 0
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            All accounts
          </button>
          {!accountsLoading &&
            accounts.map((account: PublerAccount) => {
              const active = selectedAccountIds.includes(account.id);
              return (
                <button
                  key={account.id}
                  onClick={() => toggleAccount(account.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                      : "bg-gray-900 border border-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {account.name}
                </button>
              );
            })}
        </div>
      </div>

      {memoryEnabled && filter === "published" && (
        <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Learn from past posts</p>
              <p className="text-xs text-gray-500 mt-1">
                Select published posts you want treated as writing examples during compose.
              </p>
            </div>
            <button
              onClick={() => savePosts(selectedImportablePosts)}
              disabled={selectedImportablePosts.length === 0 || importing}
              className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Bookmark className="w-4 h-4" />
              {importing ? "Saving..." : `Save selected to memory (${selectedImportablePosts.length})`}
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setSelectedPostIds(importablePosts.filter((post) => !postIsSaved(post)).map((post) => post.id))}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Select all importable
            </button>
            <button
              onClick={() => setSelectedPostIds([])}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Clear selection
            </button>
          </div>
          {feedback && <p className="text-sm text-green-400">{feedback}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {!memoryEnabled && filter === "published" && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100/90">
          Configure Convex memory to import past posts as writing examples.
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      )}

      {isError && <p className="text-red-400 text-sm">Failed to load posts.</p>}

      {!isLoading && !isError && posts.length === 0 && (
        <p className="text-gray-500 text-sm">No {filter} posts found.</p>
      )}

      {!isLoading && !isError && (
        <div className="space-y-3">
          {posts.map((post) => {
            const savedToMemory = postIsSaved(post);
            const canImport = memoryEnabled && filter === "published";

            return (
              <PostCard
                key={post.id}
                post={post}
                onDelete={handleDelete}
                canImport={canImport}
                selected={selectedPostIds.includes(post.id)}
                savedToMemory={savedToMemory}
                importDisabled={importing || normalizePostText(post.text).length < 20}
                onToggleSelect={() => toggleSelectedPost(post.id)}
                onSaveToMemory={() => savePosts([post])}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
