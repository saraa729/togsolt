"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, REFRESH_KEY, setTokens, SIGNED_OUT_EVENT, TOKEN_KEY } from "./api";
import type { Cart, Locale, Role, Shop, User } from "./types";

type AuthResponse = { user: User; accessToken: string; refreshToken: string };

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  country?: string;
  locale?: Locale;
  roles?: Role[];
};

type AuthContextValue = {
  user: User | null;
  shop: Shop | null;
  ready: boolean;
  cartCount: number;
  hasRole: (role: Role) => boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (input: {
    credential: string;
    phone?: string;
    country?: string;
    locale?: Locale;
    roles?: Role[];
  }) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  refreshCart: () => Promise<void>;
  setCartCount: (count: number) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [ready, setReady] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const loadedOnce = useRef(false);

  const hasRole = useCallback(
    (role: Role) => Boolean(user && (user.roles || [user.role]).includes(role)),
    [user]
  );

  const refreshCart = useCallback(async () => {
    try {
      const data = await api.get<{ cart: Cart }>("/cart");
      setCartCount(data.cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0));
    } catch {
      setCartCount(0);
    }
  }, []);

  const clearSession = useCallback(() => {
    setTokens(null, null);
    setUser(null);
    setShop(null);
    setCartCount(0);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const data = await api.get<{ user: User; shop: Shop | null }>("/me");
      setUser(data.user);
      setShop(data.shop);
      if ((data.user.roles || []).includes("buyer")) await refreshCart();
    } catch (error) {
      // API давхарга access token-ыг аль хэдийн сэргээхийг оролдсон байна.
      // Энд хүрсэн бол refresh token нь ч хүчингүй — сессийг цэвэрлэнэ.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) clearSession();
    }
  }, [refreshCart, clearSession]);

  // Аль ч хүсэлт токеноо сэргээж чадалгүй унавал API давхарга энэ дохиог илгээнэ.
  useEffect(() => {
    window.addEventListener(SIGNED_OUT_EVENT, clearSession);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, clearSession);
  }, [clearSession]);

  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
    if (!token) {
      setReady(true);
      return;
    }
    refreshMe().finally(() => setReady(true));
  }, [refreshMe]);

  const applySession = useCallback(
    async (data: AuthResponse) => {
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      try {
        const me = await api.get<{ user: User; shop: Shop | null }>("/me");
        setShop(me.shop);
      } catch {
        setShop(null);
      }
      if ((data.user.roles || []).includes("buyer")) await refreshCart();
      return data.user;
    },
    [refreshCart]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<AuthResponse>("/auth/login", { email, password }, { token: null });
      return applySession(data);
    },
    [applySession]
  );

  /**
   * `credential` бол Google-ийн гарын үсэгтэй ID токен. Backend түүнийг Google
   * дээр баталгаажуулж, и-мэйлийг ТОКЕНООС авна — тиймээс и-мэйлийг энд илгээх
   * шаардлагагүй бөгөөс илгээвэл ч тоогдохгүй.
   */
  const loginWithGoogle = useCallback(
    async (input: { credential: string; phone?: string; country?: string; locale?: Locale; roles?: Role[] }) => {
      const data = await api.post<AuthResponse>("/auth/google", input, { token: null });
      return applySession(data);
    },
    [applySession]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const data = await api.post<AuthResponse>("/auth/register", input, { token: null });
      return applySession(data);
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    const refreshToken = typeof window !== "undefined" ? window.localStorage.getItem(REFRESH_KEY) : null;
    try {
      await api.post("/auth/logout", { refreshToken });
    } catch {
      /* сервер алдаа өгсөн ч локал сессийг цэвэрлэнэ */
    }
    setTokens(null, null);
    setUser(null);
    setShop(null);
    setCartCount(0);
  }, []);

  const value = useMemo(
    () => ({
      user,
      shop,
      ready,
      cartCount,
      hasRole,
      login,
      loginWithGoogle,
      register,
      logout,
      refreshMe,
      refreshCart,
      setCartCount,
    }),
    [user, shop, ready, cartCount, hasRole, login, loginWithGoogle, register, logout, refreshMe, refreshCart]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
