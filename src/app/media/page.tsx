import { useRef, useState } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { useMedia } from "@/lib/hooks";
import { usePublerClient } from "@/lib/use-publer-client";
import type { PublerMedia } from "@/lib/publer-api";

const MEDIA_LIBRARY_TYPES = ["photo", "video", "gif"];

function getMediaPreviewUrl(item: PublerMedia) {
  if (item.thumbnail) return item.thumbnail;
  if (Array.isArray(item.thumbnails)) {
    const thumbnail = item.thumbnails.find((candidate) => candidate.small || candidate.real);
    return thumbnail?.small || thumbnail?.real || item.path;
  }
  if (item.thumbnails) {
    const thumbnail = Object.values(item.thumbnails).find(Boolean);
    return thumbnail || item.path;
  }
  return item.path;
}

export default function MediaPage() {
  const client = usePublerClient();
  const { media, isLoading, isError, mutate } = useMedia({ types: MEDIA_LIBRARY_TYPES });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recentUploads, setRecentUploads] = useState<PublerMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const visibleMedia = [
    ...recentUploads,
    ...media.filter((item) => !recentUploads.some((upload) => upload.id === item.id)),
  ];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("in_library", "true");
      const uploaded = await client.uploadMedia(formData);
      setRecentUploads((prev) => [uploaded, ...prev.filter((item) => item.id !== uploaded.id)]);
      await mutate();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Media</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {uploadError && (
        <p className="text-red-400 text-sm mb-4">{uploadError}</p>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-square bg-gray-900/50 border border-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-red-400 text-sm">Failed to load media.</p>
      )}

      {!isLoading && !isError && visibleMedia.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No media yet. Upload something to get started.</p>
        </div>
      )}

      {!isLoading && !isError && visibleMedia.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {visibleMedia.map((item) => {
            const thumb = getMediaPreviewUrl(item);
            const isRecent = recentUploads.some((upload) => upload.id === item.id);
            return (
              <div key={item.id} className="group aspect-square bg-gray-900 border border-gray-800 rounded-xl overflow-hidden relative">
                {thumb ? (
                  <img src={thumb} alt={item.name ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-700" />
                  </div>
                )}
                {item.name && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-white truncate">{item.name}</p>
                  </div>
                )}
                {isRecent && (
                  <div className="absolute top-2 left-2 bg-sky-500 text-white text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full">
                    Uploaded
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
