import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth";
import { currentTheme } from "@/lib/theme";
import { NavLink } from "./nav-link";

// Topbar mengikuti ui_kits/fleet-operations/Topbar design system: putih, 60px, border bawah subtle
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-15 max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
          <Link href="/" className="inline-flex min-h-11 items-center gap-3">
            {/* Tema gelap: knockout putih sesuai guidelines/brand/logo-on-dark design system */}
            <Image src="/brand/mceasy-logo-full.png" alt="McEasy" width={114} height={26} priority className="dark:brightness-0 dark:invert" />
            <span className="border-l border-line-default pl-3 text-sm font-semibold text-ink">POC Tracker</span>
          </Link>
          <nav aria-label="Menu utama" className="flex flex-wrap gap-1">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/">Daftar POC</NavLink>
            {user.role === "admin" && <NavLink href="/pengguna">Pengguna</NavLink>}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span className="text-muted">
              {user.name}
              {user.role === "admin" && " (Admin)"}
            </span>
            <ThemeToggle initial={await currentTheme()} />
            <Link href="/ganti-password" className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">
              Ganti Password
            </Link>
            <form action={logout}>
              <button type="submit" className="min-h-11 font-medium text-accent hover:underline">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
