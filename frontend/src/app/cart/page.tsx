"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QrCode from "@/components/QrCode";
import RequireAuth from "@/components/RequireAuth";
import { Alert, EmptyState, Spinner } from "@/components/ui";
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
  const { refreshCart } = useAuth();
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
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [locale, payCurrency]);

  useEffect(() => {
    load();
  }, [load]);

  const currencyIssues = useMemo(() => {
    if (!cart || payCurrency !== "USD") return [];
    return cart.items
      .filter((item) => item.unitPrice?.currency !== "USD")
      .map((item) => item.product?.titleText || item.productId);
  }, [cart, payCurrency]);

  async function placeOrder(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // `paymentMethod` илгээхгүй — backend валют, тохиргооноос нь тодорхойлно.
      const data = await api.post<{ order: Order; orderItems?: Order["items"]; payment: PaymentInstruction }>("/checkout", {
        cartId: cart?.id,
        currency: payCurrency,
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

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {groups.length > 1 ? <Alert tone="info">{t("cart.multiSeller")}</Alert> : null}
          {currencyIssues.length ? (
            <Alert tone="warn">
              USD: {currencyIssues.join(", ")} — {t("common.error")} (энэ бүтээлд олон улсын үнэ тохируулаагүй байна).
            </Alert>
          ) : null}

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
    <div className="page max-w-5xl py-12">
      <header className="animate-rise text-center">
        <span className="eyebrow inline-flex items-center gap-2 text-muted">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-clay" aria-hidden />
          {t("checkout.pendingEyebrow")}
        </span>
        <h1 className="display mt-3 text-[26px] leading-tight tracking-tight sm:text-[34px]">
          {t("checkout.pendingTitle")}
        </h1>
        <p className="display mt-3 text-[46px] leading-none tracking-tight sm:text-[58px]">
          {formatMoney(order.subtotal, locale)}
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[11px] text-muted">
          {t("common.order")}
          <span className="font-mono text-ink">{order.id}</span>
        </p>
      </header>

      <div className="mt-10 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {payment.simulated ? (
            <DemoPaymentMethods
              selected={selectedMethod}
              onSelect={setSelectedMethod}
              qrText={payment.qrText || ""}
              amount={order.subtotal}
              orderId={order.id}
            />
          ) : (
            <section className="card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 bg-paper px-5 py-3.5">
                <p className="label mb-0">QPay</p>
                {/* Жинхэнэ provider үед л тандалт явна — тиймээс эргэлдэгчийг энд харуулна. */}
                <span className="flex items-center gap-2 text-[11px] text-muted">
                  <Spinner className="h-3 w-3" />
                  {t("checkout.pendingWaiting")}
                </span>
              </header>
              <div className="grid items-center gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6">
                <ScanFrame>
                  {/* QPay зураг илгээгээгүй бол qr_text-ээс өөрсдөө зурна. */}
                  {payment.qrImage ? (
                    <img src={payment.qrImage} alt="" className="h-44 w-44" />
                  ) : payment.qrText ? (
                    <QrCode value={payment.qrText} size={176} label="QPay" />
                  ) : null}
                </ScanFrame>
                <p className="muted text-sm leading-relaxed">{t("checkout.pendingQrHint")}</p>
              </div>
            </section>
          )}

          {payment.deepLinks?.length ? (
            <div className="flex flex-wrap gap-2">
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

          {/*
           * Demo горимд гадаад баталгаажуулалт ирэхгүй — хэрэглэгч энэ товчийг
           * дарж л төлбөрөө баталгаажуулна.
           */}
          {payment.simulated ? (
            <section className="card overflow-hidden">
              <header className="flex items-center gap-2.5 border-b border-line/70 bg-gold-soft/50 px-5 py-3.5">
                <span className="badge-gold">{t("checkout.demoBadge")}</span>
                <p className="text-sm font-medium">{t("checkout.demoPaymentTitle")}</p>
              </header>
              <div className="p-5 sm:p-6">
                <p className="muted text-sm leading-relaxed">{t("checkout.demoPaymentBody")}</p>
                <button
                  type="button"
                  className="btn-primary mt-4 h-12 w-full text-sm"
                  disabled={busy}
                  onClick={confirmDemoPayment}
                >
                  {busy ? <Spinner /> : null}
                  {t("checkout.confirmDemoPaymentWith", { method: capitalize(demoPaymentLabel(selectedMethod, locale)) })}
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="card p-5">
            <p className="label">{t("cart.summary")}</p>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t("cart.subtotal")}</dt>
                <dd className="font-semibold">{formatMoney(order.subtotal, locale)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-muted">{t("checkout.payment")}</dt>
                <dd className="min-w-0 text-right font-medium">
                  {payment.simulated
                    ? capitalize(demoPaymentLabel(selectedMethod, locale))
                    : paymentMethodLabel(order.payment.method, locale)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="shrink-0 text-muted">{t("checkout.paymentStatus")}</dt>
                <dd className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-medium text-gold">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
                  {t("pstatus.pending")}
                </dd>
              </div>
            </dl>
          </div>

          <div className="card p-5">
            <p className="label">{t("checkout.paymentFlow")}</p>
            <PaymentSteps active={1} />
          </div>

          <p className="muted px-1 text-xs leading-relaxed">{t("checkout.escrowNote")}</p>
        </aside>
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
    <section className="card overflow-hidden text-left">
      <header className="border-b border-line/70 bg-paper px-5 py-3.5">
        <p className="label mb-0">{t("checkout.choosePayment")}</p>
      </header>

      <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
        {methods.map((method) => {
          const active = selected === method.id;
          return (
            <button
              key={method.id}
              type="button"
              aria-pressed={active}
              className={`craft-hover-lift flex cursor-pointer gap-3 rounded-2xl border p-4 text-left ${
                active
                  ? "border-clay bg-clay-soft/50 shadow-sm"
                  : "border-line bg-surface hover:border-clay/40 hover:bg-paper"
              }`}
              onClick={() => onSelect(method.id)}
            >
              <span
                aria-hidden
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${
                  active ? "bg-clay text-white" : "bg-paper text-muted"
                }`}
              >
                <MethodIcon method={method.id} className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{method.label}</span>
                  <span
                    aria-hidden
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors ${
                      active ? "border-clay bg-clay" : "border-line bg-surface"
                    }`}
                  >
                    {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </span>
                </span>
                <span className="muted mt-1 block text-xs leading-relaxed">{method.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-line/70 bg-paper/60 p-5 sm:p-6">
        {selected === "qpay" ? (
          <div className="animate-rise grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
            {/*
             * Жинхэнэ уншигдах QR. Утга нь demo payload тул QPay апп таних-
             * гүй ч дурын QR уншигчаар шалгаж болно — үзүүлэнд бодитой.
             */}
            <ScanFrame caption="QPay · demo">
              <QrCode value={qrText || orderId} size={176} label={t("checkout.qpayDemoTitle")} />
            </ScanFrame>

            <div className="min-w-0">
              <p className="font-medium">{t("checkout.qpayDemoTitle")}</p>
              <p className="muted mt-1.5 text-sm leading-relaxed">{t("checkout.qpayDemoBody")}</p>

              <dl className="mt-4 divide-y divide-line/60 border-y border-line/60 text-sm">
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-muted">{t("cart.subtotal")}</dt>
                  <dd className="text-base font-semibold">{formatMoney(amount, locale)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-muted">{t("common.order")}</dt>
                  <dd className="truncate font-mono text-xs">{orderId}</dd>
                </div>
              </dl>

              <details className="group mt-3">
                <summary className="cursor-pointer list-none text-xs text-muted transition-colors hover:text-ink">
                  <span className="inline-block transition-transform group-open:rotate-90">▸</span> {t("checkout.qrText")}
                </summary>
                <p className="mt-2 rounded-xl border border-line bg-surface p-2.5 font-mono text-[11px] break-all text-muted">
                  {qrText || orderId}
                </p>
              </details>
            </div>
          </div>
        ) : null}

        {selected === "bank_app" ? (
          <div className="animate-rise">
            <p className="font-medium">{t("checkout.bankAppDemoTitle")}</p>
            <p className="muted mt-1.5 text-sm leading-relaxed">{t("checkout.methodBankApp")}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DEMO_BANKS.map((bank) => (
                <span
                  key={bank.name}
                  className="craft-hover-lift flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5"
                >
                  <span
                    aria-hidden
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-pine-soft text-[11px] font-semibold text-pine"
                  >
                    {bank.short}
                  </span>
                  <span className="min-w-0 truncate text-xs font-medium">{bank.name}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {selected === "card" ? (
          <div className="animate-rise grid items-center gap-6 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
            <div className="relative overflow-hidden rounded-2xl bg-night p-5 text-cream shadow-[0_18px_40px_rgba(34,28,21,0.28)]">
              <span aria-hidden className="absolute -top-14 -right-12 h-40 w-40 rounded-full bg-sand/15" />
              <span aria-hidden className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-clay/25" />
              <div className="relative flex items-center justify-between">
                <span className="text-[10px] tracking-[0.22em] text-sand uppercase">ExpoCraft</span>
                <span className="text-[10px] tracking-[0.22em] text-sand/70 uppercase">demo</span>
              </div>
              <span aria-hidden className="relative mt-6 block h-7 w-10 rounded-md bg-linear-to-br from-sand to-gold" />
              <p className="relative mt-4 font-mono text-[15px] tracking-[0.16em]">4242 4242 4242 4242</p>
              <div className="relative mt-4 flex gap-7 text-[10px]">
                <span>
                  <span className="block tracking-[0.14em] text-sand/70 uppercase">{t("checkout.cardExpiry")}</span>
                  <span className="mt-0.5 block font-mono text-xs tracking-wider">12 / 30</span>
                </span>
                <span>
                  <span className="block tracking-[0.14em] text-sand/70 uppercase">CVC</span>
                  <span className="mt-0.5 block font-mono text-xs tracking-wider">123</span>
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="font-medium">{t("checkout.cardDemoTitle")}</p>
              <p className="muted mt-1.5 text-sm leading-relaxed">{t("checkout.methodCard")}</p>
              <dl className="mt-4 divide-y divide-line/60 border-y border-line/60 text-sm">
                <CopyRow label={t("checkout.cardNumber")} value="4242 4242 4242 4242" />
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-muted">{t("cart.subtotal")}</dt>
                  <dd className="font-semibold">{formatMoney(amount, locale)}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : null}

        {selected === "bank_transfer" ? (
          <div className="animate-rise">
            <p className="font-medium">{t("checkout.transferDemoTitle")}</p>
            <p className="muted mt-1.5 text-sm leading-relaxed">{t("checkout.methodTransfer")}</p>
            <dl className="mt-4 divide-y divide-line/60 border-y border-line/60 text-sm">
              <CopyRow label={t("checkout.transferAccount")} value="5111222333" hint="ExpoCraft Demo" />
              <CopyRow label={t("common.order")} value={orderId} />
              <div className="flex items-baseline justify-between gap-3 py-2.5">
                <dt className="text-muted">{t("cart.subtotal")}</dt>
                <dd className="text-base font-semibold">{formatMoney(amount, locale)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  );
}

const DEMO_BANKS = [
  { name: "Khan Bank", short: "KH" },
  { name: "Golomt", short: "GL" },
  { name: "TDB", short: "TDB" },
  { name: "State Bank", short: "ST" },
];

/** QR-ыг уншигчийн хүрээ мэт булангийн хаалттайгаар онцолж харуулна. */
function ScanFrame({ children, caption }: { children: React.ReactNode; caption?: string }) {
  const corners = [
    "top-2 left-2 border-t-2 border-l-2 rounded-tl-md",
    "top-2 right-2 border-t-2 border-r-2 rounded-tr-md",
    "bottom-2 left-2 border-b-2 border-l-2 rounded-bl-md",
    "bottom-2 right-2 border-b-2 border-r-2 rounded-br-md",
  ];
  return (
    <figure className="mx-auto w-fit sm:mx-0">
      <div className="relative rounded-2xl bg-white p-4 shadow-[0_14px_34px_rgba(34,28,21,0.12)] ring-1 ring-line/70">
        {corners.map((corner) => (
          <span key={corner} aria-hidden className={`absolute h-5 w-5 border-clay ${corner}`} />
        ))}
        {children}
      </div>
      {caption ? (
        <figcaption className="mt-2.5 text-center text-[10px] font-medium tracking-[0.18em] text-muted uppercase">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Хуулж авах боломжтой мөр — demo реквизитийг гараар бичих шаардлагагүй. */
function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { t } = useApp();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard-ыг хориглосон орчин байж болно — чимээгүй өнгөрнө.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-right font-mono text-xs">
          {hint ? <span className="mr-2 font-sans text-muted">{hint}</span> : null}
          {value}
        </span>
        <button type="button" className="btn-ghost btn-sm shrink-0 text-[11px]" onClick={copy}>
          {copied ? t("common.copied") : t("common.copy")}
        </button>
      </dd>
    </div>
  );
}

/** Escrow-ийн 3 алхмыг дугаарлаж харуулна. `active` нь одоо явж буй алхам. */
function PaymentSteps({ active }: { active?: number }) {
  const { t } = useApp();
  const steps = [t("checkout.paymentStepCart"), t("checkout.paymentStepEscrow"), t("checkout.paymentStepSeller")];

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const done = active !== undefined && index < active;
        const current = active === index;
        return (
          <li key={step} className="flex gap-3">
            <span
              aria-hidden
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                done
                  ? "bg-pine text-white"
                  : current
                    ? "bg-clay text-white"
                    : "border border-line bg-paper text-muted"
              }`}
            >
              {done ? "✓" : index + 1}
            </span>
            <span className={`text-xs leading-relaxed ${current ? "text-ink" : "text-muted"}`}>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

function MethodIcon({ method, className = "" }: { method: DemoPaymentMethod; className?: string }) {
  const paths: Record<DemoPaymentMethod, React.ReactNode> = {
    qpay: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 14h3v3h-3zM20.5 14v1.5M14 20.5h1.5M18 20.5h3V18" />
      </>
    ),
    bank_app: (
      <>
        <rect x="6" y="2.5" width="12" height="19" rx="3" />
        <path d="M10.5 18.5h3M9.5 9.8l1.9 1.9L15 8.1" />
      </>
    ),
    card: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="3" />
        <path d="M2.5 9.5h19M6.5 15h4" />
      </>
    ),
    bank_transfer: (
      <>
        <path d="M3.5 9.5 12 4.5l8.5 5" />
        <path d="M5.8 11v6.5M10 11v6.5M14 11v6.5M18.2 11v6.5M3.5 20h17" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[method]}
    </svg>
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
      <div className="mt-4">
        <PaymentSteps />
      </div>
      <p className="mt-4 rounded-xl bg-surface px-3 py-2 text-xs text-muted">{t("checkout.demoPaymentHint")}</p>
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

/** Өгүүлбэрийн эхэнд эсвэл товч дээр бичихэд эхний үсгийг том болгоно. */
function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
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
