import { useState, useRef } from "react";
import {
  Sparkles,
  RefreshCw,
  Send,
  X,
  CheckCircle,
  XCircle,
  Loader,
  Bookmark,
  Upload,
  Image as ImageIcon,
  Video,
} from "lucide-react";
import { useAccounts, useJobStatus, useMedia } from "@/lib/hooks";
import { usePublerClient } from "@/lib/use-publer-client";
import { streamPost, Message } from "@/lib/ai-client";
import { isMemoryConfigured } from "@/lib/convex";
import { saveWritingExample } from "@/lib/memory-client";
import type { PublerMedia, PublerMediaThumbnail, SchedulePostMedia } from "@/lib/publer-api";

type Stage = "brief" | "compose" | "schedule" | "done";
type MediaPostType = "photo" | "video";

const COMPOSE_MEDIA_TYPES = ["photo", "video"];

function getMediaPostType(media: PublerMedia): MediaPostType | null {
  if (media.type === "photo" || media.type === "video") {
    return media.type;
  }
  return null;
}

function getMediaPreviewUrl(media: PublerMedia) {
  if (media.thumbnail) return media.thumbnail;
  if (Array.isArray(media.thumbnails)) {
    const thumbnail = media.thumbnails.find((item) => item.small || item.real);
    return thumbnail?.small || thumbnail?.real || media.path;
  }
  if (media.thumbnails) {
    const thumbnail = Object.values(media.thumbnails).find(Boolean);
    return thumbnail || media.path;
  }
  return media.path;
}

function getVideoThumbnails(media: PublerMedia): PublerMediaThumbnail[] {
  if (!Array.isArray(media.thumbnails)) {
    return [];
  }
  return media.thumbnails.filter((thumbnail) => thumbnail.id || thumbnail.small || thumbnail.real);
}

function validateMediaSelection(media: PublerMedia[]) {
  const types = media.map(getMediaPostType).filter(Boolean);
  if (types.length !== media.length) {
    return "Only Publer photo and video media can be attached in Compose.";
  }

  const uniqueTypes = new Set(types);
  if (uniqueTypes.size > 1) {
    return "Choose either photos or one video. Mixed photo/video posts are not supported yet.";
  }

  if (types.filter((type) => type === "video").length > 1) {
    return "Only one video can be attached to a post.";
  }

  return "";
}

function validateSchedulableMedia(media: PublerMedia[]) {
  const selectionError = validateMediaSelection(media);
  if (selectionError) return selectionError;

  const video = media.find((item) => getMediaPostType(item) === "video");
  if (video && getVideoThumbnails(video).length === 0) {
    return "This video is missing Publer thumbnail metadata. Pick a different library video or upload it again.";
  }

  return "";
}

