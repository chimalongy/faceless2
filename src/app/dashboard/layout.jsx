"use client";

import { LayoutGrid, Settings2, Menu, X, LogOut, Radio } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";

const navigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutGrid },
  { label: "Settings", href: "/dashboard/settings", icon: Settings2 },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  // Derive active label or channel title
  const activeLabel =
    navigation.find((item) => item.href === pathname)?.label ??
    (pathname.includes("/edit")
      ? "Edit Channel Desk"
      : pathname.includes("/topic/")
      ? "Content Topic Studio"
      : pathname.includes("/content_pillar/")
      ? "Pillar Directive"
      : pathname.includes("/dashboard/channels/")
      ? "Channel Workspace"
      : "Overview");

  // Close the mobile drawer whenever route changes
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Prevent background scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  async function handleLogout() {
    try {
      await fetch("/api/login", { method: "DELETE" });
    } catch {}
    router.push("/");
  }

  return (
    <div className="flex h-screen bg-paper font-sans antialiased text-ink selection:bg-signal/20 selection:text-signal overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          className: "text-xs font-sans border border-line bg-paper text-ink shadow-lg",
          duration: 4500,
          style: {
            borderRadius: "4px",
            background: "#ffffff",
            color: "#1e293b",
            border: "1px solid #e2e8f0",
            fontSize: "13px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          },
          error: {
            style: {
              background: "#fff1f2",
              color: "#be123c",
              border: "1px solid #fecdd3",
            },
            iconTheme: {
              primary: "#e11d48",
              secondary: "#ffffff",
            },
          },
          success: {
            style: {
              background: "#f0fdf4",
              color: "#166534",
              border: "1px solid #bbf7d0",
            },
            iconTheme: {
              primary: "#16a34a",
              secondary: "#ffffff",
            },
          },
        }}
      />
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-line bg-paper-card p-6 justify-between shrink-0">
        <div className="space-y-8">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-signal flex items-center justify-center text-white font-mono text-sm font-bold shadow-xs shadow-signal/30">
              F2
            </div>
            <div>
              <span className="font-display font-bold text-sm tracking-tight text-ink block leading-none">
                Faceless 2.0
              </span>
              <span className="font-mono text-[10px] text-ink-muted uppercase tracking-wider block mt-1">
                Studio Edition
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-sm transition-all ${
                    isActive
                      ? "bg-signal/10 text-signal border border-signal/20"
                      : "text-ink-muted hover:text-ink hover:bg-ink/5"
                  }`}
                >
                  <Icon size={16} className={isActive ? "text-signal" : "text-ink-muted"} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Account / Sign Out */}
        <div className="pt-6 border-t border-line space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono text-ink-muted">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Studio Engine: Active</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-ink-muted hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-colors cursor-pointer"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-paper-card border-r border-line p-6 flex flex-col justify-between transition-transform duration-300 ease-in-out md:hidden ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-signal flex items-center justify-center text-white font-mono text-sm font-bold">
                F2
              </div>
              <span className="font-display font-bold text-sm tracking-tight text-ink">
                Faceless 2.0
              </span>
            </div>
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              className="p-1.5 text-ink-muted hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setNavOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-sm transition-all ${
                    isActive
                      ? "bg-signal/10 text-signal border border-signal/20"
                      : "text-ink-muted hover:text-ink hover:bg-ink/5"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-line">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-ink-muted hover:text-rose-600 rounded-sm"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-line px-4 sm:px-8 flex items-center justify-between bg-paper-card shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="md:hidden p-1.5 text-ink-muted hover:text-ink border border-line rounded-sm"
            >
              <Menu size={16} />
            </button>
            <span className="text-xs font-mono font-medium text-ink-muted">
              {activeLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1  bg-paper-deep text-ink-muted font-mono text-[10px] font-medium border border-line">
              <Radio size={11} className="text-signal" /> Faceless 2.0
            </span>
          </div>
        </header>

        {/* Scrollable page body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

