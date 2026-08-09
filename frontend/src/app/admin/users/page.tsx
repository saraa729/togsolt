"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatDate } from "@/lib/format";
import type { User } from "@/lib/types";

export default function AdminUsersPage() {
  const { t, locale } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ users: User[] }>("/admin/users");
      setUsers(data.users || []);
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleDisabled(user: User) {
    setBusy(user.id);
    try {
      await api.patch(`/admin/users/${user.id}`, { disabled: !user.disabled });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  const filtered = users.filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  if (loading) return <div className="card h-64 skeleton" />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.users")}</h1>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <input
        className="input max-w-sm"
        placeholder={t("common.search")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {filtered.length === 0 ? (
        <EmptyState title={t("common.empty")} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("common.name")}</th>
                <th>{t("common.email")}</th>
                <th>{t("common.role")}</th>
                <th>{t("common.date")}</th>
                <th>{t("common.status")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td className="font-medium">{user.name}</td>
                  <td className="text-xs">{user.email}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(user.roles || []).map((role) => (
                        <span key={role} className="badge-neutral">
                          {t(`common.${role}`)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="text-xs text-muted">{formatDate(user.createdAt, locale)}</td>
                  <td>
                    <span className={user.disabled ? "badge bg-red-50 text-red-700" : "badge bg-emerald-50 text-emerald-700"}>
                      {user.disabled ? "disabled" : "active"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={user.disabled ? "btn-secondary btn-sm" : "btn-danger btn-sm"}
                      disabled={busy === user.id}
                      onClick={() => toggleDisabled(user)}
                    >
                      {busy === user.id ? <Spinner className="h-3 w-3" /> : null}
                      {user.disabled ? t("admin.enable") : t("admin.disable")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
