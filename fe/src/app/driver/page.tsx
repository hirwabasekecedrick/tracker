"use client";

import { Box, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import AuthenticatedShell from "@/components/authenticated-shell";
import DriverWorkspace from "@/components/driver-workspace";
import { useAuthSession } from "@/lib/auth-session";

export default function DriverPage() {
  const router = useRouter();
  const { user, token, ready, logout } = useAuthSession();

  if (!ready) return <Box sx={{ minHeight: "100vh", background: "#08101f" }} />;
  if (!user || user.role !== "driver" || !token) {
    router.replace("/login");
    return <Typography>Redirecting to login...</Typography>;
  }

  return <AuthenticatedShell user={user} onLogout={() => { logout(); router.replace("/login"); }}><DriverWorkspace user={user} token={token} /></AuthenticatedShell>;
}
