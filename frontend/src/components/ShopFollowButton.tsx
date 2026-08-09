"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";

export default function ShopFollowButton({ shopId, slug }: { shopId: string; slug: string }) {
  const { t } = useApp();
  const { user } = useAuth();
  const router = useRouter();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!user) return router.push(`/login?next=/shop/${slug}`);
    setBusy(true);
    try {
      if (following) await api.del(`/follows/shops/${shopId}`);
      else await api.post(`/follows/shops/${shopId}`);
      setFollowing(!following);
    } catch {
      /* дагах үйлдэл амжилтгүй бол төлөв өөрчлөгдөхгүй */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={following ? "btn-secondary" : "btn-primary"} disabled={busy} onClick={toggle}>
      {following ? `✓ ${t("shop.unfollow")}` : `+ ${t("shop.follow")}`}
    </button>
  );
}
