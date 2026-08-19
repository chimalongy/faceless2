"use client";

import { LayoutGrid, Settings2, Menu, X, LogOut, Radio } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
      // Clear cookie client-side
      document.cookie = "faceless_studio_admin_session=; path=/; max-age=0";
      router.push("/");
    } catch {
      router.push("/");
    }
  }

  return (
    <div className="flex min-h-screen bg-paper text-ink font-sans">
      {/* Mobile scrim / backdrop */}
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Rail */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 md:static md:w-60 shrink-0 bg-paper-dark border-r border-line flex flex-col justify-between p-6 transition-transform duration-200 ease-out md:translate-x-0 ${navOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
          }`}
      >
        <div className="space-y-8">
          {/* Header & Brand */}
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="inline-flex items-center gap-3 group" aria-label="Faceless 2.0 Dashboard">
              <div className="w-7 h-7  bg-signal flex items-center justify-center text-white shadow-xs shadow-signal/30">
                <span className="w-2.5 h-2.5 bg-paper [clip-path:polygon(0_0,100%_50%,0_100%)] ml-0.5" />
              </div>
              <div className="flex flex-col tracking-wider leading-none">
                <strong className="text-[11px] font-bold font-mono tracking-widest text-ink">FACELESS</strong>
                <span className="text-[8px] font-mono tracking-[0.25em] text-signal font-semibold mt-0.5">2.0</span>
              </div>
            </Link>

            <button
              type="button"
              className="p-1.5  text-ink-muted hover:text-ink md:hidden"
              aria-label="Close navigation"
              onClick={() => setNavOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5" aria-label="Workspace navigation">
            <p className="px-3 text-[10px] font-mono font-medium tracking-widest text-ink-muted uppercase mb-2">
              Workspace
            </p>
            {navigation.map(({ label, href, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={label}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2  text-xs font-medium transition-colors ${isActive
                      ? "bg-signal text-white font-semibold shadow-xs shadow-signal/20"
                      : "text-ink/70 hover:text-ink hover:bg-ink/5"
                    }`}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User / Footer in Rail */}
        <div className="pt-6 border-t border-line/80 space-y-3">
          <div className="flex items-center justify-between px-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2  bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[11px] text-ink-muted">Desk Online</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5  text-ink-muted hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 px-6 sm:px-8 border-b border-line bg-paper/80 backdrop-blur-xs sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="p-1.5 -ml-1.5  text-ink hover:bg-ink/5 md:hidden"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="text-xs font-mono font-semibold tracking-wider text-ink-muted uppercase">
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
        <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

