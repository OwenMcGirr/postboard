import { Link } from "react-router-dom";
import { PenSquare, List, Image, Calendar, Users, GitBranch, AlertCircle } from "lucide-react";
import { useMe, useAccounts, usePosts, useReleaseAnnouncements, useReleaseWatchRuns } from "@/lib/hooks";

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">{label}</span>
        <Icon className="w-4 h-4 text-gray-600" />
      </div>
      <span className="text-3xl font-bold text-white">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useMe();
  const { accounts } = useAccounts();
  const { posts: scheduled } = usePosts({ state: "scheduled" });
  const { posts: published } = usePosts({ state: "published" });
  const { announcements } = useReleaseAnnouncements(10);
  const { runs } = useReleaseWatchRuns(1);
  const latestRun = runs[0];
  const releaseScheduled = announcements.filter((announcement) => announcement.status === "scheduled").length;
  const releaseFailures = announcements.filter((announcement) => announcement.status === "failed").length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          {user ? `Hey, ${user.name.split(" ")[0]}` : "Dashboard"}
        </h1>
        <p className="text-gray-400 text-sm mt-1">Here's what's going on.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Scheduled" value={scheduled.length} icon={Calendar} />
        <StatCard label="Published" value={published.length} icon={List} />
        <StatCard label="Accounts" value={accounts.length} icon={Users} />
        <StatCard label="Release posts" value={releaseScheduled} icon={GitBranch} />
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        {[
          { href: "/compose", label: "Compose post", icon: PenSquare, desc: "Write and schedule a new post" },
          { href: "/posts", label: "View posts", icon: List, desc: "Browse your scheduled and published posts" },
          { href: "/media", label: "Media library", icon: Image, desc: "Manage your uploaded media" },
          { href: "/releases", label: "Release watcher", icon: GitBranch, desc: "Track GitHub release auto-posting" },
        ].map(({ href, label, icon: Icon, desc }) => (
          <Link
            key={href}
            to={href}
            className="bg-gray-900/50 border border-gray-800 hover:border-sky-500/50 rounded-xl p-5 transition-colors group"
          >
            <Icon className="w-5 h-5 text-sky-400 mb-3" />
            <p className="font-medium text-white group-hover:text-sky-400 transition-colors">{label}</p>
            <p className="text-sm text-gray-500 mt-1">{desc}</p>
          </Link>
        ))}
      </div>

      {(latestRun || releaseFailures > 0) && (
        <Link
          to="/releases"
          className="block bg-gray-900/50 border border-gray-800 hover:border-sky-500/50 rounded-xl p-5 transition-colors mb-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GitBranch className="w-5 h-5 text-sky-400" />
                <h2 className="text-lg font-semibold">Release watcher</h2>
              </div>
              <p className="text-sm text-gray-500">
                {latestRun
                  ? `Last run checked ${latestRun.reposChecked} repos and saw ${latestRun.releasesSeen} releases.`
                  : "No watcher runs recorded yet."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {latestRun && (
                <span className="px-2 py-1 rounded-full border border-gray-700 text-gray-300">
                  {latestRun.status.replaceAll("_", " ")}
                </span>
              )}
              {releaseFailures > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {releaseFailures} failed
                </span>
              )}
            </div>
          </div>
        </Link>
      )}

      {scheduled.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Upcoming</h2>
          <div className="space-y-3">
            {scheduled.slice(0, 5).map((post) => (
              <div key={post.id} className="bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <p className="text-sm text-gray-300 truncate">{post.text ?? "(no text)"}</p>
                {post.scheduled_at && (
                  <span className="text-xs text-gray-500 shrink-0">
                    {new Date(post.scheduled_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
