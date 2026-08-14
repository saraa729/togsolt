"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "./ui";

/**
 * Урлаачтай шууд харилцан яриа нээнэ.
 *
 * `POST /conversations` нь `orderItemId`-г заавал шаарддаггүй тул захиалга
 * өгөхөөс өмнө ч асуулт тавих боломжтой — гар урлалд "энэ хээг өөр өнгөөр
 * хийж болох уу?" гэдэг яриа ихэвчлэн худалдан авалтаас өмнө болдог.
 *
 * Backend нь ижил (buyer, seller, orderItemId=null) гурвалд давхар яриа
 * үүсгэдэггүй тул товчийг дахин дарахад хуучин яриа руугаа буцаж орно.
 */
export default function ContactArtisanButton({
  sellerId,
  next,
  className = "btn-secondary",
}: {
  sellerId: string;
  /** Нэвтрээгүй хэрэглэгчийг нэвтэрсний дараа буцааж авчрах зам. */
  next: string;
  className?: string;
}) {
  const { t } = useApp();
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Урлаач өөртэйгөө чатлах шаардлагагүй.
  if (user && user.id === sellerId) return null;

  async function openConversation() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api.post<{ conversation: { id: string } }>("/conversations", { sellerId });
      // Амжилттай бол хуудас солигдох тул `busy`-г буцаахгүй.
      router.push(`/messages?c=${data.conversation.id}`);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" className={className} disabled={busy} onClick={openConversation}>
        {busy ? <Spinner /> : null}
        {busy ? t("messages.opening") : t("messages.contactArtisan")}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
