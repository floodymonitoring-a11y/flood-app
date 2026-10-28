"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Historical Data", href: "/historical-data" },
  { name: "Alerts", href: "/alerts" },
  { name: "Reports", href: "/reports" },
  { name: "About", href: "/about" },
];

export default function Sidebar({
  userEmail: userEmailProp,
  logoutButton,
}: {
  userEmail?: string | null;
  logoutButton: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(userEmailProp ?? null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (userEmailProp) {
        setUserEmail(userEmailProp);
      } else {
        setUserEmail(data.user?.email ?? null);
      }
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        setIsAdmin(profile?.role === "admin");
      }
    });
  }, [userEmailProp]);

  const NavLinks = ({ dark = false }: { dark?: boolean }) => (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={() => setOpen(false)}
            className={`px-3 py-2 text-sm rounded-lg transition-colors ${
              dark
                ? isActive
                  ? "text-white font-medium bg-white/10"
                  : "text-white/70 hover:text-white hover:bg-white/5"
                : isActive
                ? "text-gray-900 font-medium bg-gray-100"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {item.name}
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          href="/admin"
          prefetch
          onClick={() => setOpen(false)}
          className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
            dark
              ? pathname === "/admin"
                ? "text-white font-medium bg-white/10"
                : "text-white/70 hover:text-white hover:bg-white/5"
              : pathname === "/admin"
              ? "text-gray-900 font-medium bg-gray-100"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Shield className="h-4 w-4" /> Admin
        </Link>
      )}
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-black border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/20">
              <img src="/logo.png" alt="Flood Monitoring System" className="h-full w-full object-contain" />
            </div>
            <span className="text-sm font-semibold text-white">
              Flood Monitoring System
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    isActive
                      ? "text-white font-medium bg-white/10"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin"
                prefetch
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                  pathname === "/admin"
                    ? "text-white font-medium bg-white/10"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                <Shield className="h-3.5 w-3.5" /> Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            {userEmail && (
              <span className="hidden lg:block text-xs text-white/50 truncate max-w-[200px]">
                {userEmail}
              </span>
            )}
            <div className="hidden sm:block text-white/80">{logoutButton}</div>
            <button
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-white/70 hover:text-white hover:bg-white/5"
              onClick={() => setOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 w-72 bg-black border-l border-white/10 flex flex-col">
            <div className="flex h-14 items-center justify-between px-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/20">
                  <img src="/logo.png" alt="Flood Monitoring System" className="h-full w-full object-contain" />
                </div>
                <span className="text-sm font-semibold text-white">
                  Flood Monitoring System
                </span>
              </div>
              <button
                className="inline-flex items-center justify-center rounded-lg p-2 text-white/70 hover:text-white hover:bg-white/5"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 px-4 py-4 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    onClick={() => setOpen(false)}
                    className={`block px-3 py-2 text-sm rounded-lg ${
                      isActive
                        ? "text-white font-medium bg-white/10"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin"
                  prefetch
                  onClick={() => setOpen(false)}
                  className={`block px-3 py-2 text-sm rounded-lg flex items-center gap-2 ${
                    pathname === "/admin"
                      ? "text-white font-medium bg-white/10"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Shield className="h-4 w-4" /> Admin
                </Link>
              )}
            </div>
            <div className="border-t border-white/10 px-4 py-4 space-y-2">
              {userEmail && (
                <div className="text-xs text-white/40 truncate">{userEmail}</div>
              )}
              <div className="text-white/80">{logoutButton}</div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
