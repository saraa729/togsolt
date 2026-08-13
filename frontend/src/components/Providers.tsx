"use client";

import { AppProvider } from "@/lib/app-context";
import { AuthProvider } from "@/lib/auth-context";
import type { Currency, Locale } from "@/lib/types";

export default function Providers({
  initialLocale,
  initialCurrency,
  children,
}: {
  initialLocale: Locale;
  initialCurrency: Currency;
  children: React.ReactNode;
}) {
  return (
    <AppProvider initialLocale={initialLocale} initialCurrency={initialCurrency}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </AppProvider>
  );
}
