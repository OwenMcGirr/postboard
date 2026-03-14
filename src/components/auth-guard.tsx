import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/auth-context";

export function AuthGuard() {
  const { isConfigured } = useAuth();
  if (!isConfigured) return <Navigate to="/settings" replace />;
  return <Outlet />;
}
