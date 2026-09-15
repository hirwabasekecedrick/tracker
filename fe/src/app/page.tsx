"use client";

import { Box } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { authStorage } from "@/lib/auth";
import { isExpiredToken } from "@/lib/auth-session";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const saved = authStorage.get();

    if (!saved || isExpiredToken(saved.token)) {
      authStorage.clear();
      router.replace("/login");
      return;
    }

    router.replace(saved.user.role === "admin" ? "/admin" : "/driver");
  }, [router]);

  return <Box sx={{ minHeight: "100vh", background: "#08101f" }} />;
}
