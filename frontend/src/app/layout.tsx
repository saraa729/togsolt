import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Chrome from "@/components/Chrome";
import { readPreferences } from "@/lib/prefs";

export const metadata: Metadata = {
  title: {
    default: "ExpoCraft — Монголын гар урлалын зах / Mongolian handicraft marketplace",
    template: "%s | ExpoCraft",
  },
  description:
    "Баталгаажсан монгол урлаачдын гар урлалын бүтээлүүд. Escrow-оор хамгаалагдсан төлбөр, олон улсын хүргэлт. / Handmade Mongolian crafts from verified artisans, escrow-protected payments and international shipping.",
  keywords: ["Mongolian handicraft", "гар урлал", "Монгол бэлэг", "felt craft", "ExpoCraft", "handmade Mongolia"],
  openGraph: {
    title: "ExpoCraft — Mongolian handicraft marketplace",
    description: "Handmade Mongolian crafts from verified artisans.",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, currency } = await readPreferences();

  return (
    <html lang={locale}>
      <body className="min-h-screen antialiased">
        <Providers initialLocale={locale} initialCurrency={currency}>
          <Chrome>{children}</Chrome>
        </Providers>
      </body>
    </html>
  );
}
