"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translate, type TranslateVars } from "./i18n";
import type { Currency, Locale } from "./types";

type AppContextValue = {
  locale: Locale;
  currency: Currency;
  setLocale: (locale: Locale) => void;
  setCurrency: (currency: Currency) => void;
  t: (key: string, fallbackOrVars?: string | TranslateVars, vars?: TranslateVars) => string;
};

const AppContext = createContext<AppContextValue | null>(null);

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function AppProvider({
  initialLocale = "mn",
  initialCurrency = "MNT",
  children,
}: {
  initialLocale?: Locale;
  initialCurrency?: Currency;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeCookie("expocraft_locale", next);
    // Server component-үүд cookie-г уншдаг тул шинэчилнэ.
    window.location.reload();
  }, []);

  const setCurrency = useCallback((next: Currency) => {
    setCurrencyState(next);
    writeCookie("expocraft_currency", next);
    window.location.reload();
  }, []);

  const t = useCallback(
    (key: string, fallbackOrVars?: string | TranslateVars, vars?: TranslateVars) =>
      translate(locale, key, fallbackOrVars, vars),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, currency, setLocale, setCurrency, t }),
    [locale, currency, setLocale, setCurrency, t]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
