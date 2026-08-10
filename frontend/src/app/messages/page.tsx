"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import RequireAuth from "@/components/RequireAuth";
import { Alert, EmptyState, Spinner } from "@/components/ui";
import { api, errorMessage, getToken } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { API_URL, classNames, formatDateTime } from "@/lib/format";
import type { Conversation } from "@/lib/types";

export default function MessagesPage() {
  return (
    <RequireAuth>
      <MessagesView />
    </RequireAuth>
  );
}

function MessagesView() {
  const { t, locale } = useApp();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [presence, setPresence] = useState<Record<string, string[]>>({});
  const [typing, setTyping] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ conversations: Conversation[] }>("/conversations");
      setConversations(data.conversations || []);
      setActiveId((current) => current || data.conversations?.[0]?.id || null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: Socket.io rooms, presence, typing.
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setLive(true));
    socket.on("realtime:ready", () => setLive(true));
    socket.on("disconnect", () => setLive(false));
    socket.on("connect_error", () => setLive(false));

    socket.on("conversation:upsert", (payload: { conversation: Conversation }) => {
      if (!payload.conversation) return;
      setConversations((prev) => {
        const exists = prev.some((conversation) => conversation.id === payload.conversation.id);
        if (exists) {
          return prev.map((conversation) =>
            conversation.id === payload.conversation.id ? { ...conversation, ...payload.conversation } : conversation
          );
        }
        return [payload.conversation, ...prev];
      });
    });

    socket.on("conversation:message", (payload: { conversationId: string; message: Conversation["messages"][number] }) => {
      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== payload.conversationId) return conversation;
          if (conversation.messages.some((message) => message.id === payload.message.id)) return conversation;
          return { ...conversation, messages: [...conversation.messages, payload.message], updatedAt: payload.message.createdAt };
        })
      );
      setTyping((prev) => ({ ...prev, [payload.conversationId]: [] }));
    });

    socket.on("conversation:presence", (payload: { conversationId: string; users: { id: string; name: string }[] }) => {
      setPresence((prev) => ({
        ...prev,
        [payload.conversationId]: (payload.users || []).filter((item) => item.id !== user?.id).map((item) => item.name),
      }));
    });

    socket.on("typing:update", (payload: { conversationId: string; userId: string; userName: string; typing: boolean }) => {
      if (!payload.conversationId || payload.userId === user?.id) return;
      setTyping((prev) => {
        const names = new Set(prev[payload.conversationId] || []);
        if (payload.typing) names.add(payload.userName);
        else names.delete(payload.userName);
        return { ...prev, [payload.conversationId]: Array.from(names) };
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeId) return;
    socket.emit("conversation:join", { conversationId: activeId });
    return () => {
      socket.emit("typing:stop", { conversationId: activeId });
      socket.emit("conversation:leave", { conversationId: activeId });
    };
  }, [activeId]);

  useEffect(() => {
    return () => {
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, conversations]);

  const active = conversations.find((conversation) => conversation.id === activeId) || null;
  const activePresence = activeId ? presence[activeId] || [] : [];
  const activeTyping = activeId ? typing[activeId] || [] : [];

  function updateDraft(value: string) {
    setDraft(value);
    if (!activeId || !socketRef.current?.connected) return;
    socketRef.current.emit("typing:start", { conversationId: activeId });
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => {
      socketRef.current?.emit("typing:stop", { conversationId: activeId });
    }, 1200);
  }

  async function send() {
    if (!active || !draft.trim()) return;
    setBusy(true);
    try {
      socketRef.current?.emit("typing:stop", { conversationId: active.id });
      const data = await api.post<{ conversation: Conversation }>(`/conversations/${active.id}/messages`, {
        message: draft.trim(),
      });
      setDraft("");
      setConversations((prev) =>
        prev.map((conversation) => (conversation.id === active.id ? data.conversation : conversation))
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page py-12">
        <div className="card h-96 skeleton" />
      </div>
    );
  }

  return (
    <div className="page-wide py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("messages.title")}</h1>
        <span className={classNames("badge", live ? "bg-emerald-50 text-emerald-700" : "bg-paper text-muted")}>
          ● {live ? t("messages.live") : t("messages.offline")}
        </span>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {conversations.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={t("messages.empty")} description={t("product.customHint")} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <aside className="card max-h-[70vh] overflow-y-auto">
            {conversations.map((conversation) => {
              const other = conversation.buyerId === user?.id ? conversation.seller : conversation.buyer;
              const last = conversation.messages[conversation.messages.length - 1];
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveId(conversation.id)}
                  className={classNames(
                    "w-full cursor-pointer border-b border-line/70 px-4 py-3 text-left last:border-b-0",
                    activeId === conversation.id ? "bg-clay-soft/50" : "hover:bg-paper"
                  )}
                >
                  <p className="truncate text-sm font-medium">{other?.name || conversation.id}</p>
                  <p className="muted truncate text-xs">{last?.message || "—"}</p>
                </button>
              );
            })}
          </aside>

          <section className="card flex max-h-[70vh] flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <div>
                <p className="text-sm font-medium">
                  {active ? (active.buyerId === user?.id ? active.seller?.name : active.buyer?.name) || active.id : "—"}
                </p>
                <p className="muted text-xs">
                  {activePresence.length > 0 ? `${activePresence.join(", ")} ${t("messages.online")}` : t("messages.noPresence")}
                </p>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-5">
              {(active?.messages || []).map((item) => (
                <div
                  key={item.id}
                  className={classNames(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                    item.senderId === user?.id ? "ml-auto bg-clay text-white" : "bg-paper"
                  )}
                >
                  <p className="whitespace-pre-line">{item.message}</p>
                  <p className={classNames("mt-1 text-[10px]", item.senderId === user?.id ? "text-white/70" : "text-muted")}>
                    {formatDateTime(item.createdAt, locale)}
                  </p>
                </div>
              ))}
              {activeTyping.length > 0 ? (
                <p className="muted px-1 text-xs">{`${activeTyping.join(", ")} ${t("messages.typing")}`}</p>
              ) : null}
              <div ref={bottomRef} />
            </div>
            <div className="flex gap-2 border-t border-line p-3">
              <input
                className="input"
                value={draft}
                onChange={(event) => updateDraft(event.target.value)}
                placeholder={t("custom.messagePlaceholder")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    send();
                  }
                }}
              />
              <button type="button" className="btn-primary" disabled={busy} onClick={send}>
                {busy ? <Spinner /> : null}
                {t("common.send")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
