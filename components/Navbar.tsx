"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Live Data", href: "/live-data" },
  { name: "Historical Data", href: "/historical-data" },
  { name: "Alerts", href: "/alerts" },
  { name: "Reports", href: "/reports" },
  { name: "About", href: "/about" },
];

export default function Navbar({
  userEmail,
  logoutButton,
}: {
  userEmail?: string | null;
  logoutButton: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-gray-200">
              <img src="/logo.png" alt="Flood Monitoring System" className="h-full w-full object-contain" />
            </div>
            <span className="hidden sm:block text-sm font-semibold tracking-tight text-gray-900">
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
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? "text-gray-900 font-medium bg-gray-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {userEmail && (
              <span className="hidden lg:block text-sm text-gray-500 truncate max-w-[200px]">
                {userEmail}
              </span>
            )}
            <div className="hidden sm:block">{logoutButton}</div>
            <button
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              onClick={() => setOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-1">
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
                      ? "text-gray-900 font-medium bg-gray-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              {userEmail && (
                <span className="text-sm text-gray-500 truncate">{userEmail}</span>
              )}
              <div className="sm:hidden">{logoutButton}</div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
