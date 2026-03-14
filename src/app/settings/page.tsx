import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { getUserProfile, setUserProfile } from "@/lib/user-profile";

export default function SettingsPage() {
  const [profile, setProfile] = useState(getUserProfile);
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setUserProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-400 text-sm mt-0.5">Tell the AI about yourself so posts sound like you.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">About you</label>
          <textarea
            value={profile}
            onChange={(e) => { setProfile(e.target.value); setSaved(false); }}
            rows={8}
            placeholder={`e.g. I'm a software developer and founder of Timberlogs, a logging tool for developers. I write about software, startups, and building in public. My audience is mostly developers and tech founders on LinkedIn.`}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors resize-none"
          />
        </div>
        <button
          type="submit"
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saved && <CheckCircle className="w-4 h-4" />}
          {saved ? "Saved" : "Save"}
        </button>
      </form>
    </div>
  );
}
