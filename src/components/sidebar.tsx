import { NavLink } from "react-router-dom";
import { LayoutDashboard, PenSquare, List, Image } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compose", label: "Compose", icon: PenSquare },
  { href: "/posts", label: "Posts", icon: List },
  { href: "/media", label: "Media", icon: Image },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 bg-gray-950 border-r border-gray-800 flex-col h-screen fixed left-0 top-0 z-40">
      <div className="p-6 border-b border-gray-800">
        <span className="text-xl font-bold text-white tracking-tight">Postboard</span>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <NavLink
                to={href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-sky-500/10 text-sky-400 border-l-2 border-sky-500 -ml-[2px] pl-[14px]"
                      : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
