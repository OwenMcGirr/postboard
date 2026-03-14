import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, CheckCircle, XCircle, Loader } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { PublerClient } from "@/lib/publer-client";
import { PublerWorkspace } from "@/lib/publer-api";

export default function SettingsPage() {
  const { token, workspaceId, setCredentials, clearCredentials, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [tokenInput, setTokenInput] = useState(token ?? "");
  const [workspaceInput, setWorkspaceInput] = useState(workspaceId ?? "");
  const [showToken, setShowToken] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [workspaces, setWorkspaces] = useState<PublerWorkspace[]>([]);

  async function testConnection() {
    if (!tokenInput.trim()) return;
    setTestStatus("loading");
    setTestMessage("");
    try {
      const client = new PublerClient(tokenInput.trim(), "placeholder");
      const { workspaces: ws } = await client.getWorkspaces();
      setWorkspaces(ws);
      setTestStatus("ok");
      setTestMessage("Connection successful");
    } catch {
      setTestStatus("error");
      setTestMessage("Failed to connect. Check your token.");
      setWorkspaces([]);
    }
  }

  function save() {
    setCredentials(tokenInput.trim(), workspaceInput.trim());
    navigate("/dashboard");
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-gray-400 mb-8 text-sm">Connect your Publer account to get started.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">API Token</label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={tokenInput}
              onChange={(e) => { setTokenInput(e.target.value); setTestStatus("idle"); setWorkspaces([]); }}
              placeholder="Paste your Publer API token"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={testConnection}
            disabled={!tokenInput.trim() || testStatus === "loading"}
            className="mt-2 text-sm text-sky-400 hover:text-sky-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
          >
            {testStatus === "loading" && <Loader className="w-3.5 h-3.5 animate-spin" />}
            Test connection
          </button>
          {testStatus === "ok" && (
            <p className="mt-1.5 text-sm text-green-400 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> {testMessage}
            </p>
          )}
          {testStatus === "error" && (
            <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> {testMessage}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Workspace</label>
          {workspaces.length > 0 ? (
            <select
              value={workspaceInput}
              onChange={(e) => setWorkspaceInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value="">Select a workspace</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={workspaceInput}
              onChange={(e) => setWorkspaceInput(e.target.value)}
              placeholder="Workspace ID (test connection to browse)"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={save}
            disabled={!tokenInput.trim() || !workspaceInput.trim()}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            Save & continue
          </button>
          {isConfigured && (
            <button
              onClick={clearCredentials}
              className="px-4 py-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
