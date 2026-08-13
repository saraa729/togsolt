"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { Alert, EmptyState, Field, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, imageOrPlaceholder } from "@/lib/format";
import type { Cart, Currency, Order, PaymentInstruction } from "@/lib/types";

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
  const [orderItems, setOrderItems] = useState<Order["items"]>([]);
  /** QPay QR гэх мэт төлбөр хүлээх заавар. Stripe үед энд хүрэхгүй (redirect хийнэ). */
  const [payment, setPayment] = useState<PaymentInstruction | null>(null);
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
      // `paymentMethod` илгээхгүй — backend валют, тохиргооноос нь тодорхойлно.
      const data = await api.post<{ order: Order; orderItems?: Order["items"]; payment: PaymentInstruction }>("/checkout", {
        cartId: cart?.id,
        currency: payCurrency,
        shippingAddress: address,
        shippingSelections,
        couponCode: coupon || undefined,
      });
      await refreshCart();

      /*
       * Захиалга `pending_payment` төлөвөөр үүснэ — мөнгө хараахан ороогүй.
       * Stripe бол өөрийнх нь хуудас руу шилжүүлнэ, QPay бол QR харуулж
       * төлөлтийг тандана, provider тохируулаагүй demo горимд хэрэглэгч
       * тусдаа баталгаажуулах товч дарсны дараа л амжилтын дэлгэц харуулна.
       */
      if (data.payment?.redirectUrl) {
        window.location.href = data.payment.redirectUrl;
        return;
      }
      setPayment(data.payment || null);
      setOrder(data.order);
      setOrderItems(data.orderItems || data.order.items || []);
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
      <div className="page-wide">
        <div className="h-9 w-48 rounded-full skeleton" />
        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <div className="h-40 rounded-3xl skeleton" />
            <div className="h-72 rounded-3xl skeleton" />
          </div>
          <div className="h-64 rounded-3xl skeleton" />
        </div>
      </div>
    );
  }

  const groups = cart?.sellerGroups ?? [];
  const itemCount = cart?.items.length ?? 0;

  if (order && order.status === "pending_payment" && payment) {
    return (
      <PaymentPending
        order={order}
        payment={payment}
        onSettled={(settled) =>
          setOrder({
            ...order,
            ...settled,
            payment: { ...order.payment, ...(settled.payment || {}) },
          })
        }
      />
    );
  }

  if (order && order.status === "payment_failed") {
    return (
      <div className="page max-w-xl py-16 text-center">
        <div className="card-pad space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl text-red-600">!</div>
          <h1 className="text-2xl font-semibold">{t("orders.paymentFailed")}</h1>
          <p className="muted">{t("checkout.paymentFailed")}</p>
          <Link href="/products" className="btn-primary">
            {t("cart.emptyCta")}
          </Link>
        </div>
      </div>
    );
  }

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
              <span className="font-medium">{paymentMethodLabel(order.payment.method, locale)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">{t("checkout.paymentStatus")}</span>
              <span className="font-medium">{t(`pstatus.${order.payment.status}`, order.payment.status)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">{t("common.escrow")}</span>
              <span className="font-medium">{t("orders.escrowHeld")}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">{t("checkout.sellerVisible")}</span>
              <span className="font-medium">{t("checkout.sellerVisibleCount", { count: orderItems?.length || 0 })}</span>
            </div>
          </dl>
          <Alert tone="success">{t("checkout.sellerVisibleNote")}</Alert>
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
    <form onSubmit={placeOrder} className="page-wide">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="display text-[28px] leading-tight tracking-tight sm:text-[34px]">{t("cart.title")}</h1>
        <p className="muted text-sm">{t("cart.itemCount", { count: itemCount })}</p>
      </header>

      {/*
       * Хаягийн маягтыг зүүн баганад байрлуулав. Өмнө нь хажуугийн самбарт
       * байсан тул самбар нь дэлгэцээс өндөр болж `sticky` үйлчлэхээ болиод,
       * "Сагсаас төлөх" товч нь эвхэгдсэн хэсэгт унадаг байв.
       */}
      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
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
              <header className="flex items-center justify-between gap-3 border-b border-line bg-paper px-5 py-3.5">
                <Link href={`/shop/${group.shop?.slug}`} className="text-sm font-medium underline-offset-4 hover:underline">
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
                        className="h-24 w-24 rounded-2xl border border-line/70 object-cover"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/products/${item.productId}`} className="font-medium underline-offset-4 hover:underline">
                          {item.product?.titleText}
                        </Link>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold">{formatMoney(item.lineTotal, locale)}</p>
                          {/* Нэгжийн үнэ зөвхөн олон ширхэг үед л мэдээлэл нэмнэ. */}
                          {item.quantity > 1 ? (
                            <p className="muted text-xs">
                              {formatMoney(item.unitPrice, locale)} × {item.quantity}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <p className="muted mt-1 text-xs">
                        {t(`inv.${item.product?.inventoryType}`)}
                        {item.orderType === "custom" ? ` · ${t("nav.custom")}` : ""}
                        {item.availableShippingOptions?.length
                          ? ` · ${
                              item.availableShippingOptions.find((option) => option.code === item.shippingOption)?.label ||
                              item.availableShippingOptions[0].label
                            }`
                          : ""}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {item.orderType === "custom" ? (
                          <span className="badge-neutral">×{item.quantity}</span>
                        ) : (
                          <div className="flex items-center gap-1 rounded-full border border-line bg-paper p-1">
                            <button
                              type="button"
                              className="grid h-7 w-7 cursor-pointer place-items-center rounded-full leading-none transition-colors hover:bg-surface disabled:opacity-40"
                              disabled={busyItem === item.id || item.quantity <= 1}
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              aria-label="−"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-semibold tabular-nums">
                              {busyItem === item.id ? <Spinner className="h-3 w-3" /> : item.quantity}
                            </span>
                            <button
                              type="button"
                              className="grid h-7 w-7 cursor-pointer place-items-center rounded-full leading-none transition-colors hover:bg-surface disabled:opacity-40"
                              disabled={busyItem === item.id}
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              aria-label="+"
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
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="card space-y-4 p-5 sm:p-6">
            <h2 className="font-medium">{t("checkout.address")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("checkout.recipient")} required>
                <input
                  className="input"
                  required
                  autoComplete="name"
                  value={address.name}
                  onChange={(event) => setAddress({ ...address, name: event.target.value })}
                />
              </Field>
              <Field label={t("common.phone")} required>
                <input
                  className="input"
                  required
                  autoComplete="tel"
                  value={address.phone}
                  onChange={(event) => setAddress({ ...address, phone: event.target.value })}
                />
              </Field>
              <Field label={t("checkout.country")} required>
                <select
                  className="input"
                  autoComplete="country"
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
                  autoComplete="address-level2"
                  value={address.city}
                  onChange={(event) => setAddress({ ...address, city: event.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("checkout.line1")} required>
                  <input
                    className="input"
                    required
                    autoComplete="address-line1"
                    value={address.line1}
                    onChange={(event) => setAddress({ ...address, line1: event.target.value })}
                  />
                </Field>
              </div>
              <Field label={t("checkout.zip")}>
                <input
                  className="input"
                  autoComplete="postal-code"
                  value={address.zip}
                  onChange={(event) => setAddress({ ...address, zip: event.target.value })}
                />
              </Field>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card space-y-4 p-5">
            <h2 className="label mb-0">{t("cart.summary")}</h2>

            <div className="flex items-baseline justify-between gap-3 border-y border-line/70 py-4">
              <span className="text-sm text-muted">{t("cart.subtotal")}</span>
              <span className="text-2xl font-semibold tracking-tight">{formatMoney(cart?.totals.subtotal, locale)}</span>
            </div>

            <CouponCheck onApplied={setCoupon} />

            <PaymentMethodSummary currency={payCurrency} />

            <button type="submit" className="btn-primary h-12 w-full text-sm" disabled={busy}>
              {busy ? <Spinner /> : null}
              {t("cart.checkout")}
            </button>

            <p className="muted text-xs leading-relaxed">{t("checkout.escrowNote")}</p>

            <Link href="/products" className="btn-ghost btn-sm w-full">
              {t("cart.emptyCta")}
            </Link>
          </div>
        </aside>
      </div>
    </form>
  );
}

/**
 * Төлбөр хүлээх дэлгэц (QPay QR). Backend `pending_payment` захиалга үүсгэсэн
 * ч мөнгө хараахан ороогүй тул `/orders/:id/payment`-ыг тандаж, provider
 * баталгаажуулмагц эцэг хэсэгт мэдэгдэнэ. Stripe үед энд хүрэхгүй — хэрэглэгч
 * Stripe-ийн хуудас руу шилжсэн байна.
 */
function PaymentPending({
  order,
  payment,
  onSettled,
}: {
  order: Order;
  payment: PaymentInstruction;
  onSettled: (settled: { status: string; escrowStatus: string; payment?: Partial<Order["payment"]> }) => void;
}) {
  const { t, locale } = useApp();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<DemoPaymentMethod>("qpay");

  /*
   * Эцэг хэсэг дахин зурагдах бүрд шинэ callback ирдэг тул түүнийг effect-ийн
   * хамаарлаас гаргаж ref-д хадгална — эс бөгөөс тандалт байнга тасарч
   * дахин эхлэх байв.
   */
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    let active = true;
    const timer = setInterval(async () => {
      try {
        const data = await api.get<{ status: string; escrowStatus: string; payment?: Partial<Order["payment"]> }>(
          `/orders/${order.id}/payment`
        );
        if (!active) return;
        if (data.status !== "pending_payment") {
          clearInterval(timer);
          settledRef.current(data);
        }
      } catch {
        // Түр саатал байж болно — дараагийн тандалт дээр дахин оролдоно.
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [order.id]);

  async function confirmDemoPayment() {
    setBusy(true);
    setMessage(null);
    try {
      const data = await api.post<{
        order: Order;
        orderItems?: Order["items"];
        alreadyCaptured?: boolean;
      }>(`/orders/${order.id}/payment/demo-capture`, { demoMethod: selectedMethod });
      settledRef.current({
        status: data.order.status,
        escrowStatus: data.order.escrowStatus,
        payment: data.order.payment,
      });
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page max-w-2xl py-16 text-center">
      <div className="card-pad space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">{t("checkout.pendingTitle")}</h1>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{formatMoney(order.subtotal, locale)}</p>
        </div>

        {payment.simulated ? (
          <DemoPaymentMethods
            selected={selectedMethod}
            onSelect={setSelectedMethod}
            qrText={payment.qrText || ""}
            amount={order.subtotal}
            orderId={order.id}
          />
        ) : (
          <>
            {payment.qrImage ? (
              <img
                src={payment.qrImage}
                alt=""
                className="mx-auto h-56 w-56 rounded-2xl border border-line bg-surface p-2"
              />
            ) : null}

            {!payment.qrImage && payment.qrText ? (
              <div className="rounded-2xl border border-line bg-paper p-4 text-left">
                <p className="label mb-2">{t("checkout.qrText")}</p>
                <p className="break-all font-mono text-xs text-muted">{payment.qrText}</p>
              </div>
            ) : null}
          </>
        )}

        {!payment.simulated ? <p className="muted text-sm leading-relaxed">{t("checkout.pendingQrHint")}</p> : null}

        {payment.simulated ? (
          <div className="rounded-2xl border border-line bg-paper p-4 text-left">
            <p className="font-medium">{t("checkout.demoPaymentTitle")}</p>
            <p className="muted mt-1 text-sm leading-relaxed">{t("checkout.demoPaymentBody")}</p>
            <button type="button" className="btn-primary mt-4 w-full" disabled={busy} onClick={confirmDemoPayment}>
              {busy ? <Spinner /> : null}
              {t("checkout.confirmDemoPaymentWith", { method: demoPaymentLabel(selectedMethod, locale) })}
            </button>
          </div>
        ) : null}

        {payment.deepLinks?.length ? (
          <div className="flex flex-wrap justify-center gap-2">
            {payment.deepLinks.slice(0, 6).map((link) => (
              <a
                key={link.link || link.name}
                href={link.link}
                className="btn-secondary btn-sm"
                target="_blank"
                rel="noreferrer"
              >
                {link.name || t("checkout.openBankApp")}
              </a>
            ))}
          </div>
        ) : null}

        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

        <p className="flex items-center justify-center gap-2 text-xs text-muted">
          <Spinner className="h-3 w-3" />
          {t("checkout.pendingWaiting")}
        </p>

        <p className="font-mono text-[11px] text-muted">{order.id}</p>
      </div>
    </div>
  );
}

type DemoPaymentMethod = "qpay" | "bank_app" | "card" | "bank_transfer";

function DemoPaymentMethods({
  selected,
  onSelect,
  qrText,
  amount,
  orderId,
}: {
  selected: DemoPaymentMethod;
  onSelect: (method: DemoPaymentMethod) => void;
  qrText: string;
  amount: Order["subtotal"];
  orderId: string;
}) {
  const { t, locale } = useApp();
  const methods: { id: DemoPaymentMethod; label: string; description: string }[] = [
    { id: "qpay", label: "QPay", description: t("checkout.methodQpay") },
    { id: "bank_app", label: t("checkout.methodBankAppTitle"), description: t("checkout.methodBankApp") },
    { id: "card", label: t("checkout.methodCardTitle"), description: t("checkout.methodCard") },
    { id: "bank_transfer", label: t("checkout.methodTransferTitle"), description: t("checkout.methodTransfer") },
  ];

  return (
    <section className="space-y-4 text-left">
      <div>
        <p className="label">{t("checkout.choosePayment")}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {methods.map((method) => (
            <button
              key={method.id}
              type="button"
              className={`rounded-2xl border p-4 text-left transition ${
                selected === method.id
                  ? "border-clay bg-clay/10 shadow-sm"
                  : "border-line bg-paper hover:border-clay/40"
              }`}
              onClick={() => onSelect(method.id)}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold">{method.label}</span>
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${
                    selected === method.id ? "border-clay bg-clay text-white" : "border-line"
                  }`}
                  aria-hidden
                >
                  {selected === method.id ? "✓" : ""}
                </span>
              </span>
              <span className="muted mt-1 block text-xs leading-relaxed">{method.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-paper p-4">
        {selected === "qpay" ? (
          <>
            <p className="font-medium">{t("checkout.qpayDemoTitle")}</p>
            <p className="muted mt-1 text-sm">{t("checkout.qpayDemoBody")}</p>
            <div className="mt-4 rounded-xl border border-line bg-surface p-3">
              <p className="label mb-1">{t("checkout.qrText")}</p>
              <p className="break-all font-mono text-xs text-muted">{qrText || orderId}</p>
            </div>
          </>
        ) : null}

        {selected === "bank_app" ? (
          <>
            <p className="font-medium">{t("checkout.bankAppDemoTitle")}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {["Khan Bank", "Golomt", "TDB", "State Bank"].map((bank) => (
                <span key={bank} className="rounded-xl border border-line bg-surface px-3 py-2 text-center text-xs font-medium">
                  {bank}
                </span>
              ))}
            </div>
          </>
        ) : null}

        {selected === "card" ? (
          <>
            <p className="font-medium">{t("checkout.cardDemoTitle")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <span className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">4242 4242 4242 4242</span>
              <span className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">12 / 30</span>
              <span className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">123</span>
            </div>
          </>
        ) : null}

        {selected === "bank_transfer" ? (
          <>
            <p className="font-medium">{t("checkout.transferDemoTitle")}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("checkout.transferAccount")}</dt>
                <dd className="font-mono">ExpoCraft Demo / 5111222333</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("cart.subtotal")}</dt>
                <dd>{formatMoney(amount, locale)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("common.order")}</dt>
                <dd className="font-mono text-xs">{orderId}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </div>
    </section>
  );
}

function PaymentMethodSummary({ currency }: { currency: Currency }) {
  const { t, locale } = useApp();
  const provider = currency === "USD" ? "stripe" : "qpay";
  return (
    <section className="rounded-2xl border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="label">{t("checkout.payment")}</span>
          <p className="mt-1 font-semibold">{paymentMethodLabel(provider, locale)}</p>
        </div>
        <span className="badge-gold">{currency}</span>
      </div>
      <ol className="mt-3 space-y-2 text-xs text-muted">
        <li>{t("checkout.paymentStepCart")}</li>
        <li>{t("checkout.paymentStepEscrow")}</li>
        <li>{t("checkout.paymentStepSeller")}</li>
      </ol>
      <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-xs text-muted">{t("checkout.demoPaymentHint")}</p>
    </section>
  );
}

function demoPaymentLabel(method: DemoPaymentMethod, locale: string) {
  const labels: Record<DemoPaymentMethod, { mn: string; en: string }> = {
    qpay: { mn: "QPay", en: "QPay" },
    bank_app: { mn: "банкны апп", en: "bank app" },
    card: { mn: "карт", en: "card" },
    bank_transfer: { mn: "дансны шилжүүлэг", en: "bank transfer" },
  };
  return labels[method][locale === "mn" ? "mn" : "en"];
}

function paymentMethodLabel(method?: string | null, locale: string = "mn") {
  const key = String(method || "").toLowerCase();
  if (key === "qpay") return "QPay";
  if (key === "stripe") return "Stripe";
  if (key === "simulated") return locale === "mn" ? "Demo төлбөр" : "Demo payment";
  return method?.toUpperCase() || "—";
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
    <section className="space-y-2">
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
        <button type="button" className="btn-secondary btn-sm shrink-0" disabled={busy || !code.trim()} onClick={check}>
          {busy ? <Spinner className="h-3 w-3" /> : null}
          {t("cart.couponCheck")}
        </button>
      </div>
      {result ? <Alert tone={result.tone}>{result.text}</Alert> : null}
    </section>
  );
}
