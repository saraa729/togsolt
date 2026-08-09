import ShopCard from "@/components/ShopCard";
import { serverGet } from "@/lib/api";
import { translate } from "@/lib/i18n";
import { readPreferences } from "@/lib/prefs";
import type { Shop } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Урлаачид / Artisans",
  description: "ExpoCraft дээрх баталгаажсан монгол гар урлаачид — түүх, бүтээл, байршил.",
};

export default async function ArtisansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { locale } = await readPreferences();
  const t = (key: string) => translate(locale, key);
  const q = typeof params.q === "string" ? params.q : "";

  const data = await serverGet<{ shops: Shop[] }>("/shops", { locale, status: "verified", q });
  const shops = data?.shops ?? [];

  return (
    <div className="page-wide py-10">
      <div className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("shops.title")}</h1>
        <p className="muted mt-1">{t("home.trustVerifiedText")}</p>
      </div>

      <form className="mb-6 flex max-w-md gap-2" action="/artisans">
        <input name="q" defaultValue={q} className="input" placeholder={t("common.search")} />
        <button type="submit" className="btn-primary">
          {t("common.search")}
        </button>
      </form>

      {shops.length === 0 ? (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <p className="muted">{t("shops.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </div>
  );
}