function buildScheduleMedia(media: PublerMedia[]): SchedulePostMedia[] {
  const scheduleMedia: SchedulePostMedia[] = [];

  for (const item of media) {
    const type = getMediaPostType(item);
    if (type === "photo") {
      scheduleMedia.push({ id: item.id, type });
      continue;
    }

    if (type === "video") {
      const thumbnails = getVideoThumbnails(item);
      scheduleMedia.push({
        id: item.id,
        type,
        thumbnails,
        default_thumbnail: 0,
        title: item.name,
      });
    }
  }

  return scheduleMedia;
}

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
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [exampleSaved, setExampleSaved] = useState(false);
  const [exampleSaving, setExampleSaving] = useState(false);

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<PublerMedia[]>([]);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const {
    media: libraryMedia,
    isLoading: mediaLoading,
    isError: mediaLibraryError,
    mutate: mutateMedia,
  } = useMedia(
    { types: COMPOSE_MEDIA_TYPES, search: mediaSearch.trim() || undefined },
    stage === "schedule" && mediaPickerOpen
  );

  const { status } = useJobStatus(jobId);
  const abortRef = useRef(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const memoryEnabled = isMemoryConfigured();

  function generate(userMessage: string, isRefinement = false) {
    const previousPostText = postText;
    abortRef.current = false;
    setAiError("");
    setActivityLog([]);
    setStreaming(true);
    setExampleSaved(false);
    if (!isRefinement) {
      setPostText("");
    }
    setStage("compose");

    const content = isRefinement
      ? `Refine the post above. Instruction: ${userMessage}`
      : userMessage;

    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    let finalText = previousPostText;

    streamPost(
      newMessages,
      (activity) => {
        if (abortRef.current) return;
        setActivityLog((prev) => {
          if (prev[prev.length - 1] === activity.text) {
            return prev;
          }

          const next = [...prev, activity.text];
          return next.slice(-12);
        });
      },
      (text) => {
        if (abortRef.current) return;
        finalText = text;
        setPostText(text);
      },
      () => {
        setStreaming(false);
        setMessages((prev) => [...prev, { role: "assistant", content: finalText }]);
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
    setSelectedMedia([]);
    setMediaPickerOpen(false);
    setUploadingMedia(false);
    setMediaError("");
    setMediaSearch("");
    setScheduledAt("");
    setJobId(null);
    setSubmitError("");
    setAiError("");
    setStreaming(false);
    setActivityLog([]);
    setExampleSaved(false);
    setExampleSaving(false);
  }

  function toggleMedia(item: PublerMedia) {
    const isSelected = selectedMedia.some((media) => media.id === item.id);
    const next = isSelected
      ? selectedMedia.filter((media) => media.id !== item.id)
      : [...selectedMedia, item];
    const error = validateMediaSelection(next);

    if (error) {
      setMediaError(error);
      return;
    }

    setSelectedMedia(next);
    setMediaError("");
  }

  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    setMediaError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("in_library", "true");

      const uploaded = await client.uploadMedia(formData);
      const next = [...selectedMedia.filter((media) => media.id !== uploaded.id), uploaded];
      const error = validateMediaSelection(next);
      if (error) {
        setMediaError(`Uploaded ${uploaded.name ?? "media"}, but it was not attached. ${error}`);
        return;
      }

      setSelectedMedia(next);
      setMediaPickerOpen(false);
      await mutateMedia();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : "Media upload failed.");
    } finally {
      setUploadingMedia(false);
      if (mediaInputRef.current) {
        mediaInputRef.current.value = "";
      }
    }
  }

  function removeMedia(id: string) {
    setSelectedMedia((prev) => prev.filter((media) => media.id !== id));
    setMediaError("");
  }

  async function scheduleAt(isoTimestamp: string) {
    if (!postText.trim() || selectedAccounts.length === 0) return;
    const mediaScheduleError = validateSchedulableMedia(selectedMedia);
    if (mediaScheduleError) {
      setSubmitError(mediaScheduleError);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const selectedAccountObjects = accounts.filter((a) => selectedAccounts.includes(a.id));
      const scheduleMedia = buildScheduleMedia(selectedMedia);
      const mediaPostType = selectedMedia.length > 0 ? getMediaPostType(selectedMedia[0]) : null;
      const networks = Object.fromEntries(
        [...new Set(selectedAccountObjects.map((a) => a.provider))].map((provider) => [
          provider,
          scheduleMedia.length > 0 && mediaPostType
            ? { type: mediaPostType, text: postText.trim(), media: scheduleMedia }
            : { type: "status" as const, text: postText.trim() },
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

  async function handleSaveExample() {
    if (!postText.trim() || exampleSaving) return;
    setExampleSaving(true);
    try {
      await saveWritingExample(postText.trim(), "Approved example", brief.trim() || undefined);
      setExampleSaved(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to save writing example.");
    } finally {
      setExampleSaving(false);
    }
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

          {(streaming || activityLog.length > 0) && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                <Loader className={`w-4 h-4 ${streaming ? "animate-spin text-sky-400" : ""}`} />
                Codex activity
              </div>
              <div className="mt-3 space-y-2 font-mono text-xs text-gray-300">
                {activityLog.length === 0 && streaming && <p>Waiting for Codex to start work...</p>}
                {activityLog.map((entry, index) => (
                  <p key={`${index}-${entry}`} className="break-words">
                    {entry}
                  </p>
                ))}
              </div>
            </div>
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
              <button
                onClick={handleSaveExample}
                disabled={!memoryEnabled || !postText.trim() || exampleSaving || exampleSaved}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                title={memoryEnabled ? undefined : "Configure Convex memory to save writing examples."}
              >
                <Bookmark className="w-4 h-4" />
                {exampleSaved ? "Saved as example" : exampleSaving ? "Saving..." : "Save as example"}
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
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="block text-sm font-medium text-gray-300">Media</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => mediaInputRef.current?.click()}
                  disabled={uploadingMedia}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingMedia ? "Uploading..." : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={() => setMediaPickerOpen((open) => !open)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  {mediaPickerOpen ? "Hide library" : "Choose from library"}
                </button>
              </div>
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaUpload}
                className="hidden"
              />
            </div>

            {selectedMedia.length === 0 ? (
              <p className="text-sm text-gray-500">Optional. Attach multiple photos or one video.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {selectedMedia.map((item) => {
                  const mediaType = getMediaPostType(item);
                  const preview = getMediaPreviewUrl(item);
                  return (
                    <div key={item.id} className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
                      <div className="aspect-video bg-gray-900 relative">
                        {preview ? (
                          <img src={preview} alt={item.name ?? ""} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {mediaType === "video" ? (
                              <Video className="w-7 h-7 text-gray-600" />
                            ) : (
                              <ImageIcon className="w-7 h-7 text-gray-600" />
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeMedia(item.id)}
                          className="absolute top-2 right-2 p-1 bg-black/70 hover:bg-black text-white rounded-full transition-colors"
                          aria-label="Remove media"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 text-[10px] uppercase tracking-wide text-white rounded-full">
                          {mediaType}
                        </span>
                      </div>
                      <p className="px-2 py-1.5 text-xs text-gray-400 truncate">{item.name ?? item.caption ?? item.id}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {mediaError && (
              <p className="text-sm text-red-400 mt-2 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 shrink-0" /> {mediaError}
              </p>
            )}

            {mediaPickerOpen && (
              <div className="mt-3 bg-gray-950/70 border border-gray-800 rounded-xl p-3 space-y-3">
                <input
                  type="search"
                  value={mediaSearch}
                  onChange={(e) => setMediaSearch(e.target.value)}
                  placeholder="Search media library..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
                />

                {mediaLoading && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                      <div key={item} className="aspect-video bg-gray-900/70 border border-gray-800 rounded-lg animate-pulse" />
                    ))}
                  </div>
                )}

                {mediaLibraryError && (
                  <p className="text-sm text-red-400">Failed to load media library.</p>
                )}

                {!mediaLoading && !mediaLibraryError && libraryMedia.length === 0 && (
                  <p className="text-sm text-gray-500 py-4 text-center">No matching photos or videos found.</p>
                )}

                {!mediaLoading && !mediaLibraryError && libraryMedia.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
                    {libraryMedia.map((item) => {
                      const mediaType = getMediaPostType(item);
                      const preview = getMediaPreviewUrl(item);
                      const selected = selectedMedia.some((media) => media.id === item.id);
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => toggleMedia(item)}
                          className={`text-left bg-gray-900 border rounded-xl overflow-hidden transition-colors ${
                            selected ? "border-sky-400 ring-1 ring-sky-400" : "border-gray-800 hover:border-gray-600"
                          }`}
                        >
                          <div className="aspect-video bg-gray-950 relative">
                            {preview ? (
                              <img src={preview} alt={item.name ?? ""} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                {mediaType === "video" ? (
                                  <Video className="w-7 h-7 text-gray-600" />
                                ) : (
                                  <ImageIcon className="w-7 h-7 text-gray-600" />
                                )}
                              </div>
                            )}
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 text-[10px] uppercase tracking-wide text-white rounded-full">
                              {mediaType ?? item.type}
                            </span>
                            {selected && (
                              <span className="absolute top-2 right-2 px-2 py-0.5 bg-sky-500 text-[10px] font-medium text-white rounded-full">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="px-2 py-1.5 text-xs text-gray-400 truncate">{item.name ?? item.caption ?? item.id}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
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
