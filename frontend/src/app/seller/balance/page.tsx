"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Spinner, Stat, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatAmount, formatDateTime, formatMoney } from "@/lib/format";
import type { Balances, Currency, PayoutRequest } from "@/lib/types";

export default function SellerBalancePage() {
  const { t, locale } = useApp();
  const [balances, setBalances] = useState<Balances | null>(null);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [payoutCurrency, setPayoutCurrency] = useState<Currency>("MNT");
  const [bankAccount, setBankAccount] = useState({ bankName: "", accountNumber: "", accountName: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ balances: Balances; payoutRequests: PayoutRequest[] }>("/seller/balance");
      setBalances(data.balances);
      setRequests(data.payoutRequests || []);
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function requestPayout(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.post("/seller/payout-requests", {
        currency: payoutCurrency,
        amount: amount ? Number(amount) : undefined,
        method: "domestic_bank",
        bankAccount,
      });
      setAmount("");
      setMessage({ tone: "success", text: t("common.saved") });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="card h-64 skeleton" />;

  const available = balances?.sellerBalance?.[payoutCurrency] || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("seller.balance")}</h1>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("seller.available")} value={formatAmount(available, payoutCurrency)} />
        <Stat label={t("seller.escrowHeldLabel")} value={formatAmount(balances?.escrowHeld?.[payoutCurrency], payoutCurrency)} />
        <Stat label={t("seller.releasedLabel")} value={formatAmount(balances?.sellerReleased?.[payoutCurrency], payoutCurrency)} />
        <Stat
          label={t("seller.commissionLabel")}
          value={formatAmount(balances?.platformCommission?.[payoutCurrency], payoutCurrency)}
        />
      </div>

      <form onSubmit={requestPayout} className="card-pad space-y-4">
        <h2 className="font-medium">{t("seller.requestPayout")}</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="block">
            <span className="label">{t("common.currency")}</span>
            <select
              className="input"
              value={payoutCurrency}
              onChange={(event) => setPayoutCurrency(event.target.value as Currency)}
            >
              <option value="MNT">MNT (₮)</option>
              <option value="USD">USD ($)</option>
            </select>
          </label>
          <label className="block">
            <span className="label">{t("common.total")}</span>
            <input
              className="input"
              inputMode="numeric"
              placeholder={String(available)}
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label className="block">
            <span className="label">Bank</span>
            <input
              className="input"
              value={bankAccount.bankName}
              onChange={(event) => setBankAccount({ ...bankAccount, bankName: event.target.value })}
              placeholder="Хаан банк"
            />
          </label>
          <label className="block">
            <span className="label">Account</span>
            <input
              className="input"
              value={bankAccount.accountNumber}
              onChange={(event) => setBankAccount({ ...bankAccount, accountNumber: event.target.value })}
              placeholder="5001234567"
            />
          </label>
        </div>
        <button type="submit" className="btn-primary" disabled={busy || available <= 0}>
          {busy ? <Spinner /> : null}
          {t("seller.requestPayout")}
        </button>
        {available <= 0 ? <p className="muted text-xs">{t("orders.confirmHint")}</p> : null}
      </form>

      <section>
        <h2 className="pb-3 font-medium">{t("seller.payoutHistory")}</h2>
        {requests.length === 0 ? (
          <EmptyState title={t("common.empty")} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t("common.total")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.date")}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="font-mono text-xs">{request.id}</td>
                    <td>{formatMoney(request.amount, locale)}</td>
                    <td>
                      <StatusPill status={request.status} />
                    </td>
                    <td className="text-xs text-muted">{formatDateTime(request.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
