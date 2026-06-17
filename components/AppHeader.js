"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppHeader({ title, subtitle, links = [] }) {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between bg-tghc-navy px-6 py-4 shadow-sm">
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold tracking-wide text-white">TGHC</span>
        <div className="hidden h-8 w-px bg-white/20 sm:block" />
        <div>
          <h1 className="text-sm font-semibold text-white sm:text-base">{title}</h1>
          {subtitle && <p className="text-xs text-white/70">{subtitle}</p>}
        </div>
      </div>

      {links.length > 0 && (
        <nav className="flex items-center gap-2">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-tghc-red text-white"
                    : "bg-white text-tghc-blue hover:bg-tghc-blue hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
