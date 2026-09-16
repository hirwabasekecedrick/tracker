"use client";

import { Box } from "@mui/material";
import DriverWorkspace from "@/components/driver-workspace";
import { useAuthSession } from "@/lib/auth-session";
import { useAuthRedirect } from "@/lib/use-auth-guard";

export default function DriverPage() {
  const { user, token } = useAuthSession();
  const authorized = user?.role === "driver" && Boolean(token);
  useAuthRedirect("driver", authorized);

  if (!authorized) {
    return <Box sx={{ minHeight: "100vh", background: "#08101f" }} />;
  }

  return <DriverWorkspace user={user!} token={token!} />;
}