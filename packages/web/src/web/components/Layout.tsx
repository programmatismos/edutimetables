import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  School,
  Users,
  BookOpen,
  Calendar,
  ClipboardList,
  GraduationCap,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/school", icon: School, label: "Σχολείο" },
  { path: "/shifts", icon: Clock, label: "Βάρδιες" },
  { path: "/teachers", icon: Users, label: "Εκπαιδευτικοί" },
  { path: "/classes", icon: GraduationCap, label: "Τάξεις" },
  { path: "/subjects", icon: BookOpen, label: "Μαθήματα" },
  { path: "/schedule", icon: Calendar, label: "Πρόγραμμα" },
  { path: "/exports", icon: ClipboardList, label: "Εξαγωγές" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    // In Electron, get real version via IPC; fallback to package version
    const api = (window as any).electronAPI;
    if (api?.getVersion) {
      api.getVersion().then((v: string) => setAppVersion(v)).catch(() => {});
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col relative transition-all duration-200"
        style={{
          width: collapsed ? 56 : 240,
          background: "var(--primary)",
          color: "white",
        }}
      >
        {/* Logo */}
        <div className="px-3 py-5 border-b border-white/10 flex items-center" style={{ minHeight: 64 }}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--accent)" }}
            >
              <GraduationCap size={18} className="text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="font-bold text-sm leading-tight whitespace-nowrap">EduTimetables</div>
                <div className="text-xs opacity-60 whitespace-nowrap">Πρόγραμμα Εξετάσεων</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location === path || (path !== "/" && location.startsWith(path));
            return (
              <Link key={path} to={path}>
                <div
                  title={collapsed ? label : undefined}
                  className={`flex items-center gap-3 px-2 py-2.5 rounded-lg cursor-pointer transition-all text-sm font-medium ${
                    isActive
                      ? "text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                  style={isActive ? { background: "var(--accent)" } : {}}
                >
                  <Icon size={17} className="flex-shrink-0" />
                  {!collapsed && <span className="whitespace-nowrap overflow-hidden">{label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        {!collapsed && (
          <div className="px-3 py-3 border-t border-white/10">
            <div className="text-xs text-white/40 px-2 leading-relaxed">
              {appVersion ? `v${appVersion}` : "v1.0.9"}
              <br />
              Δημιουργός Γυφτάκης Ιωάννης (ΠΕ86)
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-[72px] w-6 h-6 rounded-full flex items-center justify-center cursor-pointer border border-white/20 hover:opacity-90 transition-opacity z-10"
          style={{ background: "var(--primary)" }}
          title={collapsed ? "Ανάπτυξη sidebar" : "Σύμπτυξη sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={13} className="text-white" />
          ) : (
            <ChevronLeft size={13} className="text-white" />
          )}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
