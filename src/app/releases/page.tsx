import {
  AlertCircle,
  CalendarClock,
  CheckCircle,
  Clock,
  ExternalLink,
  GitBranch,
  RefreshCw,
  SkipForward,
  XCircle,
} from "lucide-react";
import { useReleaseAnnouncements, useReleaseWatchRuns } from "@/lib/hooks";
import type { ReleaseAnnouncement, ReleaseWatchRun } from "@/lib/release-types";

function formatDate(value?: string | number) {
  if (!value) return "Not set";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function statusClasses(status: string) {
  if (status === "scheduled" || status === "completed") return "bg-green-500/10 text-green-400 border-green-500/20";
  if (status === "running" || status === "reserved") return "bg-sky-500/10 text-sky-400 border-sky-500/20";
  if (status === "skipped") return "bg-gray-500/10 text-gray-400 border-gray-500/20";
  if (status === "completed_with_failures") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (status === "failed") return "bg-red-500/10 text-red-400 border-red-500/20";
  return "bg-gray-800 text-gray-300 border-gray-700";
}

function statusIcon(status: string) {
  if (status === "scheduled" || status === "completed") return CheckCircle;
  if (status === "running" || status === "reserved") return RefreshCw;
  if (status === "skipped") return SkipForward;
  if (status === "failed") return XCircle;
  return AlertCircle;
}

function StatusBadge({ status }: { status: string }) {
  const Icon = statusIcon(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${statusClasses(status)}`}>
      <Icon className={`w-3.5 h-3.5 ${status === "running" ? "animate-spin" : ""}`} />
      {status.replaceAll("_", " ")}
    </span>
  );
}

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

function RunSummary({ run }: { run?: ReleaseWatchRun }) {
  if (!run) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-2">Watcher status</h2>
        <p className="text-sm text-gray-500">No release watcher runs have been recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Latest watcher run</h2>
          <p className="text-sm text-gray-500 mt-1">
            {run.orgs.join(", ")} · started {formatDate(run.startedAt)}
          </p>
        </div>
        <StatusBadge status={run.status} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div>
          <p className="text-gray-500">Repos</p>
          <p className="text-white font-semibold">{run.reposChecked}</p>
        </div>
        <div>
          <p className="text-gray-500">Releases</p>
          <p className="text-white font-semibold">{run.releasesSeen}</p>
        </div>
        <div>
          <p className="text-gray-500">Scheduled</p>
          <p className="text-white font-semibold">{run.announcementsCreated}</p>
        </div>
        <div>
          <p className="text-gray-500">Skipped</p>
          <p className="text-white font-semibold">{run.announcementsSkipped}</p>
        </div>
        <div>
          <p className="text-gray-500">Failed</p>
          <p className="text-white font-semibold">{run.announcementsFailed}</p>
        </div>
      </div>

      {run.error && (
        <p className="mt-4 text-sm text-red-400 flex gap-2">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {run.error}
        </p>
      )}
    </div>
  );
}

function AnnouncementCard({ announcement }: { announcement: ReleaseAnnouncement }) {
  return (
    <article className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold text-white">
              {announcement.owner}/{announcement.repo}
            </h3>
            <span className="text-xs text-gray-500">{announcement.tagName}</span>
          </div>
          <p className="text-sm text-gray-400">{announcement.releaseName || "Unnamed release"}</p>
        </div>
        <StatusBadge status={announcement.status} />
      </div>

      <div className="grid md:grid-cols-3 gap-3 text-xs text-gray-500">
        <p>
          <span className="text-gray-400">Detected:</span> {formatDate(announcement.detectedAt)}
        </p>
        <p>
          <span className="text-gray-400">Published:</span> {formatDate(announcement.publishedAt)}
        </p>
        <p>
          <span className="text-gray-400">Scheduled:</span> {formatDate(announcement.scheduledAt)}
        </p>
      </div>

      {announcement.postText && (
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Generated post</p>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{announcement.postText}</p>
        </div>
      )}

      {announcement.error && (
        <p className={`text-sm ${announcement.status === "skipped" ? "text-gray-400" : "text-red-400"}`}>
          {announcement.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <a
          href={announcement.releaseUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 transition-colors"
        >
          GitHub release
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        {announcement.publerJobId && <span className="text-gray-500">Publer job: {announcement.publerJobId}</span>}
      </div>
    </article>
  );
}

export default function ReleasesPage() {
  const { announcements, isLoading: announcementsLoading, isError: announcementsError, mutate: refreshAnnouncements } =
    useReleaseAnnouncements(50);
  const { runs, isLoading: runsLoading, isError: runsError, mutate: refreshRuns } = useReleaseWatchRuns(10);

  const scheduled = announcements.filter((announcement) => announcement.status === "scheduled").length;
  const failed = announcements.filter((announcement) => announcement.status === "failed").length;
  const skipped = announcements.filter((announcement) => announcement.status === "skipped").length;
  const latestRun = runs[0];
  const loading = announcementsLoading || runsLoading;

  async function refresh() {
    await Promise.all([refreshAnnouncements(), refreshRuns()]);
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Release watcher</h1>
          <p className="text-gray-400 text-sm mt-1">
            GitHub releases from Timberlogs and Switchify, generated with Codex and scheduled through Publer.
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {(announcementsError || runsError) && (
        <p className="text-sm text-red-400 flex items-center gap-1.5">
          <XCircle className="w-4 h-4" />
          Failed to load release watcher state.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Scheduled" value={scheduled} icon={CalendarClock} />
        <StatCard label="Skipped" value={skipped} icon={SkipForward} />
        <StatCard label="Failed" value={failed} icon={XCircle} />
        <StatCard label="Last run" value={latestRun ? formatDate(latestRun.startedAt) : "Never"} icon={Clock} />
      </div>

      <RunSummary run={latestRun} />

      <div>
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-semibold">Recent announcements</h2>
        </div>

        {loading && announcements.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-40 bg-gray-900/50 border border-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && announcements.length === 0 && !announcementsError && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
            <GitBranch className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No release announcements have been recorded yet.</p>
            <p className="text-xs text-gray-600 mt-1">The first enabled worker run will baseline existing releases.</p>
          </div>
        )}

        {announcements.length > 0 && (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <AnnouncementCard key={announcement._id} announcement={announcement} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
