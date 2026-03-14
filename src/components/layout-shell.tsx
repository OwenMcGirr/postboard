import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";

export function LayoutShell() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Sidebar />
      <main className="md:ml-64 px-4 pt-6 pb-24 md:px-8 md:pb-8">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
