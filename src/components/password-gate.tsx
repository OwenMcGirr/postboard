import { useState } from "react";
import { Lock } from "lucide-react";

const STORAGE_KEY = "postboard_auth";
const PASSWORD = import.meta.env.VITE_APP_PASSWORD as string | undefined;

function isAuthenticated() {
  if (!PASSWORD) return true;
  return sessionStorage.getItem(STORAGE_KEY) === PASSWORD;
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(isAuthenticated);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (authed) return <>{children}</>;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, input);
      setAuthed(true);
    } else {
      setError(true);
      setInput("");
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-xs space-y-6 px-4">
        <div className="text-center">
          <Lock className="w-8 h-8 text-gray-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-white">Postboard</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            autoFocus
            placeholder="Password"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          {error && <p className="text-xs text-red-400">Incorrect password.</p>}
          <button
            type="submit"
            disabled={!input}
            className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
