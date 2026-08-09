"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { Alert, EmptyState, Field, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, imageOrPlaceholder } from "@/lib/format";
import type { Cart, Currency, Order } from "@/lib/types";

export default function CartPage() {
  return (
    <RequireAuth role="buyer">
      <CartView />
    </RequireAuth>
  );
}

function CartView() {
  const { t, locale, currency } = useApp();
  const { user, refreshCart } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /*
   * Төлбөрийн валют нь толгойн хэсэгт сонгосон валютыг дагана. Төлбөрийн
   * хэрэгслийг (qpay/stripe) хэрэглэгчээр сонгуулахаа больж, backend валютаас
   * нь өөрөө тодорхойлдог болгов — сагснаас шууд төлнө.
   */
  const [payCurrency] = useState<Currency>(currency);
  const [address, setAddress] = useState({
    name: "",
    phone: "",
    country: "MN",
    city: "Улаанбаатар",
    line1: "",
    zip: "",
  });
  const [shippingSelections, setShippingSelections] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  /** Баталгаажсан купоны код. Хоосон бол хөнгөлөлтгүй төлнө. */
  const [coupon, setCoupon] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ cart: Cart }>("/cart", { query: { locale, currency: payCurrency } });
      setCart(data.cart);
      setShippingSelections((prev) => {
        const next = { ...prev };
        for (const group of data.cart.sellerGroups) {
          if (!next[group.shopId]) next[group.shopId] = group.items[0]?.availableShippingOptions?.[0]?.code || "domestic_city";
        }
        return next;
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [locale, payCurrency]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (user) setAddress((prev) => ({ ...prev, name: prev.name || user.name, phone: prev.phone || user.phone || "" }));
  }, [user]);

  const isInternational = address.country !== "MN";

  useEffect(() => {
    if (!isInternational || !cart) return;
    setShippingSelections((prev) => {
      const next = { ...prev };
      for (const group of cart.sellerGroups) next[group.shopId] = "international_post";
      return next;
    });
  }, [isInternational, cart]);

  const currencyIssues = useMemo(() => {
    if (!cart || payCurrency !== "USD") return [];
    return cart.items
      .filter((item) => item.unitPrice?.currency !== "USD")
      .map((item) => item.product?.titleText || item.productId);
  }, [cart, payCurrency]);

  const intlIssues = useMemo(() => {
    if (!cart || !isInternational) return [];
    return cart.items
      .filter((item) => !item.product?.shipsInternationally)
      .map((item) => item.product?.titleText || item.productId);
  }, [cart, isInternational]);

  async function placeOrder(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // `paymentMethod` илгээхгүй — backend валютаас нь тодорхойлно.
      const data = await api.post<{ order: Order }>("/checkout", {
        currency: payCurrency,
        shippingAddress: address,
        shippingSelections,
        couponCode: coupon || undefined,
      });
      setOrder(data.order);
      await refreshCart();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function updateQuantity(itemId: string, quantity: number) {
    if (quantity < 1) return;
    setBusyItem(itemId);
    setError(null);
    try {
      const data = await api.patch<{ cart: Cart }>(`/cart/items/${itemId}`, { quantity, locale, currency });
      setCart(data.cart);
      await refreshCart();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusyItem(null);
    }
  }

  async function removeItem(itemId: string) {
    setBusyItem(itemId);
    try {
      const data = await api.del<{ cart: Cart }>(`/cart/items/${itemId}`, { query: { locale, currency } });
      setCart(data.cart);
      await refreshCart();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusyItem(null);
    }
  }

  if (loading) {
    return (
      <div className="page py-12">
        <div className="card h-64 skeleton" />
      </div>
    );
  }

  const groups = cart?.sellerGroups ?? [];
  const itemCount = cart?.items.length ?? 0;

  if (order) {
    return (
      <div className="page max-w-xl py-16 text-center">
        <div className="card-pad">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
            ✓
          </div>
          <h1 className="mt-4 text-2xl font-semibold">{t("checkout.success")}</h1>
          <p className="muted mt-2">{t("checkout.successNote")}</p>
          <dl className="mt-6 space-y-2 rounded-xl bg-paper p-4 text-left text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted">{t("common.order")}</span>
              <span className="font-medium">{order.id}</span>
            </div>
            {order.coupon ? (
              <div className="flex justify-between gap-3">
                <span className="text-muted">
                  {t("cart.couponCode")} · {order.coupon.code}
                </span>
                <span className="font-medium text-clay">−{formatMoney(order.coupon.discount, locale)}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <span className="text-muted">{t("cart.subtotal")}</span>
              <span className="font-medium">{formatMoney(order.subtotal, locale)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">{t("common.commission")}</span>
              <span className="font-medium">{formatMoney(order.commissionTotal, locale)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">{t("checkout.payment")}</span>
              <span className="font-medium">{order.payment.method.toUpperCase()}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">{t("common.escrow")}</span>
              <span className="font-medium">{t("orders.escrowHeld")}</span>
            </div>
          </dl>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/orders" className="btn-primary">
              {t("checkout.viewOrders")}
            </Link>
            <Link href="/products" className="btn-secondary">
              {t("cart.emptyCta")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="mt-8">
        <EmptyState title={t("cart.empty")} actionLabel={t("cart.emptyCta")} actionHref="/products" />
      </div>
    );
  }

  return (
    <form onSubmit={placeOrder} className="page-wide grid gap-6 py-10 lg:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("cart.title")}</h1>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {groups.length > 1 ? <Alert tone="info">{t("cart.multiSeller")}</Alert> : null}
        {currencyIssues.length ? (
          <Alert tone="warn">
            USD: {currencyIssues.join(", ")} — {t("common.error")} (энэ бүтээлд олон улсын үнэ тохируулаагүй байна).
          </Alert>
        ) : null}
        {intlIssues.length ? <Alert tone="warn">✈ {intlIssues.join(", ")}</Alert> : null}

        {groups.map((group) => (
          <section key={group.sellerId} className="card overflow-hidden">
            <header className="flex items-center justify-between gap-3 border-b border-line bg-paper px-5 py-3">
              <Link href={`/shop/${group.shop?.slug}`} className="text-sm font-medium hover:underline">
                {group.shop?.displayName || t("common.shop")}
              </Link>
              <span className="text-sm font-semibold">{formatMoney(group.subtotal, locale)}</span>
            </header>
            <div className="divide-y divide-line/70">
              {group.items.map((item) => (
                <div key={item.id} className="flex gap-4 p-5">
                  <Link href={`/products/${item.productId}`} className="shrink-0">
                    <img
                      src={imageOrPlaceholder(item.product?.images?.[0])}
                      alt={item.product?.titleText || ""}
                      className="h-24 w-24 rounded-xl object-cover"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${item.productId}`} className="font-medium hover:underline">
                      {item.product?.titleText}
                    </Link>
                    <p className="muted mt-0.5 text-xs">
                      {t(`inv.${item.product?.inventoryType}`)}
                      {item.orderType === "custom" ? ` · ${t("nav.custom")}` : ""}
                    </p>
                    {item.availableShippingOptions?.length ? (
                      <p className="muted mt-1 text-xs">
                        {t("cart.shippingOption")}: {item.availableShippingOptions.find((option) => option.code === item.shippingOption)?.label ||
                          item.availableShippingOptions[0].label}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {item.orderType === "custom" ? (
                        <span className="badge-neutral">×{item.quantity}</span>
                      ) : (
                        <div className="flex items-center rounded-full border border-line">
                          <button
                            type="button"
                            className="cursor-pointer px-3 py-1.5 leading-none"
                            disabled={busyItem === item.id}
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm">
                            {busyItem === item.id ? <Spinner className="h-3 w-3" /> : item.quantity}
                          </span>
                          <button
                            type="button"
                            className="cursor-pointer px-3 py-1.5 leading-none"
                            disabled={busyItem === item.id}
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        disabled={busyItem === item.id}
                        onClick={() => removeItem(item.id)}
                      >
                        {t("cart.remove")}
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatMoney(item.lineTotal, locale)}</p>
                    <p className="muted text-xs">{formatMoney(item.unitPrice, locale)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card-pad space-y-4">
          <div className="flex items-center justify-between">
            <span className="muted">{t("cart.subtotal")}</span>
            <span className="text-lg font-semibold">{formatMoney(cart?.totals.subtotal, locale)}</span>
          </div>
          <p className="muted text-xs">{t("checkout.escrowNote")}</p>

          <CouponCheck onApplied={setCoupon} />

          <section className="space-y-3 rounded-3xl border border-line p-4">
            <h2 className="font-medium">{t("checkout.address")}</h2>
            <Field label={t("checkout.recipient")} required>
              <input
                className="input"
                required
                value={address.name}
                onChange={(event) => setAddress({ ...address, name: event.target.value })}
              />
            </Field>
            <Field label={t("common.phone")} required>
              <input
                className="input"
                required
                value={address.phone}
                onChange={(event) => setAddress({ ...address, phone: event.target.value })}
              />
            </Field>
            <Field label={t("checkout.country")} required>
              <select
                className="input"
                value={address.country}
                onChange={(event) => setAddress({ ...address, country: event.target.value })}
              >
                <option value="MN">Монгол (MN)</option>
                <option value="US">United States</option>
                <option value="DE">Germany</option>
                <option value="JP">Japan</option>
                <option value="KR">Korea</option>
                <option value="FR">France</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label={t("checkout.city")} required>
              <input
                className="input"
                required
                value={address.city}
                onChange={(event) => setAddress({ ...address, city: event.target.value })}
              />
            </Field>
            <Field label={t("checkout.line1")} required>
              <input
                className="input"
                required
                value={address.line1}
                onChange={(event) => setAddress({ ...address, line1: event.target.value })}
              />
            </Field>
            <Field label={t("checkout.zip")}>
              <input
                className="input"
                value={address.zip}
                onChange={(event) => setAddress({ ...address, zip: event.target.value })}
              />
            </Field>
          </section>

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner /> : null}
            {t("cart.checkout")}
          </button>
          <Link href="/products" className="btn-ghost w-full">
            {t("cart.emptyCta")}
          </Link>
        </div>
      </aside>
    </form>
  );
}

/**
 * Купон код шалгаж, хүчинтэй бол эцэг хэсэгт мэдэгдэнэ. Тэндээс `/checkout`-д
 * дамжиж, хөнгөлөлт нь төлөх дүнгээс бодитоор хасагдана.
 *
 * Хэсэг нь checkout `<form>`-ын дотор байгаа тул товч нь `type="button"` —
 * эс бөгөөс купон шалгах гэсэн даралт захиалгыг илгээчихнэ.
 */
function CouponCheck({ onApplied }: { onApplied: (code: string) => void }) {
  const { t, locale } = useApp();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function check() {
    const value = code.trim().toUpperCase();
    if (!value) return;
    setBusy(true);
    setResult(null);
    onApplied("");
    try {
      const data = await api.post<{ coupon: { type: string; value: number; currency: Currency } }>(
        "/coupons/validate",
        { code: value }
      );
      const preview =
        data.coupon.type === "percent"
          ? `${data.coupon.value}%`
          : formatMoney({ amount: data.coupon.value, currency: data.coupon.currency }, locale);
      setResult({ tone: "success", text: t("cart.couponValid", { preview }) });
      onApplied(value);
    } catch (caught) {
      setResult({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2 rounded-3xl border border-line p-4">
      <span className="label">{t("cart.couponCode")}</span>
      <div className="flex gap-2">
        <input
          className="input uppercase"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            // Код өөрчлөгдвөл өмнөх баталгаа хүчингүй — хуучин кодоор төлбөр хийхээс сэргийлнэ.
            onApplied("");
            setResult(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              check();
            }
          }}
        />
        <button type="button" className="btn-secondary shrink-0" disabled={busy || !code.trim()} onClick={check}>
          {busy ? <Spinner className="h-3 w-3" /> : null}
          {t("cart.couponCheck")}
        </button>
      </div>
      {result ? <Alert tone={result.tone}>{result.text}</Alert> : null}
    </section>
  );
}
