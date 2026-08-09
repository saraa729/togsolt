import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Chrome from "@/components/Chrome";
import { readPreferences } from "@/lib/prefs";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Lora — кирилл үсгийг бүрэн дэмждэг editorial serif (Playfair-д кирилл байхгүй)
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
});

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
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, currency } = await readPreferences();

  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} min-h-screen antialiased`}>
        <Providers initialLocale={locale} initialCurrency={currency}>
          <Chrome>{children}</Chrome>
        </Providers>
      </body>
    </html>
  );
}
