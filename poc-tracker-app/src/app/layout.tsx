import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { currentTheme } from "@/lib/theme";
import "./globals.css";

// Font utama McEasy Design System (tokens/fonts.css), bobot 400-700
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: { default: "POC Tracker", template: "%s · POC Tracker" },
  description: "Pencatatan POC, update mingguan, dan audit trail untuk tim CPM McEasy.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" data-theme={await currentTheme()} className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
