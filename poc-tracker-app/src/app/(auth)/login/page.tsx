import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";
import { currentTheme } from "@/lib/theme";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Image
          src="/brand/mceasy-logo-full.png"
          alt="McEasy"
          width={140}
          height={32}
          priority
          className="dark:brightness-0 dark:invert"
        />
        <h1 className="mt-6 text-[22px] leading-[30px] font-bold text-ink">POC Tracker</h1>
        <p className="mt-1 text-sm text-muted">Masuk dengan email McEasy dan password dari Admin.</p>
        <div className="mt-6 rounded-xl border border-line bg-surface p-5">
          <LoginForm />
        </div>
        <div className="mt-4 text-[13px]">
          <ThemeToggle initial={await currentTheme()} />
        </div>
      </div>
    </main>
  );
}
