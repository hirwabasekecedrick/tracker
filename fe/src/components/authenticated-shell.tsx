"use client";

import { Box } from "@mui/material";
import { useState } from "react";
import type { ReactNode } from "react";
import type { AppUser } from "@/lib/auth";
import AppHeader from "@/components/app-header";
import AppSidebar from "@/components/app-sidebar";

type AuthenticatedShellProps = {
  user: AppUser;
  onLogout: () => void;
  children: ReactNode;
};

export default function AuthenticatedShell({ user, onLogout, children }: AuthenticatedShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = user.role === "admin";

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppHeader user={user} isAdmin={isAdmin} onMenuClick={() => setSidebarOpen(true)} onLogout={onLogout} />
      <Box sx={{ display: { xs: "block", md: "flex" }, width: "100%" }}>
        <AppSidebar user={user} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
        <Box component="main" sx={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", p: { xs: 2, md: 4 } }}>
          <Box sx={{ width: "min(100%, 1400px)" }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}
