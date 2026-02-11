"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Dashboard Layout — Sidebar con navegación.
 *
 * Diseño según UI_UX_SPECIFICATION.md:
 * Header: "Panel de Administración" con tabs [Dashboard] [Analíticas]
 */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const NAV_ITEMS = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/dashboard/analytics", label: "Analíticas", icon: "📈" },
  ];

  return (
    <div className="min-h-screen bg-surface-alt">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <Link href="/" className="font-bold text-lg text-primary">
                TryOn
              </Link>
              <span className="text-sm text-text-muted hidden sm:block">
                Panel de Administración
              </span>
            </div>

            {/* Nav tabs */}
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-text-muted hover:bg-gray-100 hover:text-text"
                    }`}
                  >
                    <span className="mr-1.5">{item.icon}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
