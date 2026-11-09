"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" || pathname.startsWith("/poc") : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 sm:min-h-9 items-center rounded-md px-3 text-[13px] font-semibold ${
        active ? "bg-info-bg text-accent" : "text-muted hover:bg-surface-alt hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
