"use client";

import { Box } from "@mui/material";
import AdminWorkspace from "@/components/admin-workspace";
import { useAuthSession } from "@/lib/auth-session";
import { useAuthRedirect } from "@/lib/use-auth-guard";

export default function AdminPage() {
  const { user, token } = useAuthSession();
  const authorized = user?.role === "admin" && Boolean(token);
  useAuthRedirect("admin", authorized);

  if (!authorized) {
    return <Box sx={{ minHeight: "100vh", background: "#08101f" }} />;
  }

  return <AdminWorkspace token={token!} />;
}