import { cookies } from "next/headers";
import type { Currency, Locale } from "./types";

/** Server component-үүд хэрэглэгчийн хэл/валютын сонголтыг cookie-оос уншина. */
export async function readPreferences(): Promise<{ locale: Locale; currency: Currency }> {
  const store = await cookies();
  const locale: Locale = store.get("expocraft_locale")?.value === "en" ? "en" : "mn";
  const currency: Currency = store.get("expocraft_currency")?.value === "USD" ? "USD" : "MNT";
  return { locale, currency };
}
