import { cookies } from "next/headers";
import type { Theme } from "@/components/theme-toggle";

/** Tema dari cookie; default terang sesuai McEasy Design System. */
export async function currentTheme(): Promise<Theme> {
  return (await cookies()).get("theme")?.value === "dark" ? "dark" : "light";
}
