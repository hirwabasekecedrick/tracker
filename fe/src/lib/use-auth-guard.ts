"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readSession } from "@/lib/auth-session";

export function useAuthRedirect(role: "admin" | "driver", isAuthorized: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (isAuthorized) {
      return;
    }

    const stored = readSession();

    if (!stored || stored.user.role !== role) {
      router.replace("/login");
    }
  }, [isAuthorized, role, router]);
}