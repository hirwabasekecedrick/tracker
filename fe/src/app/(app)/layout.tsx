"use client";

import { Box } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import AppHeader from "@/components/app-header";
import AppSidebar from "@/components/app-sidebar";
import { readSession, useAuthSession } from "@/lib/auth-session";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, token, logout } = useAuthSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasSession = Boolean(user && token);

  useEffect(() => {
    const stored = readSession();
    if (!stored) {
      router.replace("/login");
    }
  }, [hasSession, router]);

  if (!user) {
    return <Box className="app-shell" sx={{ background: "#08101f" }} />;
  }

  const isAdmin = user.role === "admin";

  return (
    <Box className="app-shell" sx={{ display: "flex", flexDirection: "column" }}>
      <AppHeader
        user={user}
        isAdmin={isAdmin}
        onMenuClick={() => setSidebarOpen(true)}
        onLogout={() => {
          logout();
          router.replace("/login");
        }}
      />
      <Box sx={{ flex: 1, minHeight: 0, display: { xs: "block", md: "flex" }, overflow: "hidden" }}>
        <AppSidebar user={user} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
        <Box
          component="main"
          sx={{ flex: 1, minWidth: 0, overflowY: "auto", display: "flex", justifyContent: "center", p: { xs: 2, md: 4 } }}
        >
          <Box sx={{ width: "min(100%, 1400px)", pb: 2 }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}