"use client";

import { Box } from "@mui/material";
import { useRouter } from "next/navigation";
import AuthenticatedShell from "@/components/authenticated-shell";
import DriverWorkspace from "@/components/driver-workspace";
import { useAuthSession } from "@/lib/auth-session";
import { useAuthRedirect } from "@/lib/use-auth-guard";

export default function DriverPage() {
  const router = useRouter();
  const { user, token, logout } = useAuthSession();
  const authorized = user?.role === "driver" && Boolean(token);
  useAuthRedirect("driver", authorized);

  if (!authorized) {
    return <Box sx={{ minHeight: "100vh", background: "#08101f" }} />;
  }

  return (
    <AuthenticatedShell user={user!} onLogout={() => { logout(); router.replace("/login"); }}>
      <DriverWorkspace user={user!} token={token!} />
    </AuthenticatedShell>
  );
}