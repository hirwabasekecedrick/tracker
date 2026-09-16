"use client";

import { useSyncExternalStore } from "react";
import { authStorage, type AppUser } from "@/lib/auth";

type Session = { user: AppUser; token: string };

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const isExpiredToken = (token: string) => {
  try {
    const payload = JSON.parse(window.atob(token.split(".")[1])) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

let cachedSession: Session | null = null;

export const readSession = (): Session | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const saved = authStorage.get();

  if (!saved) {
    cachedSession = null;
    return cachedSession;
  }

  if (isExpiredToken(saved.token)) {
    authStorage.clear();
    cachedSession = null;
    return cachedSession;
  }

  if (
    cachedSession &&
    cachedSession.token === saved.token &&
    cachedSession.user.id === saved.user.id &&
    cachedSession.user.email === saved.user.email
  ) {
    return cachedSession;
  }

  cachedSession = { user: saved.user, token: saved.token };
  return cachedSession;
};

export function useAuthSession() {
  const session = useSyncExternalStore(subscribe, readSession, () => null);

  const setUser = (user: AppUser) => {
    const nextToken = readSession()?.token ?? "";
    cachedSession = null;
    authStorage.save(user, nextToken);
    notify();
  };

  const setToken = (token: string) => {
    const nextUser = readSession()?.user ?? null;
    if (nextUser) {
      cachedSession = null;
      authStorage.save(nextUser, token);
      notify();
    }
  };

  const logout = () => {
    cachedSession = null;
    authStorage.clear();
    notify();
  };

  return {
    user: session?.user ?? null,
    token: session?.token ?? "",
    ready: true,
    setUser,
    setToken,
    logout,
  };
}