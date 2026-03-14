import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LayoutShell } from "@/components/layout-shell";

function Loading() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function withSuspense(Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<Loading />}>
      <Component />
    </Suspense>
  );
}

const DashboardPage = lazy(() => import("./app/dashboard/page"));
const ComposePage = lazy(() => import("./app/compose/page"));
const PostsPage = lazy(() => import("./app/posts/page"));
const MediaPage = lazy(() => import("./app/media/page"));
const SettingsPage = lazy(() => import("./app/settings/page"));

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  {
    element: <LayoutShell />,
    children: [
      { path: "/dashboard", element: withSuspense(DashboardPage) },
      { path: "/compose", element: withSuspense(ComposePage) },
      { path: "/posts", element: withSuspense(PostsPage) },
      { path: "/media", element: withSuspense(MediaPage) },
      { path: "/settings", element: withSuspense(SettingsPage) },
    ],
  },
]);
