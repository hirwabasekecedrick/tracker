"use client";

import { useEffect, useState } from "react";
import { authStorage, type AppUser } from "@/lib/auth";

export const isExpiredToken = (token: string) => {
  try {
    const payload = JSON.parse(window.atob(token.split(".")[1])) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

export function useAuthSession() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = authStorage.get();
    if (saved && !isExpiredToken(saved.token)) {
      setUser(saved.user);
      setToken(saved.token);
    } else if (saved) {
      authStorage.clear();
    }
    setReady(true);
  }, []);

  const logout = () => {
    authStorage.clear();
    setUser(null);
    setToken("");
  };

  return { user, token, ready, setUser, setToken, logout };
}
