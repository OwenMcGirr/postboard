import { useState } from "react";
import { RefreshCw, Calendar } from "lucide-react";
import { usePosts } from "@/lib/hooks";
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

function PostCard({ post }: { post: PublerPost }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-300 leading-relaxed line-clamp-2">
          {post.text ?? "(no text)"}
        </p>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border capitalize ${STATE_COLORS[post.state]}`}>
          {post.state}
        </span>
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
  const [filter, setFilter] = useState<StateFilter>("scheduled");
  const { posts, isLoading, isError, mutate } = usePosts({ state: filter });

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
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
