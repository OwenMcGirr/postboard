import { useState } from "react";
import { RefreshCw, Calendar, Trash2 } from "lucide-react";
import { usePosts } from "@/lib/hooks";
import { usePublerClient } from "@/lib/use-publer-client";
import { PublerPost } from "@/lib/publer-api";

type StateFilter = "scheduled" | "published" | "draft";

const FILTERS: { label: string; value: StateFilter }[] = [
  { label: "Scheduled", value: "scheduled" },
  { label: "Published", value: "published" },
  { label: "Draft", value: "draft" },
];

const STATE_COLORS: Record<StateFilter, string> = {
  scheduled: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  published: "bg-green-500/10 text-green-400 border-green-500/20",
  draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

function PostCard({ post, onDelete }: { post: PublerPost; onDelete: (id: string) => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    await onDelete(post.id);
    setDeleting(false);
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-300 leading-relaxed line-clamp-2">
          {post.text ?? "(no text)"}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${STATE_COLORS[post.state]}`}>
            {post.state}
          </span>
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
      {post.scheduled_at && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(post.scheduled_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default function PostsPage() {
  const client = usePublerClient();
  const [filter, setFilter] = useState<StateFilter>("scheduled");
  const { posts, isLoading, isError, mutate } = usePosts({ state: filter });

  async function handleDelete(id: string) {
    await client.deletePosts([id]);
    mutate();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Posts</h1>
        <button
          onClick={() => mutate()}
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

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-red-400 text-sm">Failed to load posts.</p>
      )}

      {!isLoading && !isError && posts.length === 0 && (
        <p className="text-gray-500 text-sm">No {filter} posts found.</p>
      )}

      {!isLoading && !isError && (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
