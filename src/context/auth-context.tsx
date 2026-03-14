import { createContext, useContext, useState, ReactNode } from "react";

const TOKEN_KEY = "postboard_token";
const WORKSPACE_KEY = "postboard_workspace_id";

interface AuthContextValue {
  token: string | null;
  workspaceId: string | null;
  isConfigured: boolean;
  setCredentials: (token: string, workspaceId: string) => void;
  clearCredentials: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY)
  );
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    () => localStorage.getItem(WORKSPACE_KEY)
  );

  function setCredentials(newToken: string, newWorkspaceId: string) {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(WORKSPACE_KEY, newWorkspaceId);
    setToken(newToken);
    setWorkspaceId(newWorkspaceId);
  }

  function clearCredentials() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(WORKSPACE_KEY);
    setToken(null);
    setWorkspaceId(null);
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        workspaceId,
        isConfigured: !!token && !!workspaceId,
        setCredentials,
        clearCredentials,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
